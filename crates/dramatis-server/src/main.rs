use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode, Uri},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

use dramatis_core::persona::{HealthMonitor, PersonaState};
use dramatis_core::theater::{TheaterManifest, TheaterWorkspace};
use dramatis_machina::{ArsMagicaStressResult, DiceEngine, DiceRollResult, MonteCarloSimulator, MonteCarloSummary, ShadowrunPoolResult};
use dramatis_stage::{ChannelType, SceneTopology, StageChannelRouter, TacticalTag, TacticalZone, ZoneId};

#[derive(RustEmbed)]
#[folder = "../../web-ui/dist/"]
struct Asset;

#[derive(Clone)]
pub struct AppState {
    pub workspaces_root: PathBuf,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub product: &'static str,
}

#[derive(Deserialize)]
pub struct RollStandardRequest {
    pub count: usize,
    pub sides: u32,
    pub modifier: i64,
}

#[derive(Deserialize)]
pub struct RollShadowrunRequest {
    pub pool_size: usize,
}

#[derive(Deserialize)]
pub struct RollArsMagicaRequest {
    pub botch_dice: usize,
}

#[derive(Deserialize)]
pub struct SimulateStandardRequest {
    pub count: usize,
    pub sides: u32,
    pub modifier: i64,
    pub threshold: i64,
    pub iterations: Option<usize>,
}

async fn roll_standard_handler(
    Json(payload): Json<RollStandardRequest>,
) -> Json<DiceRollResult> {
    let res = DiceEngine::roll_standard(payload.count, payload.sides, payload.modifier);
    Json(res)
}

async fn roll_shadowrun_handler(
    Json(payload): Json<RollShadowrunRequest>,
) -> Json<ShadowrunPoolResult> {
    let res = DiceEngine::roll_shadowrun(payload.pool_size);
    Json(res)
}

async fn roll_ars_magica_handler(
    Json(payload): Json<RollArsMagicaRequest>,
) -> Json<ArsMagicaStressResult> {
    let res = DiceEngine::roll_ars_magica_stress(payload.botch_dice);
    Json(res)
}

async fn simulate_standard_handler(
    Json(payload): Json<SimulateStandardRequest>,
) -> Json<MonteCarloSummary> {
    let iters = payload.iterations.unwrap_or(10_000);
    let summary = MonteCarloSimulator::simulate_standard_vs_threshold(
        payload.count,
        payload.sides,
        payload.modifier,
        payload.threshold,
        iters,
    );
    Json(summary)
}

#[derive(Deserialize)]
pub struct FilterMessageRequest {
    pub channel: ChannelType,
    pub recipient_id: String,
    pub is_gm: bool,
}

#[derive(Serialize)]
pub struct FilterMessageResponse {
    pub allowed: bool,
}

async fn get_default_scene_topology_handler() -> Json<SceneTopology> {
    let mut topo = SceneTopology::default();
    topo.add_zone(TacticalZone {
        id: ZoneId("zone_hall".to_string()),
        title: "Grand Hall de l'Alliance".to_string(),
        description: "Vaste salle bordée de tapisseries et de colonnes de marbre.".to_string(),
        connected_zones: vec![ZoneId("zone_lab".to_string()), ZoneId("zone_library".to_string())],
        tags: vec![TacticalTag {
            name: "Aura Hermétique 5".to_string(),
            modifier_type: "aura".to_string(),
            value: 5,
        }],
    });

    topo.add_zone(TacticalZone {
        id: ZoneId("zone_lab".to_string()),
        title: "Laboratoire Hermétique".to_string(),
        description: "Laboratoire encombré d'alambics et de fourneaux.".to_string(),
        connected_zones: vec![ZoneId("zone_hall".to_string())],
        tags: vec![TacticalTag {
            name: "Qualité +3".to_string(),
            modifier_type: "lab_quality".to_string(),
            value: 3,
        }],
    });

    topo.add_zone(TacticalZone {
        id: ZoneId("zone_library".to_string()),
        title: "Bibliothèque Hermétique".to_string(),
        description: "Rayonnages contenant les précieux Summae et Tractatus.".to_string(),
        connected_zones: vec![ZoneId("zone_hall".to_string())],
        tags: vec![TacticalTag {
            name: "Silence Sacré".to_string(),
            modifier_type: "noise_filter".to_string(),
            value: 2,
        }],
    });

    Json(topo)
}

async fn filter_stage_message_handler(
    Json(payload): Json<FilterMessageRequest>,
) -> Json<FilterMessageResponse> {
    let allowed = StageChannelRouter::is_recipient_allowed(
        &payload.channel,
        &payload.recipient_id,
        payload.is_gm,
    );
    Json(FilterMessageResponse { allowed })
}

#[derive(Deserialize)]
pub struct CreatePersonaRequest {
    pub id: String,
    pub name: String,
    pub system: String,
    pub archetype: Option<String>,
}

