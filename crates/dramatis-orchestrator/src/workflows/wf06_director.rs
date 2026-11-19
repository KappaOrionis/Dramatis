use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;
use serde::Deserialize;
use serde_json::json;

use dramatis_gateway::{ChatMessage, SouffleurClient};
use dramatis_stage::{MechanicalResolution, SessionEventLogger, VoxAudioState};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::validation::MutationProposal;
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct DirectorInput {
    pub play_id: String,
    pub zone_id: String,
    pub scene_summary: String,
    pub mechanical_resolution: Option<MechanicalResolution>,
    pub gm_secrets: Vec<String>,
    pub ambient_mood: Option<String>,
}

impl Default for DirectorInput {
    fn default() -> Self {
        Self {
            play_id: "default_play".to_string(),
            zone_id: "zone_sanctuaire".to_string(),
            scene_summary: "La scène débute sous une tension palpable.".to_string(),
            mechanical_resolution: None,
            gm_secrets: Vec::new(),
            ambient_mood: None,
        }
    }
}

/// WF-06 (`dramatis.director`): Sensory framing faithful to mechanical verdicts + Vox audio + anti-leak check.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: DirectorInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-06 invalide: {}", e)))?;

    let mut steps = Vec::new();
    let narrative_style = ctx
        .agent_config
        .workflow_params
        .get("narrative_style")
        .and_then(|v| v.as_str())
        .unwrap_or("sensoriel_sombre");
    let max_paragraphs = ctx
        .agent_config
        .workflow_params
        .get("max_response_paragraphs")
        .and_then(|v| v.as_u64())
        .unwrap_or(3)
        .clamp(1, 8);

    // Step 1: Assemble scene + mechanical verdict context
    let t1 = Instant::now();
    let verdict_clause = input
        .mechanical_resolution
        .as_ref()
        .map(|r| r.deterministic_verdict.clone())
        .unwrap_or_else(|| "Aucun jet mécanique en attente.".to_string());
    let verdict_success = input
        .mechanical_resolution
        .as_ref()
        .map(|r| r.success);

    steps.push(StepTrace {
        step_id: "context_assembly".to_string(),
        name: "Assemblage scène & verdict du Légiste".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!("Zone `{}` | Verdict intégré", input.zone_id),
        metadata: json!({ "zone_id": input.zone_id, "has_verdict": input.mechanical_resolution.is_some() }),
    });

    // Step 2: Sensory narration drafting via SouffleurClient with deterministic offline fallback
    let t2 = Instant::now();
    let mut vars = HashMap::new();
    vars.insert(
        "theater_name".to_string(),
        ctx.manifest
            .map(|m| m.name.clone())
            .unwrap_or_else(|| ctx.theater_id.to_string()),
    );
    vars.insert(
        "system_preset".to_string(),
        ctx.manifest
            .map(|m| m.system_id.clone())
            .unwrap_or_else(|| "generic".to_string()),
    );
    let system_prompt = ctx.agent_config.prompts.render_system_prompt(&vars);
    let user_prompt = format!(
        "Zone: {}\nStyle narratif demandé: {} (max {} paragraphes)\nContexte public de scène: {}\nVerdict mécanique officiel à traduire fidèlement: {}\nRédige exclusivement la narration publique en français :",
        input.zone_id, narrative_style, max_paragraphs, input.scene_summary, verdict_clause
    );
    let prompt_preview = format!("[SYSTEM]\n{}\n\n[USER]\n{}", system_prompt, user_prompt);

    let theater_privacy = ctx.manifest.and_then(|m| m.privacy_mode.as_deref());
    let strict_local = ctx.agent_config.effective_strict_local(theater_privacy);
    let client = SouffleurClient::new(strict_local);
    let profile = ctx.agent_config.model.to_model_profile(None);
    let fallback_profile = ctx
        .agent_config
        .model
        .to_model_profile(Some(ctx.agent_config.model.fallback_model_id.clone()));
    let model_used = Some(profile.model_name.clone());

    let messages = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
            name: None,
        },
        ChatMessage {
            role: "user".to_string(),
            content: user_prompt,
            name: None,
        },
    ];

    let llm_timeout = std::time::Duration::from_millis(
        ctx.agent_config.guardrails.timeout_ms.max(200),
    );
    let narration = match tokio::time::timeout(
        llm_timeout,
        client.complete_with_fallback(&profile, &fallback_profile, &messages, None),
    )
    .await
    {
        Ok(Ok(text)) if !text.trim().is_empty() => text.trim().to_string(),
        _ => build_offline_director_narration(&input, &verdict_clause),
    };

    steps.push(StepTrace {
        step_id: "sensory_drafting".to_string(),
        name: "Rédaction narrative sensorielle".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: format!("Narration générée ({} car.)", narration.len()),
        metadata: json!({ "style": narrative_style }),
    });

    // Step 3: Vox Audio Cue Extraction
    let t3 = Instant::now();
    let vox_track = match input.ambient_mood.as_deref() {
        Some("combat") | Some("tension") => "tactical_tension_percussion.ogg",
        Some("arcane") | Some("mystere") => "hermetic_resonance_drone.ogg",
        _ => "nocturne_archive_loop.ogg",
    };
    let vox_state = VoxAudioState {
        active_music_track: Some(vox_track.to_string()),
        ..VoxAudioState::default()
    };
    steps.push(StepTrace {
        step_id: "audio_cue_extraction".to_string(),
        name: "Émission d'ambiance audio Vox".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: format!("Piste audio suggérée : {}", vox_track),
        metadata: json!({ "track": vox_track }),
    });

    // Step 4: Leak Check preparation
    let t4 = Instant::now();
    steps.push(StepTrace {
        step_id: "leak_check".to_string(),
        name: "Contrôle anti-fuite secrets MJ".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t4),
        summary: format!("{} secret(s) MJ surveillé(s) pour G2", input.gm_secrets.len()),
        metadata: json!({ "forbidden_secrets_count": input.gm_secrets.len() }),
    });

    let rel_log_path = format!("05_plays/{}/session_logs.jsonl", input.play_id);
    let output = json!({
        "broadcasted": true,
        "channel": format!("zone:{}", input.zone_id),
        "zone_id": input.zone_id,
        "narration": narration,
        "verdict_success": verdict_success,
        "vox_audio": vox_state,
    });

    let mutation_proposal = Some(MutationProposal {
        action_kind: "director_append_log".to_string(),
        target_path: rel_log_path.clone(),
        summary: format!("Publication narration publique dans `{}`", input.zone_id),
        diff_preview: format!("+ [{}] {}", input.zone_id, narration),
        payload: json!({
            "relative_path": rel_log_path,
            "channel": format!("zone:{}", input.zone_id),
            "narration": narration,
        }),
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        model_used,
        prompt_preview: Some(prompt_preview),
        expected_schema: json!({
            "type": "object",
            "required": ["broadcasted", "channel", "narration"],
            "properties": {
                "broadcasted": { "type": "boolean" },
                "channel": { "type": "string" },
                "narration": { "type": "string" }
            }
        }),
        forbidden_secrets: input.gm_secrets,
        mechanical_resolution: input.mechanical_resolution,
        mutation_proposal,
        ..WorkflowOutcome::default()
    })
}

