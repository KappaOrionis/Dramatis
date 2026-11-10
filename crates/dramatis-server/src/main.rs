use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::info;

use dramatis_core::theater::{TheaterManifest, TheaterWorkspace};

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
        .route("/", get(home_handler))
        .route("/health", get(health_handler))
        .route("/api/theaters", post(create_theater_handler).get(list_theaters_handler))
        .route("/api/theaters/{id}", get(get_theater_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 4780));
    info!("🎭 Dramatis Daemon (dramatisd) v2.1.0 listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn home_handler() -> impl IntoResponse {
    Html(r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DRAMATIS — Agentic Tabletop RPG Harness</title>
    <style>
        :root {
            --canvas: #0B0C10;
            --surface: #14161D;
            --surface-elevated: #1C1F2A;
            --border: rgba(255, 255, 255, 0.08);
            --gold: #D4AF37;
            --amber: #FF9F1C;
            --teal: #00F0FF;
            --purple: #A855F7;
            --text-main: #F3F4F6;
            --text-muted: #9CA3AF;
            --green: #10B981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: var(--canvas);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            height: 56px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
        }
        .brand {
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            color: var(--gold);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .badge {
            background: rgba(16, 185, 129, 0.15);
            color: var(--green);
            border: 1px solid rgba(16, 185, 129, 0.4);
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .badge::before {
            content: "";
            width: 8px;
            height: 8px;
            background: var(--green);
            border-radius: 50%;
            display: inline-block;
        }
        main {
            flex: 1;
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding: 40px 24px;
        }
        .hero {
            text-align: center;
            margin-bottom: 48px;
        }
        .hero h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 12px;
            background: linear-gradient(135deg, var(--gold), #FFF);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .hero p {
            color: var(--text-muted);
            font-size: 1.1rem;
            max-width: 650px;
            margin: 0 auto;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px;
            transition: transform 0.2s, border-color 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            border-color: rgba(212, 175, 55, 0.35);
        }
        .card h3 {
            font-size: 1.15rem;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card p {
            font-size: 0.9rem;
            color: var(--text-muted);
            line-height: 1.5;
        }
        .card-amber h3 { color: var(--amber); }
        .card-teal h3 { color: var(--teal); }
        .card-gold h3 { color: var(--gold); }
        .card-purple h3 { color: var(--purple); }
        .console {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 24px;
        }
        .console h2 {
            font-size: 1.25rem;
            margin-bottom: 16px;
            color: var(--text-main);
        }
        .action-row {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }
        input {
            flex: 1;
            background: var(--surface-elevated);
            border: 1px solid var(--border);
            color: var(--text-main);
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 0.95rem;
            outline: none;
        }
        input:focus { border-color: var(--gold); }
        button {
            background: var(--gold);
            color: #000;
            font-weight: 700;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            transition: opacity 0.15s;
        }
        button:hover { opacity: 0.9; }
        .theaters-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .theaters-list li {
            background: var(--surface-elevated);
            border: 1px solid var(--border);
            padding: 12px 16px;
            border-radius: 6px;
            font-family: monospace;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <header>
        <div class="brand">🎭 DRAMATIS</div>
        <div class="badge">DAEMON ONLINE (v2.1.0)</div>
    </header>
    <main>
        <div class="hero">
            <h1>The Agentic Tabletop RPG Harness</h1>
            <p>Narration vs Machina : La plume pour l'esprit, l'acier pour la loi.</p>
        </div>

        <div class="grid">
            <div class="card card-gold">
                <h3>📖 TheaterExplorer</h3>
                <p>Gestionnaire de Théâtres .dramatis, ingestion de lore multimodale et Wiki relationnel sous Git.</p>
            </div>
            <div class="card card-amber">
                <h3>⚙️ RulesLab</h3>
                <p>Moteur Machina déterministe (Rhai, SQLite, Stress Dice, D6 pools) et simulateur Monte-Carlo.</p>
            </div>
            <div class="card card-teal">
                <h3>🛡️ PersonaForge</h3>
                <p>Création assistée (Ars Magica, SR6, Anastasius), Essence, Alliances, artisanat et coffre de groupe.</p>
            </div>
            <div class="card card-purple">
                <h3>🎲 StageTable</h3>
                <p>Régie de session, brouillard 3D, apartés privés StageChannels et console de supervision MJ.</p>
            </div>
        </div>

        <div class="console">
            <h2>Univers Actifs (Théâtres Détectés)</h2>
            <div class="action-row">
                <input type="text" id="theaterId" placeholder="Nom de l'univers (ex: ars-magica-5e, shadowrun-6e)...">
                <button onclick="createTheater()">Initialiser un Théâtre</button>
            </div>
            <ul id="theatersList" class="theaters-list">
                <li style="color: var(--text-muted); justify-content: center;">Chargement des univers...</li>
            </ul>
        </div>
    </main>

    <script>
        async function loadTheaters() {
            try {
                const res = await fetch('/api/theaters');
                const list = await res.json();
                const container = document.getElementById('theatersList');
                if (list.length === 0) {
                    container.innerHTML = '<li style="color: var(--text-muted); justify-content: center;">Aucun univers initialisé. Utilisez le champ ci-dessus pour en créer un.</li>';
                    return;
                }
                container.innerHTML = list.map(t => `<li><span>🎭 ${t}</span><span style="color: var(--green); font-size: 0.8rem;">● DISPONIBLE</span></li>`).join('');
            } catch (e) {
                console.error(e);
            }
        }

        async function createTheater() {
            const input = document.getElementById('theaterId');
            const val = input.value.trim();
            if (!val) return;
            try {
                await fetch('/api/theaters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: val })
                });
                input.value = '';
                await loadTheaters();
            } catch (e) {
                alert('Erreur lors de la création : ' + e);
            }
        }

        loadTheaters();
    </script>
</body>
</html>"#)
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
