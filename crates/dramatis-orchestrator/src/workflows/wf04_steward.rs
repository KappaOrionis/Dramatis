use std::path::Path;
use std::time::Instant;
use serde::Deserialize;
use serde_json::json;

use dramatis_core::{
    ArsMagicaCreationInput, ArtificerEngine, CharacterCreationEngine, CreationValidationResult,
    HealthMonitor, HermeticCraftInput, PersonaState, ShadowrunPriorityInput,
};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::validation::{build_unified_diff, MutationProposal};
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct StewardInput {
    pub persona_id: String,
    pub mutation_type: String, // "create_persona" | "apply_damage" | "spend_xp" | "update_essence" | "validate_ars_magica" | "validate_shadowrun" | "craft_artificer"
    pub name: Option<String>,
    pub archetype: Option<String>,
    pub monitor_name: Option<String>,
    pub amount: Option<f64>,
    pub is_magus: Option<bool>,
    pub creation_input: Option<serde_json::Value>,
    pub craft_input: Option<HermeticCraftInput>,
}

impl Default for StewardInput {
    fn default() -> Self {
        Self {
            persona_id: "perso_01".to_string(),
            mutation_type: "create_persona".to_string(),
            name: None,
            archetype: None,
            monitor_name: Some("Physique".to_string()),
            amount: None,
            is_magus: Some(true),
            creation_input: None,
            craft_input: None,
        }
    }
}