/// Appends an approved narration event to `/05_plays/{play_id}/session_logs.jsonl`.
pub fn apply_mutation(
    theater_root: &Path,
    payload: &serde_json::Value,
) -> Result<(), OrchestratorError> {
    let rel_path = payload["relative_path"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing relative_path".into()))?;
    let channel = payload["channel"].as_str().unwrap_or("zone:default");
    let narration = payload["narration"].as_str().unwrap_or("");
    let full_path = theater_root.join(rel_path);

    SessionEventLogger::append_event(
        &full_path,
        "narration",
        "dramatis.director",
        channel,
        narration,
        payload.clone(),
    )
    .map_err(|e| OrchestratorError::Execution(format!("Erreur log session: {}", e)))?;

    Ok(())
}

fn build_offline_director_narration(input: &DirectorInput, verdict_clause: &str) -> String {
    if let Some(res) = &input.mechanical_resolution {
        if res.success {
            format!(
                "Dans le secteur {}, la situation bascule nettement en faveur de l'action engagée. {} {}",
                input.zone_id, input.scene_summary, verdict_clause
            )
        } else {
            format!(
                "Dans le secteur {}, la tentative rencontre une résistance inattendue et tourne court. {} {}",
                input.zone_id, input.scene_summary, verdict_clause
            )
        }
    } else {
        format!(
            "Dans le secteur {}, l'atmosphère se resserre : {}",
            input.zone_id, input.scene_summary
        )
    }
}
