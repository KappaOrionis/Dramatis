use std::path::{Path, PathBuf};
use std::time::Instant;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use dramatis_core::{Role, TheaterManifest, TheaterWorkspace};

use crate::config::{AgentId, ConfigRegistry};
use crate::error::OrchestratorError;
use crate::trace::{
    ExecutionTrace, GateId, GateStatus, HitlApprovalRecord, HitlApprovalStatus, TraceStore,
    ValidationReport,
};
use crate::validation::{MutationProposal, ValidationContext, ValidationPipeline};
use crate::workflows::{
    wf01_archivist, wf02_scribe, wf03_arbiter, wf04_steward, wf05_playwright, wf06_director,
    wf07_actor, WorkflowOutcome, WorkflowRuntimeInput,
};

/// Invocation request sent to `OrchestratorEngine::execute`.
#[derive(Debug, Clone, Deserialize)]
pub struct WorkflowRequest {
    pub theater_id: String,
    pub theater_root: PathBuf,
    pub workflow_id: String,
    #[serde(default)]
    pub input: serde_json::Value,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default = "default_role")]
    pub role: Role,
    #[serde(default)]
    pub runtime_override: Option<serde_json::Value>,
}

fn default_role() -> Role {
    Role::Gm
}

/// Complete response returned by `OrchestratorEngine::execute`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecutionResult {
    pub trace_id: String,
    pub workflow_id: String,
    pub agent_id: String,
    pub status: String,
    pub dry_run: bool,
    pub output: serde_json::Value,
    pub validation: ValidationReport,
    pub approval: Option<HitlApprovalRecord>,
    pub trace: ExecutionTrace,
}

/// Decision submitted by a human GM on a Gate G4 pending approval request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HitlDecision {
    Approve,
    Reject,
    Override,
}

/// Core agentic execution engine coordinating ConfigRegistry, Workflows, ValidationPipeline (G1-G4), and TraceStore.
pub struct OrchestratorEngine;

