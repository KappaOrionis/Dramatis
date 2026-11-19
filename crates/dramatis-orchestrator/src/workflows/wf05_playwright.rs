use std::path::Path;
use std::time::Instant;
use serde::Deserialize;
use serde_json::json;

use dramatis_machina::MonteCarloSimulator;
use dramatis_stage::{CampaignManifest, SceneClock, SceneNode};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::validation::{build_unified_diff, MutationProposal};
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct ClockAdvanceReq {
    pub clock_id: String,
    pub delta_segments: u32,
}

impl Default for ClockAdvanceReq {
    fn default() -> Self {
        Self {
            clock_id: String::new(),
            delta_segments: 1,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct EncounterTestReq {
    pub dice_count: usize,
    pub dice_sides: u32,
    pub modifier: i64,
    pub threshold: i64,
}

impl Default for EncounterTestReq {
    fn default() -> Self {
        Self {
            dice_count: 1,
            dice_sides: 20,
            modifier: 3,
            threshold: 14,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct PlaywrightInput {
    pub play_id: String,
    pub campaign_name: Option<String>,
    pub new_scene: Option<SceneNode>,
    pub link_from_scene: Option<String>,
    pub new_clock: Option<SceneClock>,
    pub advance_clock: Option<ClockAdvanceReq>,
    pub encounter_test: Option<EncounterTestReq>,
}

impl Default for PlaywrightInput {
    fn default() -> Self {
        Self {
            play_id: "default_play".to_string(),
            campaign_name: None,
            new_scene: None,
            link_from_scene: None,
            new_clock: None,
            advance_clock: None,
            encounter_test: None,
        }
    }
}

/// WF-05 (`dramatis.playwright`): Nodal scenario editing, clock progression, Monte-Carlo balancing, and graph topology validation.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: PlaywrightInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-05 invalide: {}", e)))?;

    let mut steps = Vec::new();
    let rel_path = format!("05_plays/{}/campaign_manifest.json", input.play_id);
    let manifest_path = ctx.theater_root.join(&rel_path);

    // Step 1: World State Read
    let t1 = Instant::now();
    let original_str = if manifest_path.exists() {
        std::fs::read_to_string(&manifest_path)?
    } else {
        String::new()
    };

    let mut manifest = if manifest_path.exists() {
        CampaignManifest::load_from_file(&manifest_path)
            .map_err(|e| OrchestratorError::Execution(format!("Erreur lecture manifest: {}", e)))?
    } else {
        CampaignManifest::new(
            &input.play_id,
            input
                .campaign_name
                .as_deref()
                .unwrap_or("Campagne Dramatis"),
            SceneNode {
                id: "scene_01".to_string(),
                title: "Prologue".to_string(),
                synopsis: "Introduction de la campagne dans le théâtre actif.".to_string(),
                active_zone_ids: vec!["zone_principale".to_string()],
                clues_obtainable: vec![
                    "Indice A (observation)".to_string(),
                    "Indice B (archive)".to_string(),
                    "Indice C (témoin)".to_string(),
                ],
                next_scene_options: Vec::new(),
            },
        )
    };
    steps.push(StepTrace {
        step_id: "world_state_read".to_string(),
        name: "Lecture du manifeste de campagne".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!(
            "Play `{}` ({} scènes, {} horloges)",
            manifest.play_id,
            manifest.scenes.len(),
            manifest.clocks.len()
        ),
        metadata: json!({ "active_scene": manifest.active_scene_id }),
    });

    // Step 2: Node Graph & Clock Editing
    let t2 = Instant::now();
    let mut triggered_event: Option<String> = None;
    let mut active_clock_val = 0u32;
    let mut active_clock_max = 0u32;

    if let Some(new_scene) = input.new_scene {
        let new_id = new_scene.id.clone();
        manifest.scenes.insert(new_id.clone(), new_scene);
        let parent_id = input
            .link_from_scene
            .unwrap_or_else(|| manifest.active_scene_id.clone());
        if let Some(parent) = manifest.scenes.get_mut(&parent_id) {
            if !parent.next_scene_options.contains(&new_id) {
                parent.next_scene_options.push(new_id);
            }
        }
    }

    if let Some(clock) = input.new_clock {
        if !manifest.clocks.iter().any(|c| c.id == clock.id) {
            manifest.clocks.push(clock);
        }
    }

    if let Some(adv) = input.advance_clock {
        if let Some(clk) = manifest.clocks.iter_mut().find(|c| c.id == adv.clock_id) {
            let full = clk.advance(adv.delta_segments);
            active_clock_val = clk.current_segments;
            active_clock_max = clk.total_segments;
            if full {
                triggered_event = clk.triggered_event_rhai_hook.clone();
            }
        } else {
            // Create a temporary tracking entry if clock doesn't exist yet
            let mut clk = SceneClock {
                id: adv.clock_id.clone(),
                title: adv.clock_id.clone(),
                total_segments: 6,
                current_segments: 0,
                triggered_event_rhai_hook: Some("alert_escalation".to_string()),
            };
            let full = clk.advance(adv.delta_segments);
            active_clock_val = clk.current_segments;
            active_clock_max = clk.total_segments;
            if full {
                triggered_event = clk.triggered_event_rhai_hook.clone();
            }
            manifest.clocks.push(clk);
        }
    }

    steps.push(StepTrace {
        step_id: "node_graph_draft".to_string(),
        name: "Édition des nœuds & horloges de scène".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: format!(
            "{} nœud(s), {} horloge(s)",
            manifest.scenes.len(),
            manifest.clocks.len()
        ),
        metadata: json!({ "triggered_event": triggered_event }),
    });

    // Step 3: Encounter Balancing via Monte-Carlo
    let t3 = Instant::now();
    let lethality_target = ctx
        .agent_config
        .workflow_params
        .get("lethality_target")
        .and_then(|v| v.as_f64())
        .unwrap_or(15.0);

    let balancing_report = if ctx.workflow_config.is_step_enabled("encounter_balancing") {
        let enc = input.encounter_test.unwrap_or_default();
        let sim = MonteCarloSimulator::simulate_standard_vs_threshold(
            enc.dice_count,
            enc.dice_sides,
            enc.modifier,
            enc.threshold,
            1000,
        );
        let lethality_pct = sim.success_rate * 100.0;
        let delta = lethality_pct - lethality_target;
        let assessment = if delta.abs() <= 10.0 {
            "Équilibré (dans la cible)"
        } else if delta > 10.0 {
            "Létalité élevée (ajuster difficulté)"
        } else {
            "Rencontre modérée"
        };
        json!({
            "estimated_rate_pct": lethality_pct,
            "target_pct": lethality_target,
            "assessment": assessment,
            "average_score": sim.average_score
        })
    } else {
        json!({ "skipped": true })
    };
    steps.push(StepTrace {
        step_id: "encounter_balancing".to_string(),
        name: "Calibrage de létalité (Monte-Carlo)".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: format!("Équilibrage calculé (cible {}%)", lethality_target),
        metadata: balancing_report.clone(),
    });

    // Step 4: Prepare manifest diff & validation payload
    let t4 = Instant::now();
    let proposed_json = serde_json::to_string_pretty(&manifest)?;
    let diff_preview = build_unified_diff(&original_str, &proposed_json);
    steps.push(StepTrace {
        step_id: "manifest_validation".to_string(),
        name: "Vérification de connexité du graphe".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t4),
        summary: "Validation topologique déléguée à la porte G3".to_string(),
        metadata: json!({ "scenes_count": manifest.scenes.len() }),
    });

    let output = json!({
        "play_id": manifest.play_id,
        "scenes_count": manifest.scenes.len(),
        "clocks_count": manifest.clocks.len(),
        "current_value": active_clock_val,
        "max_segments": active_clock_max,
        "triggered_event": triggered_event.unwrap_or_default(),
        "balancing": balancing_report,
        "manifest": manifest,
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        expected_schema: json!({
            "type": "object",
            "required": ["play_id", "scenes_count", "current_value", "max_segments", "manifest"],
            "properties": {
                "play_id": { "type": "string" },
                "scenes_count": { "type": "integer" },
                "manifest": { "type": "object" }
            }
        }),
        campaign_manifest: Some(manifest.clone()),
        mutation_proposal: Some(MutationProposal {
            action_kind: "playwright_write_manifest".to_string(),
            target_path: rel_path.clone(),
            summary: format!("Mise à jour graphe scénaristique `{}`", manifest.play_id),
            diff_preview,
            payload: json!({
                "relative_path": rel_path,
                "manifest_json": proposed_json,
            }),
        }),
        ..WorkflowOutcome::default()
    })
}

/// Persists an approved WF-05 `campaign_manifest.json` update on disk.
pub fn apply_mutation(
    theater_root: &Path,
    payload: &serde_json::Value,
) -> Result<(), OrchestratorError> {
    let rel_path = payload["relative_path"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing relative_path".into()))?;
    let manifest_json = payload["manifest_json"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing manifest_json".into()))?;

    let full_path = theater_root.join(rel_path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(full_path, manifest_json)?;
    Ok(())
}
