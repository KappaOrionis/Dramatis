use std::collections::HashMap;
use std::time::Instant;
use serde::Deserialize;
use serde_json::json;

use dramatis_core::{EpistemicFilter, Role};
use dramatis_gateway::{ChatMessage, SouffleurClient};
use dramatis_stage::{AgentContextView, RealityPlane, ZoneId};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct SceneEventInput {
    pub zone_id: String,
    pub plane: RealityPlane,
    pub is_gm_only: bool,
    pub content: String,
}

impl Default for SceneEventInput {
    fn default() -> Self {
        Self {
            zone_id: "room_a".to_string(),
            plane: RealityPlane::Physical,
            is_gm_only: false,
            content: String::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct ActorInput {
    pub actor_id: String,
    pub actor_name: String,
    pub current_zone: String,
    pub active_plane: RealityPlane,
    pub visible_zones: Vec<String>,
    pub known_secrets: Vec<String>,
    pub scene_events: Vec<SceneEventInput>,
    pub prompt: String,
    pub requested_action_expression: Option<String>,
}

impl Default for ActorInput {
    fn default() -> Self {
        Self {
            actor_id: "actor_bot_1".to_string(),
            actor_name: "Compagnon".to_string(),
            current_zone: "room_a".to_string(),
            active_plane: RealityPlane::Physical,
            visible_zones: Vec::new(),
            known_secrets: Vec::new(),
            scene_events: Vec::new(),
            prompt: "Réagis à la situation actuelle.".to_string(),
            requested_action_expression: None,
        }
    }
}

/// WF-07 (`dramatis.actor`): In-character reaction strictly filtered by 3D Fog of War (`AgentContextView`).
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: ActorInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-07 invalide: {}", e)))?;

    let mut steps = Vec::new();

    // Step 1: Build AgentContextView & strictly filter events (Cognitive, Spatial, Planar)
    let t1 = Instant::now();
    let actor_view = AgentContextView {
        actor_id: input.actor_id.clone(),
        actor_name: input.actor_name.clone(),
        is_gm: false,
        current_zone: ZoneId(input.current_zone.clone()),
        active_plane: input.active_plane,
        visible_zones: input.visible_zones.iter().cloned().map(ZoneId).collect(),
        known_secrets: input.known_secrets.clone(),
        relationship_gauges: HashMap::new(),
    };

    let mut perceived_events = Vec::new();
    let mut blocked_secrets = Vec::new();
    let mut perceived_zones = vec![input.current_zone.clone()];

    for ev in &input.scene_events {
        let ev_zone = ZoneId(ev.zone_id.clone());
        if actor_view.can_perceive_event(&ev_zone, ev.plane, ev.is_gm_only) {
            let clean = EpistemicFilter::sanitize_markdown(
                &ev.content,
                Role::Player,
                Some(&input.actor_id),
            );
            if !clean.trim().is_empty() {
                perceived_events.push(format!("[{}] {}", ev.zone_id, clean));
                if !perceived_zones.contains(&ev.zone_id) {
                    perceived_zones.push(ev.zone_id.clone());
                }
            }
        } else {
            let trimmed = ev.content.trim();
            if !trimmed.is_empty() {
                blocked_secrets.push(trimmed.to_string());
            }
        }
    }

    steps.push(StepTrace {
        step_id: "fog_filter".to_string(),
        name: "Filtrage tri-dimensionnel AgentContextView".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!(
            "{} événement(s) perçu(s), {} bloqué(s) par le brouillard",
            perceived_events.len(),
            blocked_secrets.len()
        ),
        metadata: json!({
            "perceived_count": perceived_events.len(),
            "blocked_count": blocked_secrets.len(),
            "active_plane": input.active_plane
        }),
    });

    // Step 2: Episodic recall from actor persona sheet if available
    let t2 = Instant::now();
    let persona_path = ctx
        .theater_root
        .join("03_personae")
        .join(format!("{}.json", input.actor_id));
    let persona_summary = if persona_path.exists() {
        std::fs::read_to_string(&persona_path).ok()
    } else {
        None
    };
    steps.push(StepTrace {
        step_id: "episodic_recall".to_string(),
        name: "Lecture mémoire & fiche personnage".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: if persona_summary.is_some() {
            format!("Fiche `{}` chargée", input.actor_id)
        } else {
            "Aucune fiche JSON dédiée (profil éphémère)".to_string()
        },
        metadata: json!({ "has_persona_sheet": persona_summary.is_some() }),
    });

    // Step 3: In-character reaction (SouffleurClient or offline RP response)
    let t3 = Instant::now();
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
    let perceived_block = if perceived_events.is_empty() {
        "Aucun événement notable perçu dans votre champ sensoriel actuel.".to_string()
    } else {
        perceived_events.join("\n")
    };
    let user_prompt = format!(
        "Personnage : {} (Zone: {}, Plan: {:?})\nPerceptions filtrées :\n{}\n\nConsigne : {}\nRéponds en français uniquement dans le rôle du personnage :",
        input.actor_name, input.current_zone, input.active_plane, perceived_block, input.prompt
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
    let dialogue = match tokio::time::timeout(
        llm_timeout,
        client.complete_with_fallback(&profile, &fallback_profile, &messages, None),
    )
    .await
    {
        Ok(Ok(text)) if !text.trim().is_empty() => text.trim().to_string(),
        _ => build_offline_actor_dialogue(&input, &perceived_events),
    };

    steps.push(StepTrace {
        step_id: "in_character_reaction".to_string(),
        name: "Génération réplique & intention".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: format!("Réplique générée pour {}", input.actor_name),
        metadata: json!({ "perceived_events": perceived_events.len() }),
    });

    // Step 4: Handoff mechanical intention to Arbiter (WF-03) if requested
    let t4 = Instant::now();
    let emit_intent = ctx
        .agent_config
        .workflow_params
        .get("emit_mechanical_intent")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let mechanical_intent = if emit_intent {
        input.requested_action_expression.as_ref().map(|expr| {
            json!({
                "target_workflow": "WF-03",
                "actor_id": input.actor_id,
                "action_type": "ActorDeclaredAction",
                "skill_expression": expr,
            })
        })
    } else {
        None
    };

    let requires_arbiter = mechanical_intent.is_some();
    steps.push(StepTrace {
        step_id: "handoff_to_arbiter".to_string(),
        name: "Routage vers WF-03 si intention mécanique".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t4),
        summary: if requires_arbiter {
            "Intention mécanique préparée pour WF-03".to_string()
        } else {
            "Tour purement narratif".to_string()
        },
        metadata: json!({ "requires_arbiter": requires_arbiter }),
    });

    let output = json!({
        "accepted": true,
        "actor_id": input.actor_id,
        "actor_name": input.actor_name,
        "dialogue": dialogue,
        "perceived_events": perceived_events,
        "perceived_zones": perceived_zones,
        "blocked_by_fog_count": blocked_secrets.len(),
        "requires_arbiter": requires_arbiter,
        "mechanical_intent": mechanical_intent,
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        model_used,
        prompt_preview: Some(prompt_preview),
        expected_schema: json!({
            "type": "object",
            "required": ["accepted", "dialogue", "requires_arbiter"],
            "properties": {
                "accepted": { "type": "boolean" },
                "dialogue": { "type": "string" },
                "requires_arbiter": { "type": "boolean" }
            }
        }),
        forbidden_secrets: blocked_secrets,
        actor_view: Some(actor_view),
        ..WorkflowOutcome::default()
    })
}

fn build_offline_actor_dialogue(input: &ActorInput, perceived_events: &[String]) -> String {
    if perceived_events.is_empty() {
        format!(
            "{} observe attentivement {} : « Rien d'anormal en vue sur ce plan pour l'instant, restons vigilants. »",
            input.actor_name, input.current_zone
        )
    } else {
        format!(
            "{} réagit depuis {} face à ce qu'il perçoit : « {} »",
            input.actor_name, input.current_zone, perceived_events[0]
        )
    }
}