impl OrchestratorEngine {
    /// Executes a workflow (`WF-01`..`WF-07`), runs Gates G1-G4, records an `ExecutionTrace`,
    /// and applies or queues any resulting mutation.
    pub async fn execute(req: WorkflowRequest) -> Result<WorkflowExecutionResult, OrchestratorError> {
        let started_instant = Instant::now();
        let started_at = Utc::now().to_rfc3339();
        let trace_id = TraceStore::new_trace_id();

        let agent = AgentId::parse_workflow(&req.workflow_id)?;
        let theater_manifest = Self::load_manifest_if_exists(&req.theater_root);

        let resolved_agent = ConfigRegistry::resolve_agent(
            &req.theater_root,
            theater_manifest.as_ref(),
            agent,
            req.runtime_override.as_ref(),
        )?;
        let resolved_workflow = ConfigRegistry::resolve_workflow(&req.theater_root, agent, None)?;

        let agent_cfg = resolved_agent.config;
        let workflow_cfg = resolved_workflow.config;

        if !agent_cfg.enabled || !workflow_cfg.enabled {
            return Err(OrchestratorError::Execution(format!(
                "Le workflow {} ({}) est désactivé dans la configuration de l'univers.",
                agent.workflow_id(),
                agent.as_str()
            )));
        }

        // Enforce strict_local privacy guard before invoking any LLM-backed workflow
        let theater_privacy = theater_manifest
            .as_ref()
            .and_then(|m| m.privacy_mode.as_deref());
        let strict_local = agent_cfg.effective_strict_local(theater_privacy);
        if strict_local && !agent_cfg.model.is_local() && Self::workflow_uses_llm(agent) {
            return Err(OrchestratorError::PrivacyViolation(format!(
                "Mode strict_local actif : le fournisseur `{}` ({}) est bloqué pour `{}`.",
                agent_cfg.model.provider, agent_cfg.model.base_url, agent_cfg.id
            )));
        }

        let max_attempts = 1 + workflow_cfg.max_retries.min(2);
        let mut retries_used = 0usize;
        let mut language_hint: Option<String> = None;

        let (outcome, validation) = loop {
            let runtime_in = WorkflowRuntimeInput {
                theater_id: &req.theater_id,
                theater_root: req.theater_root.clone(),
                manifest: theater_manifest.as_ref(),
                agent_config: &agent_cfg,
                workflow_config: &workflow_cfg,
                input_payload: &req.input,
                role: req.role,
                dry_run: req.dry_run,
                language_retry_hint: language_hint.clone(),
            };

            let outcome = Self::dispatch_workflow(agent, &runtime_in).await?;
            let val_ctx = ValidationContext {
                workflow_id: agent.workflow_id(),
                agent_config: &agent_cfg,
                workflow_config: &workflow_cfg,
                role: req.role,
                dry_run: req.dry_run,
                user_query_text: outcome.user_query_text.clone(),
                expected_schema: outcome.expected_schema.clone(),
                retrieved_sources: outcome.retrieved_sources.clone(),
                forbidden_secrets: outcome.forbidden_secrets.clone(),
                actor_view: outcome.actor_view.clone(),
                original_markdown: outcome.original_markdown.clone(),
                proposed_markdown: outcome.proposed_markdown.clone(),
                machina_deterministic_source: outcome.machina_deterministic_source,
                campaign_manifest: outcome.campaign_manifest.clone(),
                mechanical_resolution: outcome.mechanical_resolution.clone(),
                creation_validation: outcome.creation_validation.clone(),
                mutation_proposal: outcome.mutation_proposal.clone(),
            };
            let report = ValidationPipeline::run(&outcome.output, &val_ctx);

            let g1_failed = report
                .gates
                .iter()
                .any(|g| g.gate == GateId::G1Contract && g.status == GateStatus::Failed);

            if g1_failed && retries_used + 1 < max_attempts && Self::workflow_uses_llm(agent) {
                retries_used += 1;
                let g1_msg = report
                    .gates
                    .iter()
                    .find(|g| g.gate == GateId::G1Contract)
                    .map(|g| g.message.clone())
                    .unwrap_or_default();
                language_hint = Some(format!(
                    "Respecte strictement la langue demandée et le contrat JSON. Erreur précédente : {}",
                    g1_msg
                ));
                continue;
            }

            break (outcome, report);
        };

        // Handle Gate G4 persistence or immediate mutation
        let mut approval_record: Option<HitlApprovalRecord> = None;
        let final_status = if !validation.overall_passed {
            "validation_failed".to_string()
        } else if validation.requires_hitl_approval {
            if let Some(prop) = &outcome.mutation_proposal {
                let rec = HitlApprovalRecord {
                    approval_id: TraceStore::new_approval_id(),
                    trace_id: trace_id.clone(),
                    theater_id: req.theater_id.clone(),
                    workflow_id: agent.workflow_id().to_string(),
                    agent_id: agent.as_str().to_string(),
                    action_kind: prop.action_kind.clone(),
                    target_path: prop.target_path.clone(),
                    summary: prop.summary.clone(),
                    diff_preview: prop.diff_preview.clone(),
                    mutation_payload: prop.payload.clone(),
                    status: HitlApprovalStatus::Pending,
                    gm_note: None,
                    created_at: Utc::now().to_rfc3339(),
                    decided_at: None,
                };
                let store = TraceStore::open(&req.theater_root)?;
                store.create_approval(&rec)?;
                approval_record = Some(rec);
            }
            "pending_approval".to_string()
        } else {
            // Apply mutation immediately if Gate G4 Passed and not Dry-Run
            let g4_passed = validation
                .gates
                .iter()
                .any(|g| g.gate == GateId::G4Hitl && g.status == GateStatus::Passed);
            if g4_passed && !req.dry_run {
                if let Some(prop) = &outcome.mutation_proposal {
                    Self::apply_mutation(&req.theater_root, prop)?;
                }
            }
            "completed".to_string()
        };

        let trace = ExecutionTrace {
            trace_id: trace_id.clone(),
            theater_id: req.theater_id.clone(),
            workflow_id: agent.workflow_id().to_string(),
            agent_id: agent.as_str().to_string(),
            dry_run: req.dry_run,
            status: final_status.clone(),
            started_at,
            duration_ms: started_instant.elapsed().as_millis() as u64,
            model_used: outcome.model_used.clone(),
            prompt_preview: outcome.prompt_preview.clone(),
            input_payload: req.input.clone(),
            output_payload: outcome.output.clone(),
            steps: outcome.steps,
            validation: validation.clone(),
            approval_id: approval_record.as_ref().map(|a| a.approval_id.clone()),
            retries: retries_used,
        };

        // Persist ExecutionTrace synchronously
        let store = TraceStore::open(&req.theater_root)?;
        store.record_trace(&trace)?;

        Ok(WorkflowExecutionResult {
            trace_id,
            workflow_id: agent.workflow_id().to_string(),
            agent_id: agent.as_str().to_string(),
            status: final_status,
            dry_run: req.dry_run,
            output: outcome.output,
            validation,
            approval: approval_record,
            trace,
        })
    }