async fn list_personae_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<PersonaState>>, StatusCode> {
    let dir_name = if id.ends_with(".dramatis") {
        id
    } else {
        format!("{}.dramatis", id)
    };

    let personae_dir = state.workspaces_root.join(dir_name).join("03_personae");
    let mut list = Vec::new();

    if let Ok(entries) = std::fs::read_dir(personae_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(persona) = serde_json::from_str::<PersonaState>(&content) {
                        list.push(persona);
                    }
                }
            }
        }
    }

    Ok(Json(list))
}

async fn create_persona_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<CreatePersonaRequest>,
) -> Result<Json<PersonaState>, StatusCode> {
    let dir_name = if id.ends_with(".dramatis") {
        id
    } else {
        format!("{}.dramatis", id)
    };

    let personae_dir = state.workspaces_root.join(dir_name).join("03_personae");
    std::fs::create_dir_all(&personae_dir).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut persona = PersonaState::new(&payload.id, &payload.name, &payload.system);
    persona.archetype = payload.archetype;

    // Initialiser des moniteurs par défaut selon le système
    if payload.system.contains("shadowrun") {
        persona.health_monitors.push(HealthMonitor {
            name: "Physique".to_string(),
            max_boxes: 10,
            current_damage: 0,
            penalty: 0,
        });
        persona.health_monitors.push(HealthMonitor {
            name: "Étourdissant".to_string(),
            max_boxes: 10,
            current_damage: 0,
            penalty: 0,
        });
    } else {
        persona.health_monitors.push(HealthMonitor {
            name: "Blessures".to_string(),
            max_boxes: 12,
            current_damage: 0,
            penalty: 0,
        });
    }

    let json_content = serde_json::to_string_pretty(&persona).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let md_content = persona.to_markdown();

    std::fs::write(personae_dir.join(format!("{}.persona.json", payload.id)), json_content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    std::fs::write(personae_dir.join(format!("{}.persona.md", payload.id)), md_content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(persona))
}

#[derive(Deserialize)]
pub struct CreateTheaterRequest {
    pub id: String,
    pub manifest: Option<TheaterManifest>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,dramatis_server=debug".into()),
        )
        .init();

    let workspaces_root = PathBuf::from("./workspaces");
    std::fs::create_dir_all(&workspaces_root)?;

    let state = Arc::new(AppState { workspaces_root });

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/theaters", post(create_theater_handler).get(list_theaters_handler))
        .route("/api/theaters/{id}", get(get_theater_handler))
        .route("/api/machina/roll/standard", post(roll_standard_handler))
        .route("/api/machina/roll/shadowrun", post(roll_shadowrun_handler))
        .route("/api/machina/roll/ars-magica", post(roll_ars_magica_handler))
        .route("/api/machina/simulate/standard", post(simulate_standard_handler))
        .route("/api/theaters/{id}/personae", post(create_persona_handler).get(list_personae_handler))
        .route("/api/stage/scene/default", get(get_default_scene_topology_handler))
        .route("/api/stage/channels/filter", post(filter_stage_message_handler))
        .fallback(static_handler)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 4780));
    info!("🎭 Dramatis Daemon (dramatisd) v2.1.0 listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = uri.path().trim_start_matches('/').to_string();

    if path.is_empty() {
        path = "index.html".to_string();
    }

    match Asset::get(&path) {
        Some(content) => {
            let mime = mime_guess::from_path(&path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            // Fallback SPA vers index.html
            match Asset::get("index.html") {
                Some(content) => {
                    ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], content.data).into_response()
                }
                None => (StatusCode::NOT_FOUND, "Not Found").into_response(),
            }
        }
    }
}

async fn health_handler() -> impl IntoResponse {
    Json(HealthResponse {
        status: "healthy",
        version: "2.1.0",
        product: "Dramatis (The Agentic Tabletop RPG Harness)",
    })
}

async fn list_theaters_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, StatusCode> {
    let mut list = Vec::new();
    let entries = std::fs::read_dir(&state.workspaces_root).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if file_type.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".dramatis") {
                    list.push(name);
                }
            }
        }
    }

    Ok(Json(list))
}

async fn create_theater_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTheaterRequest>,
) -> Result<Json<TheaterManifest>, StatusCode> {
    let dir_name = if payload.id.ends_with(".dramatis") {
        payload.id
    } else {
        format!("{}.dramatis", payload.id)
    };

    let theater_path = state.workspaces_root.join(&dir_name);
    let manifest = payload.manifest.unwrap_or_default();

    TheaterWorkspace::create_new(&theater_path, manifest.clone())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(manifest))
}

async fn get_theater_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TheaterManifest>, StatusCode> {
    let dir_name = if id.ends_with(".dramatis") {
        id
    } else {
        format!("{}.dramatis", id)
    };

    let theater_path = state.workspaces_root.join(dir_name);
    let ws = TheaterWorkspace::open(theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(ws.manifest))
}