/// WF-04 (`dramatis.steward`): Character sheet creation, exact fractional Essence/XP audit, and JSON/MD sync.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: StewardInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-04 invalide: {}", e)))?;

    let mut steps = Vec::new();
    let personae_dir = ctx.theater_root.join("03_personae");
    let json_path = personae_dir.join(format!("{}.json", input.persona_id));
    let md_path = personae_dir.join(format!("{}.md", input.persona_id));
    let rel_json = format!("03_personae/{}.json", input.persona_id);

    let system_name = ctx
        .manifest
        .map(|m| m.system_id.clone())
        .unwrap_or_else(|| "generic".to_string());

    // Step 1: Load existing persona sheet or initialize a fresh one
    let t1 = Instant::now();
    let original_json_str = if json_path.exists() {
        std::fs::read_to_string(&json_path)?
    } else {
        String::new()
    };

    let mut persona: PersonaState = if !original_json_str.is_empty() {
        serde_json::from_str(&original_json_str)?
    } else {
        let mut p = PersonaState::new(
            &input.persona_id,
            input.name.as_deref().unwrap_or(&input.persona_id),
            &system_name,
        );
        p.archetype = input.archetype.clone();
        p.health_monitors.push(HealthMonitor {
            name: "Physique".to_string(),
            max_boxes: 10,
            current_damage: 0,
            penalty: 0,
        });
        p
    };

    steps.push(StepTrace {
        step_id: "load_sheet".to_string(),
        name: "Chargement / initialisation de fiche".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!("Fiche `{}` ({})", persona.name, persona.theater_system),
        metadata: json!({ "existed": !original_json_str.is_empty() }),
    });

    // Step 2: Proposal generation & deterministic audit
    let t2 = Instant::now();
    let mut creation_validation: Option<CreationValidationResult> = None;
    let mut craft_verdict = None;
    let mut active_penalty: i64 = persona
        .health_monitors
        .first()
        .map(|m| m.penalty)
        .unwrap_or(0);

    match input.mutation_type.as_str() {
        "create_persona" => {
            if let Some(name) = &input.name {
                persona.name = name.clone();
            }
            if let Some(arch) = &input.archetype {
                persona.archetype = Some(arch.clone());
            }
        }
        "apply_damage" => {
            let monitor = input.monitor_name.as_deref().unwrap_or("Physique");
            let dmg = input.amount.unwrap_or(1.0).max(0.0).round() as usize;
            if persona.health_monitors.iter().all(|m| m.name != monitor) {
                persona.health_monitors.push(HealthMonitor {
                    name: monitor.to_string(),
                    max_boxes: 10,
                    current_damage: 0,
                    penalty: 0,
                });
            }
            persona.apply_damage(monitor, dmg);
            active_penalty = persona
                .health_monitors
                .iter()
                .find(|m| m.name == monitor)
                .map(|m| m.penalty)
                .unwrap_or(0);
        }
        "spend_xp" => {
            let cost = input.amount.unwrap_or(0.0).round() as i64;
            persona.experience_points = (persona.experience_points - cost).max(0);
        }
        "update_essence" => {
            let delta = input.amount.unwrap_or(0.0);
            let cur_hundredths = ((persona.essence.unwrap_or(6.0)) * 100.0).round() as i64;
            let delta_hundredths = (delta * 100.0).round() as i64;
            let next_hundredths = (cur_hundredths + delta_hundredths).clamp(0, 600);
            persona.essence = Some((next_hundredths as f64) / 100.0);
        }
        "validate_ars_magica" => {
            if let Some(raw_ci) = &input.creation_input {
                let ars_in: ArsMagicaCreationInput = serde_json::from_value(raw_ci.clone())
                    .map_err(|e| {
                        OrchestratorError::InvalidConfig(format!(
                            "Entrée création Ars Magica invalide: {}",
                            e
                        ))
                    })?;
                let res = CharacterCreationEngine::validate_ars_magica(
                    &ars_in,
                    input.is_magus.unwrap_or(true),
                );
                if res.is_valid {
                    persona.experience_points = res
                        .total_xp_budget
                        .unwrap_or(0)
                        .saturating_sub(ars_in.spent_early_childhood_xp + ars_in.spent_later_life_xp)
                        as i64;
                }
                creation_validation = Some(res);
            }
        }
        "validate_shadowrun" => {
            if let Some(raw_ci) = &input.creation_input {
                let sr_in: ShadowrunPriorityInput = serde_json::from_value(raw_ci.clone())
                    .map_err(|e| {
                        OrchestratorError::InvalidConfig(format!(
                            "Entrée priorités Shadowrun invalide: {}",
                            e
                        ))
                    })?;
                let res = CharacterCreationEngine::validate_shadowrun_priority(&sr_in);
                if let Some(ess) = res.calculated_essence {
                    persona.essence = Some(ess);
                }
                creation_validation = Some(res);
            }
        }
        "craft_artificer" => {
            if let Some(craft_in) = &input.craft_input {
                let verdict = ArtificerEngine::evaluate_hermetic_project(craft_in);
                craft_verdict = Some(verdict);
            }
        }
        other => {
            return Err(OrchestratorError::InvalidConfig(format!(
                "Type de mutation WF-04 inconnu: {}",
                other
            )));
        }
    }

    steps.push(StepTrace {
        step_id: "proposal_generation".to_string(),
        name: "Calcul de la mutation proposée".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: format!("Mutation `{}` calculée", input.mutation_type),
        metadata: json!({ "mutation_type": input.mutation_type }),
    });

    // Step 3: Deterministic Audit
    let t3 = Instant::now();
    let audit_summary = creation_validation
        .as_ref()
        .map(|c| c.summary.clone())
        .or_else(|| craft_verdict.as_ref().map(|v| v.explanation.clone()))
        .unwrap_or_else(|| {
            format!(
                "Essence={:.2}, Malus={}, XP={}",
                persona.essence.unwrap_or(6.0),
                active_penalty,
                persona.experience_points
            )
        });
    steps.push(StepTrace {
        step_id: "deterministic_audit".to_string(),
        name: "Audit mathématique & règles de création".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: audit_summary.clone(),
        metadata: json!({ "active_penalty": active_penalty }),
    });

    // Step 4: Prepare JSON & Markdown synchronization + Diff
    let t4 = Instant::now();
    let proposed_json_str = serde_json::to_string_pretty(&persona)?;
    let proposed_md = persona.to_markdown();
    let original_md = if md_path.exists() {
        std::fs::read_to_string(&md_path)?
    } else {
        String::new()
    };
    let diff_preview = build_unified_diff(&original_md, &proposed_md);

    let mutation_payload = json!({
        "persona_id": persona.id,
        "json_path": rel_json,
        "md_path": format!("03_personae/{}.md", persona.id),
        "persona_json": proposed_json_str,
        "persona_markdown": proposed_md,
    });

    steps.push(StepTrace {
        step_id: "sheet_sync".to_string(),
        name: "Préparation synchro JSON & Markdown".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t4),
        summary: format!("Synchronisation prête pour {}", rel_json),
        metadata: json!({ "target_path": rel_json }),
    });

    let output = json!({
        "updated": true,
        "active_penalty": active_penalty,
        "markdown_synced": true,
        "summary": audit_summary,
        "persona": persona,
        "calculated_essence": persona.essence,
        "creation_validation": creation_validation,
        "craft_verdict": craft_verdict,
        "diff_preview": diff_preview,
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        expected_schema: json!({
            "type": "object",
            "required": ["updated", "active_penalty", "markdown_synced", "persona"],
            "properties": {
                "updated": { "type": "boolean" },
                "active_penalty": { "type": "integer" },
                "markdown_synced": { "type": "boolean" },
                "persona": { "type": "object" }
            }
        }),
        creation_validation,
        mutation_proposal: Some(MutationProposal {
            action_kind: "steward_write_persona".to_string(),
            target_path: rel_json,
            summary: format!("Mise à jour personnage `{}` ({})", input.persona_id, input.mutation_type),
            diff_preview,
            payload: mutation_payload,
        }),
        ..WorkflowOutcome::default()
    })
}

/// Persists an approved WF-04 Steward character mutation (JSON + Markdown).
pub fn apply_mutation(
    theater_root: &Path,
    payload: &serde_json::Value,
) -> Result<(), OrchestratorError> {
    let json_rel = payload["json_path"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing json_path".into()))?;
    let md_rel = payload["md_path"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing md_path".into()))?;
    let json_body = payload["persona_json"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing persona_json".into()))?;
    let md_body = payload["persona_markdown"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing persona_markdown".into()))?;

    let json_full = theater_root.join(json_rel);
    let md_full = theater_root.join(md_rel);
    if let Some(parent) = json_full.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(json_full, json_body)?;
    std::fs::write(md_full, md_body)?;

    Ok(())
}
