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

use dramatis_core::theater::{TheaterManifest, TheaterWorkspace};

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
