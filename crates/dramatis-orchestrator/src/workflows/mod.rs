pub mod wf01_archivist;
pub mod wf02_scribe;
pub mod wf03_arbiter;
pub mod wf04_steward;
pub mod wf05_playwright;
pub mod wf06_director;
pub mod wf07_actor;
pub mod wf08_ingester;

use std::path::PathBuf;
use dramatis_core::{CreationValidationResult, Role, TheaterManifest};
use dramatis_stage::{AgentContextView, CampaignManifest, MechanicalResolution};

use crate::config::{AgentConfig, WorkflowConfig};
use crate::trace::StepTrace;
use crate::validation::MutationProposal;

/// Shared execution inputs passed to each individual workflow runner (`WF-01`..`WF-07`).
pub struct WorkflowRuntimeInput<'a> {
    pub theater_id: &'a str,
    pub theater_root: PathBuf,
    pub manifest: Option<&'a TheaterManifest>,
    pub agent_config: &'a AgentConfig,
    pub workflow_config: &'a WorkflowConfig,
    pub input_payload: &'a serde_json::Value,
    pub role: Role,
    pub dry_run: bool,
    pub language_retry_hint: Option<String>,
}

/// Complete domain result produced by a single workflow execution prior to Gates G1-G4.
pub struct WorkflowOutcome {
    pub output: serde_json::Value,
    pub steps: Vec<StepTrace>,
    pub model_used: Option<String>,
    pub prompt_preview: Option<String>,
    pub user_query_text: Option<String>,
    pub expected_schema: serde_json::Value,
    pub retrieved_sources: Vec<(String, String)>,
    pub forbidden_secrets: Vec<String>,
    pub actor_view: Option<AgentContextView>,
    pub original_markdown: Option<String>,
    pub proposed_markdown: Option<String>,
    pub machina_deterministic_source: bool,
    pub campaign_manifest: Option<CampaignManifest>,
    pub mechanical_resolution: Option<MechanicalResolution>,
    pub creation_validation: Option<CreationValidationResult>,
    pub mutation_proposal: Option<MutationProposal>,
}

impl Default for WorkflowOutcome {
    fn default() -> Self {
        Self {
            output: serde_json::Value::Null,
            steps: Vec::new(),
            model_used: None,
            prompt_preview: None,
            user_query_text: None,
            expected_schema: serde_json::json!({ "type": "object" }),
            retrieved_sources: Vec::new(),
            forbidden_secrets: Vec::new(),
            actor_view: None,
            original_markdown: None,
            proposed_markdown: None,
            machina_deterministic_source: false,
            campaign_manifest: None,
            mechanical_resolution: None,
            creation_validation: None,
            mutation_proposal: None,
        }
    }
}

/// Helper returning elapsed milliseconds as `u64`.
pub fn elapsed_ms(started: &std::time::Instant) -> u64 {
    started.elapsed().as_millis() as u64
}