    /// Resolves a pending Gate G4 HITL approval request (Approve, Reject, or GM Override).
    pub fn decide_approval(
        theater_root: &Path,
        approval_id: &str,
        decision: HitlDecision,
        override_payload: Option<serde_json::Value>,
        gm_note: Option<String>,
    ) -> Result<HitlApprovalRecord, OrchestratorError> {
        let store = TraceStore::open(theater_root)?;
        let existing = store.get_approval(approval_id)?;

        match decision {
            HitlDecision::Reject => {
                store.update_approval_resolution(approval_id, HitlApprovalStatus::Rejected, None, gm_note)
            }
            HitlDecision::Approve => {
                let proposal = MutationProposal {
                    action_kind: existing.action_kind.clone(),
                    target_path: existing.target_path.clone(),
                    summary: existing.summary.clone(),
                    diff_preview: existing.diff_preview.clone(),
                    payload: existing.mutation_payload.clone(),
                };
                Self::apply_mutation(theater_root, &proposal)?;
                store.update_approval_resolution(approval_id, HitlApprovalStatus::Approved, None, gm_note)
            }
            HitlDecision::Override => {
                let effective_payload = override_payload.unwrap_or_else(|| existing.mutation_payload.clone());
                let proposal = MutationProposal {
                    action_kind: existing.action_kind.clone(),
                    target_path: existing.target_path.clone(),
                    summary: existing.summary.clone(),
                    diff_preview: existing.diff_preview.clone(),
                    payload: effective_payload.clone(),
                };
                Self::apply_mutation(theater_root, &proposal)?;
                store.update_approval_resolution(
                    approval_id,
                    HitlApprovalStatus::Overridden,
                    Some(effective_payload),
                    gm_note,
                )
            }
        }
    }

    /// Dispatches execution to the requested workflow module.
    async fn dispatch_workflow(
        agent: AgentId,
        runtime_in: &WorkflowRuntimeInput<'_>,
    ) -> Result<WorkflowOutcome, OrchestratorError> {
        match agent {
            AgentId::Archivist => wf01_archivist::run(runtime_in).await,
            AgentId::Scribe => wf02_scribe::run(runtime_in).await,
            AgentId::Arbiter => wf03_arbiter::run(runtime_in).await,
            AgentId::Steward => wf04_steward::run(runtime_in).await,
            AgentId::Playwright => wf05_playwright::run(runtime_in).await,
            AgentId::Director => wf06_director::run(runtime_in).await,
            AgentId::Actor => wf07_actor::run(runtime_in).await,
        }
    }

    /// Applies an approved disk/DB mutation proposal according to `action_kind`.
    pub fn apply_mutation(
        theater_root: &Path,
        proposal: &MutationProposal,
    ) -> Result<(), OrchestratorError> {
        match proposal.action_kind.as_str() {
            "scribe_write_wiki" => wf02_scribe::apply_mutation(theater_root, &proposal.payload),
            "steward_write_persona" => wf04_steward::apply_mutation(theater_root, &proposal.payload),
            "playwright_write_manifest" => wf05_playwright::apply_mutation(theater_root, &proposal.payload),
            "director_append_log" => wf06_director::apply_mutation(theater_root, &proposal.payload),
            other => Err(OrchestratorError::Execution(format!(
                "Type de mutation inconnu: {}",
                other
            ))),
        }
    }

    fn workflow_uses_llm(agent: AgentId) -> bool {
        matches!(
            agent,
            AgentId::Archivist | AgentId::Director | AgentId::Actor
        )
    }

    fn load_manifest_if_exists(theater_root: &Path) -> Option<TheaterManifest> {
        if theater_root.join("theater.yaml").exists() {
            TheaterWorkspace::open(theater_root)
                .ok()
                .map(|ws| ws.manifest)
        } else {
            None
        }
    }
}
