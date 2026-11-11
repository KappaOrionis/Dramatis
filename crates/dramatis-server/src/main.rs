use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    extract::{DefaultBodyLimit, Path, Query, State},
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

use dramatis_gateway::{
    client::SouffleurClient,
    types::{ChatMessage, ModelProfile},
};

use dramatis_core::{
    acl::Role,
    alliance::{AllianceState, DowntimeActivity, DowntimeEngine, DowntimeResolutionResult},
    artificer::{ArtificerEngine, HermeticCraftInput, HermeticCraftVerdict},
    creation::{ArsMagicaCreationInput, CharacterCreationEngine, CreationValidationResult, ShadowrunPriorityInput},
    epistemic::EpistemicFilter,
    ledger::PartyLedger,
    mcp::{McpRegistry, McpToolSpec},
    persona::{HealthMonitor, PersonaState},
    psyche::{NegotiationLimits, PsycheProfile, VoiceConfig},
    snapshot::TheaterSnapshotManager,
    theater::{TheaterManifest, TheaterWorkspace},
};
use dramatis_ingest::{
    MarkdownDocParser, ReconciliationDiffEngine, SectionNode, TableDiffReport,
};
use dramatis_machina::{
    AdvancedDiceParser, AdvancedRollResult, ArsMagicaStressResult, DiceEngine, DiceRollResult,
    EdgeEvaluationInput, EdgeEvaluationResult, MonteCarloSimulator, MonteCarloSummary,
    RhaiSandbox, ShadowrunPoolResult, SystemSchema, TacticalEdgeEngine,
};
use dramatis_rag::{
    ArchivistAgent, ArchivistVerdict, AutoWikilinker, CampaignChronicler, Citation,
    EntityResolutionResult, EntityResolver, HybridSearchEngine, HybridSearchResult,
    MysteriesBoard, NonDestructiveWikiPatcher, SessionDebrief,
};
use dramatis_stage::{
    ChannelType, DeterministicInterceptionEngine, InterceptionHook,
    InterceptionVerdict, MechanicalIntention, MechanicalResolution,
    SceneTopology, SessionEventLogger, SessionLogEntry,
    StageChannelRouter, StageResolutionGate, TacticalTag, TacticalZone,
    ZoneId,
};

#[derive(RustEmbed)]
#[folder = "../../web-ui/dist/"]
struct Asset;

#[derive(Clone)]
pub struct AppState {
    pub workspaces_root: PathBuf,
}

fn normalize_theater_dir(id: &str) -> String {
    if id.ends_with(".dramatis") {
        id.to_string()
    } else {
        format!("{}.dramatis", id)
    }
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub product: &'static str,
}

// ============================================================================
// MODULE 4 : MACHINA & DICE HANDLERS
// ============================================================================

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
pub struct RollExpressionRequest {
    pub expression: String,
}

#[derive(Deserialize)]
pub struct SimulateStandardRequest {
    pub count: usize,
    pub sides: u32,
    pub modifier: i64,
    pub threshold: i64,
    pub iterations: Option<usize>,
}

#[derive(Deserialize)]
pub struct SimulateShadowrunRequest {
    pub pool_size: usize,
    pub threshold_hits: usize,
    pub iterations: Option<usize>,
}

#[derive(Deserialize)]
pub struct EvaluateRhaiRequest {
    pub script: String,
    #[serde(default)]
    pub variables: HashMap<String, i64>,
}

#[derive(Serialize)]
pub struct EvaluateRhaiResponse {
    pub result: i64,
    pub script: String,
}

async fn roll_standard_handler(
    Json(payload): Json<RollStandardRequest>,
) -> Json<DiceRollResult> {
    Json(DiceEngine::roll_standard(payload.count, payload.sides, payload.modifier))
}

async fn roll_shadowrun_handler(
    Json(payload): Json<RollShadowrunRequest>,
) -> Json<ShadowrunPoolResult> {
    Json(DiceEngine::roll_shadowrun(payload.pool_size))
}

async fn roll_ars_magica_handler(
    Json(payload): Json<RollArsMagicaRequest>,
) -> Json<ArsMagicaStressResult> {
    Json(DiceEngine::roll_ars_magica_stress(payload.botch_dice))
}

async fn roll_expression_handler(
    Json(payload): Json<RollExpressionRequest>,
) -> Result<Json<AdvancedRollResult>, StatusCode> {
    let res = AdvancedDiceParser::parse_and_roll(&payload.expression)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(res))
}

async fn simulate_standard_handler(
    Json(payload): Json<SimulateStandardRequest>,
) -> Json<MonteCarloSummary> {
    let iters = payload.iterations.unwrap_or(10_000);
    Json(MonteCarloSimulator::simulate_standard_vs_threshold(
        payload.count,
        payload.sides,
        payload.modifier,
        payload.threshold,
        iters,
    ))
}

async fn simulate_shadowrun_handler(
    Json(payload): Json<SimulateShadowrunRequest>,
) -> Json<MonteCarloSummary> {
    let iters = payload.iterations.unwrap_or(10_000);
    Json(MonteCarloSimulator::simulate_shadowrun_hits(
        payload.pool_size,
        payload.threshold_hits,
        iters,
    ))
}

async fn evaluate_tactical_edge_handler(
    Json(payload): Json<EdgeEvaluationInput>,
) -> Json<EdgeEvaluationResult> {
    Json(TacticalEdgeEngine::evaluate_edge(&payload))
}

async fn evaluate_rhai_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<EvaluateRhaiRequest>,
) -> Result<Json<EvaluateRhaiResponse>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let tables_db = theater_path.join("02_machina/tables.sqlite");
    let sandbox = RhaiSandbox::with_sqlite_tables(tables_db);
    let mut scope = rhai::Scope::new();
    for (k, v) in payload.variables {
        scope.push(k, v);
    }
    let result: i64 = sandbox
        .evaluate_formula(&payload.script, scope)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(EvaluateRhaiResponse {
        result,
        script: payload.script,
    }))
}

async fn get_system_schema_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<SystemSchema>, StatusCode> {
    let schema_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("02_machina/system_schema.json");
    if schema_path.exists() {
        let schema = SystemSchema::load_from_file(&schema_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(Json(schema))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Serialize)]
pub struct SqlTableCatalogEntry {
    pub table_name: String,
    pub description: String,
    pub ddl_schema: String,
    pub proxy_markdown: String,
    pub row_count: i64,
}

async fn list_sql_tables_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<SqlTableCatalogEntry>>, StatusCode> {
    let tables_db = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("02_machina/tables.sqlite");
    if !tables_db.exists() {
        return Ok(Json(Vec::new()));
    }
    let conn = rusqlite::Connection::open(tables_db).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut stmt = conn
        .prepare("SELECT table_name, COALESCE(description,''), COALESCE(ddl_schema,''), COALESCE(proxy_markdown,''), row_count FROM table_metadata")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(SqlTableCatalogEntry {
                table_name: r.get(0)?,
                description: r.get(1)?,
                ddl_schema: r.get(2)?,
                proxy_markdown: r.get(3)?,
                row_count: r.get(4)?,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut out = Vec::new();
    for r in rows.flatten() {
        out.push(r);
    }
    Ok(Json(out))
}

// ============================================================================
// MODULE 1 : THEATER, SNAPSHOTS, CHRONOS & HANDOUT EXPORTS
// ============================================================================

#[derive(Deserialize)]
pub struct CreateTheaterRequest {
    pub id: String,
    pub manifest: Option<TheaterManifest>,
}

#[derive(Deserialize)]
pub struct CreateSnapshotRequest {
    pub message: String,
}

#[derive(Deserialize)]
pub struct RollbackSnapshotRequest {
    pub commit_hash: String,
}

#[derive(Serialize)]
pub struct SnapshotEntry {
    pub commit_hash: String,
    pub message: String,
}

#[derive(Deserialize)]
pub struct ExportHandoutRequest {
    pub title: String,
    pub markdown_content: String,
    pub role: Role,
    pub actor_id: Option<String>,
}

#[derive(Serialize)]
pub struct ExportHandoutResponse {
    pub html: String,
    pub sanitized_markdown: String,
}

#[derive(Deserialize)]
pub struct AdvanceChronosRequest {
    pub mode: String, // "rounds", "seconds", "season"
    pub amount: Option<u32>,
}

async fn list_snapshots_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<SnapshotEntry>>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let mgr = TheaterSnapshotManager::new(theater_path);
    let raw = mgr.list_snapshots(25).unwrap_or_default();
    let entries = raw
        .into_iter()
        .map(|(commit_hash, message)| SnapshotEntry { commit_hash, message })
        .collect();
    Ok(Json(entries))
}

async fn create_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<CreateSnapshotRequest>,
) -> Result<Json<SnapshotEntry>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let mgr = TheaterSnapshotManager::new(theater_path);
    let commit_hash = mgr
        .create_snapshot(&payload.message)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(SnapshotEntry {
        commit_hash,
        message: payload.message,
    }))
}

async fn rollback_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<RollbackSnapshotRequest>,
) -> Result<StatusCode, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let mgr = TheaterSnapshotManager::new(theater_path);
    mgr.rollback_to(&payload.commit_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::OK)
}

async fn export_handout_handler(
    Json(payload): Json<ExportHandoutRequest>,
) -> Json<ExportHandoutResponse> {
    let sanitized_markdown = EpistemicFilter::sanitize_markdown(
        &payload.markdown_content,
        payload.role,
        payload.actor_id.as_deref(),
    );
    let html = EpistemicFilter::render_handout_html(
        &payload.title,
        &payload.markdown_content,
        payload.role,
        payload.actor_id.as_deref(),
    );
    Json(ExportHandoutResponse {
        html,
        sanitized_markdown,
    })
}

async fn advance_chronos_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<AdvanceChronosRequest>,
) -> Result<Json<TheaterManifest>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let mut ws = TheaterWorkspace::open(&theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    match payload.mode.as_str() {
        "season" => {
            ws.manifest.chronos.advance_season();
        }
        "seconds" => {
            ws.manifest
                .chronos
                .advance_seconds(payload.amount.unwrap_or(60) as i64);
        }
        _ => {
            ws.manifest
                .chronos
                .advance_rounds(payload.amount.unwrap_or(1));
        }
    }

    let yaml = serde_yaml::to_string(&ws.manifest).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    std::fs::write(theater_path.join("theater.yaml"), yaml)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ws.manifest))
}

// ============================================================================
// MODULE 2 & 3 : INGEST, WIKI, HYBRID RAG & ARCHIVIST / CHRONICLER
// ============================================================================

#[derive(Deserialize)]
pub struct IngestMarkdownRequest {
    pub doc_id: String,
    pub title: String,
    pub category: String,
    pub markdown_content: String,
}

#[derive(Deserialize)]
pub struct UploadSourceRequest {
    pub file_name: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct UploadSourceResponse {
    pub file_name: String,
    pub relative_path: String,
    pub size_bytes: usize,
    pub sections_indexed: usize,
    pub resolution: String,
}

#[derive(Serialize)]
pub struct IngestMarkdownResponse {
    pub doc_id: String,
    pub sections_extracted: usize,
    pub tables_extracted: usize,
    pub resolution: String,
    pub wikilinked_preview: String,
}

#[derive(Deserialize)]
pub struct PatchWikiSectionRequest {
    pub relative_path: String,
    pub section_heading: String,
    pub new_content: String,
}

#[derive(Deserialize)]
pub struct HybridSearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct ArchivistQueryRequest {
    pub query: String,
    pub selected_sources: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct WikiNoteEntry {
    pub slug: String,
    pub category: String,
    pub relative_path: String,
    pub content: String,
}

async fn ingest_markdown_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<IngestMarkdownRequest>,
) -> Result<Json<IngestMarkdownResponse>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let _ws = TheaterWorkspace::open(&theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    let sections: Vec<SectionNode> = MarkdownDocParser::parse(&payload.markdown_content);
    let tables_count: usize = sections.iter().map(|s| s.tables.len()).sum();

    let kg_path = theater_path.join("04_index/knowledge_graph.sqlite");
    let res = EntityResolver::resolve(&kg_path, &payload.title, &[])
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let resolution_label = match &res {
        EntityResolutionResult::MergeWithExisting { canonical_title, score, .. } => {
            format!("MergeWithExisting ({}, score {:.2})", canonical_title, score)
        }
        EntityResolutionResult::CreateNew { proposed_title } => {
            format!("CreateNew ({})", proposed_title)
        }
        EntityResolutionResult::HumanReviewRequired { candidate_title, score, .. } => {
            format!("HumanReviewRequired ({}, score {:.2})", candidate_title, score)
        }
    };

    // Index in HybridSearchEngine & Knowledge Graph
    let index_dir = theater_path.join("04_index");
    let mut engine = HybridSearchEngine::open_or_create(&index_dir, &theater_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rel_path = format!("01_wiki/{}/{}.md", payload.category, payload.doc_id);
    engine
        .upsert_graph_entity(
            &payload.doc_id,
            &payload.title,
            &payload.category,
            &rel_path,
            &payload.markdown_content.chars().take(240).collect::<String>(),
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    engine
        .index_document(
            &payload.doc_id,
            &payload.title,
            &payload.markdown_content,
            &rel_path,
            Some(1),
            None,
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Save Wiki file on disk
    let full_wiki_path = theater_path.join(&rel_path);
    if let Some(parent) = full_wiki_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&full_wiki_path, &payload.markdown_content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut entity_map = HashMap::new();
    entity_map.insert(payload.title.clone(), vec![payload.doc_id.clone()]);
    let linker = AutoWikilinker::new(entity_map);
    let wikilinked_preview = linker.link_text(&payload.markdown_content);

    Ok(Json(IngestMarkdownResponse {
        doc_id: payload.doc_id,
        sections_extracted: sections.len(),
        tables_extracted: tables_count,
        resolution: resolution_label,
        wikilinked_preview,
    }))
}

async fn upload_source_file_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UploadSourceRequest>,
) -> Result<Json<UploadSourceResponse>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let _ws = TheaterWorkspace::open(&theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    let sources_dir = theater_path.join("00_sources");
    std::fs::create_dir_all(&sources_dir).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let safe_file_name = payload.file_name.trim();
    if safe_file_name.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let source_path = sources_dir.join(safe_file_name);
    std::fs::write(&source_path, payload.content.as_bytes())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let rel_path = format!("00_sources/{}", safe_file_name);
    let doc_id = safe_file_name.to_lowercase().replace(|c: char| !c.is_alphanumeric() && c != '.', "_");

    let sections: Vec<SectionNode> = MarkdownDocParser::parse(&payload.content);

    let kg_path = theater_path.join("04_index/knowledge_graph.sqlite");
    let res = EntityResolver::resolve(&kg_path, safe_file_name, &[])
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let resolution_label = match &res {
        EntityResolutionResult::MergeWithExisting { canonical_title, score, .. } => {
            format!("MergeWithExisting ({}, score {:.2})", canonical_title, score)
        }
        EntityResolutionResult::CreateNew { proposed_title } => {
            format!("CreateNew ({})", proposed_title)
        }
        EntityResolutionResult::HumanReviewRequired { candidate_title, score, .. } => {
            format!("HumanReviewRequired ({}, score {:.2})", candidate_title, score)
        }
    };

    let index_dir = theater_path.join("04_index");
    let mut engine = HybridSearchEngine::open_or_create(&index_dir, &theater_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = engine.upsert_graph_entity(
        &doc_id,
        safe_file_name,
        "sources",
        &rel_path,
        &payload.content.chars().take(240).collect::<String>(),
    );

    // Index sections or chunks into Tantivy & Knowledge Graph
    if sections.is_empty() {
        let _ = engine.index_document(
            &doc_id,
            safe_file_name,
            &payload.content,
            &rel_path,
            Some(1),
            None,
        );
    } else {
        for (idx, sec) in sections.iter().enumerate() {
            let sec_doc_id = format!("{}_{}", doc_id, idx);
            let sec_title = if sec.title.is_empty() {
                format!("{} (Section {})", safe_file_name, idx + 1)
            } else {
                format!("{} > {}", safe_file_name, sec.title)
            };
            let _ = engine.index_document(
                &sec_doc_id,
                &sec_title,
                &sec.content,
                &rel_path,
                Some((idx + 1) as u32),
                None,
            );
        }
    }

    Ok(Json(UploadSourceResponse {
        file_name: safe_file_name.to_string(),
        relative_path: rel_path,
        size_bytes: payload.content.len(),
        sections_indexed: sections.len(),
        resolution: resolution_label,
    }))
}

async fn list_wiki_notes_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<WikiNoteEntry>>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let wiki_root = theater_path.join("01_wiki");
    let mut notes = Vec::new();

    if let Ok(cats) = std::fs::read_dir(&wiki_root) {
        for cat_entry in cats.flatten() {
            if cat_entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let category = cat_entry.file_name().to_string_lossy().to_string();
                if let Ok(files) = std::fs::read_dir(cat_entry.path()) {
                    for file in files.flatten() {
                        let p = file.path();
                        if p.extension().and_then(|e| e.to_str()) == Some("md") {
                            let slug = p
                                .file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("note")
                                .to_string();
                            let content = std::fs::read_to_string(&p).unwrap_or_default();
                            notes.push(WikiNoteEntry {
                                slug: slug.clone(),
                                category: category.clone(),
                                relative_path: format!("01_wiki/{}/{}.md", category, slug),
                                content,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(Json(notes))
}

async fn patch_wiki_section_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<PatchWikiSectionRequest>,
) -> Result<Json<WikiNoteEntry>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let target_file = theater_path.join(&payload.relative_path);
    let existing = std::fs::read_to_string(&target_file).map_err(|_| StatusCode::NOT_FOUND)?;

    let patched = NonDestructiveWikiPatcher::patch_markdown(
        &existing,
        &payload.section_heading,
        &payload.new_content,
    );

    std::fs::write(&target_file, &patched).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(WikiNoteEntry {
        slug: target_file
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("note")
            .to_string(),
        category: "wiki".to_string(),
        relative_path: payload.relative_path,
        content: patched,
    }))
}

async fn search_hybrid_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<HybridSearchRequest>,
) -> Result<Json<Vec<HybridSearchResult>>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let index_dir = theater_path.join("04_index");
    let engine = HybridSearchEngine::open_or_create(&index_dir, &theater_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let hits = engine
        .search_hybrid(&payload.query, None, payload.limit.unwrap_or(5))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(hits))
}

#[derive(Serialize)]
pub struct SourceFileEntry {
    pub file_name: String,
    pub relative_path: String,
    pub size_bytes: u64,
    pub file_type: String,
}

#[derive(Serialize)]
pub struct TheaterSignalSheet {
    pub theater_id: String,
    pub name: String,
    pub system_preset: String,
    pub privacy_mode: String,
    pub default_language: String,
    pub sources_count: usize,
    pub wiki_count: usize,
    pub personae_count: usize,
    pub tables_count: usize,
    pub plays_count: usize,
    pub current_season: String,
    pub aura_or_matrix: String,
    pub agent_curator_summary: String,
}

async fn list_sources_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<SourceFileEntry>>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let sources_dir = theater_path.join("00_sources");
    let mut files = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&sources_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("source").to_string();
                let file_type = path.extension().and_then(|e| e.to_str()).unwrap_or("raw").to_string();
                let metadata = path.metadata().ok();
                let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);

                files.push(SourceFileEntry {
                    file_name: file_name.clone(),
                    relative_path: format!("00_sources/{}", file_name),
                    size_bytes,
                    file_type,
                });
            }
        }
    }

    Ok(Json(files))
}

#[derive(Deserialize)]
pub struct SourceContentQuery {
    pub file_name: Option<String>,
    pub path: Option<String>,
}

#[derive(Serialize)]
pub struct SourceContentResponse {
    pub file_name: String,
    pub relative_path: String,
    pub file_type: String,
    pub size_bytes: usize,
    pub content: String,
    pub is_binary: bool,
}

async fn get_source_content_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<SourceContentQuery>,
) -> Result<Json<SourceContentResponse>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));

    let (file_path, display_name, rel_path) = if let Some(p) = &query.path {
        let clean_rel = p.trim_start_matches('/').trim_start_matches('\\');
        let full = theater_path.join(clean_rel);
        let name = full.file_name().and_then(|s| s.to_str()).unwrap_or(clean_rel).to_string();
        (full, name, clean_rel.to_string())
    } else if let Some(name) = &query.file_name {
        let full = theater_path.join("00_sources").join(name);
        (full, name.clone(), format!("00_sources/{}", name))
    } else {
        return Err(StatusCode::BAD_REQUEST);
    };

    if !file_path.exists() || !file_path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let file_type = file_path.extension().and_then(|e| e.to_str()).unwrap_or("raw").to_lowercase();
    let size_bytes = file_path.metadata().map(|m| m.len() as usize).unwrap_or(0);

    let is_binary = matches!(file_type.as_str(), "pdf" | "png" | "jpg" | "jpeg" | "webp" | "bin");

    let content = if is_binary {
        format!("[Fichier binaire {} ({} KB) indexé dans le bac à sable]", file_type.to_uppercase(), size_bytes / 1024)
    } else {
        std::fs::read_to_string(&file_path).unwrap_or_else(|_| "[Impossible de lire le contenu texte du fichier]".to_string())
    };

    Ok(Json(SourceContentResponse {
        file_name: display_name,
        relative_path: rel_path,
        file_type,
        size_bytes,
        content,
        is_binary,
    }))
}

async fn delete_source_file_handler(
    State(state): State<Arc<AppState>>,
    Path((id, file_name)): Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let file_path = theater_path.join("00_sources").join(&file_name);

    if !file_path.exists() || !file_path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    std::fs::remove_file(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_wiki_note_handler(
    State(state): State<Arc<AppState>>,
    Path((id, category, slug)): Path<(String, String, String)>,
) -> Result<StatusCode, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let file_path = theater_path.join("01_wiki").join(&category).join(format!("{}.md", slug));

    if !file_path.exists() || !file_path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    std::fs::remove_file(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn delete_persona_handler(
    State(state): State<Arc<AppState>>,
    Path((id, persona_id)): Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let p_dir = theater_path.join("03_personae");

    let json_path = p_dir.join(format!("{}.persona.json", persona_id));
    let md_path = p_dir.join(format!("{}.persona.md", persona_id));
    let psyche_path = p_dir.join(format!("{}.psyche.json", persona_id));

    let mut deleted = false;
    if json_path.exists() {
        let _ = std::fs::remove_file(json_path);
        deleted = true;
    }
    if md_path.exists() {
        let _ = std::fs::remove_file(md_path);
        deleted = true;
    }
    if psyche_path.exists() {
        let _ = std::fs::remove_file(psyche_path);
        deleted = true;
    }

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn get_source_raw_file_handler(
    State(state): State<Arc<AppState>>,
    Path((id, file_name)): Path<(String, String)>,
) -> Result<impl IntoResponse, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let file_path = theater_path.join("00_sources").join(&file_name);

    if !file_path.exists() || !file_path.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let bytes = std::fs::read(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();

    Ok((
        [
            (header::CONTENT_TYPE, mime.as_ref().to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("inline; filename=\"{}\"", file_name),
            ),
        ],
        bytes,
    ))
}

async fn get_theater_signals_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TheaterSignalSheet>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let ws = TheaterWorkspace::open(&theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    let sources_count = std::fs::read_dir(theater_path.join("00_sources"))
        .map(|r| r.flatten().filter(|e| e.path().is_file()).count())
        .unwrap_or(0);

    let mut wiki_count = 0;
    if let Ok(cats) = std::fs::read_dir(theater_path.join("01_wiki")) {
        for cat in cats.flatten() {
            if cat.path().is_dir() {
                if let Ok(sub) = std::fs::read_dir(cat.path()) {
                    wiki_count += sub.flatten().filter(|f| f.path().extension().and_then(|e| e.to_str()) == Some("md")).count();
                }
            }
        }
    }

    let personae_count = std::fs::read_dir(theater_path.join("03_personae"))
        .map(|r| r.flatten().filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json") && !e.file_name().to_string_lossy().contains("psyche")).count())
        .unwrap_or(0);

    let tables_count = std::fs::read_dir(theater_path.join("02_machina"))
        .map(|r| r.flatten().count())
        .unwrap_or(0);

    let plays_count = std::fs::read_dir(theater_path.join("05_plays"))
        .map(|r| r.flatten().count())
        .unwrap_or(0);

    // Déduction automatique du système de règles et de la synthèse d'après les sources injectées
    let sources_dir = theater_path.join("00_sources");
    let mut detected_system = ws.manifest.system_id.clone();
    let mut detected_snippets: Vec<String> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&sources_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string().to_lowercase();
            if name.contains("ars magica") || name.contains("arm5") || name.contains("hermes") {
                detected_system = "Ars Magica 5e".to_string();
                detected_snippets.push(format!("Source '{}' : Règles hermétiques et univers médiéval mythique", entry.file_name().to_string_lossy()));
            } else if name.contains("shadowrun") || name.contains("sr6") {
                detected_system = "Shadowrun 6e".to_string();
                detected_snippets.push(format!("Source '{}' : Cyberpunk & magie urbaine Seattle", entry.file_name().to_string_lossy()));
            } else if name.contains("anastasius") {
                detected_system = "Anastasius".to_string();
                detected_snippets.push(format!("Source '{}' : Résonance Éthérique Harmonique", entry.file_name().to_string_lossy()));
            }
        }
    }

    let privacy = ws.manifest.privacy_mode.clone().unwrap_or_else(|| "strict_local".to_string());

    let dynamic_rules = if detected_snippets.is_empty() {
        if sources_count == 0 {
            "En attente de sources documentaires canoniques".to_string()
        } else {
            detected_system.clone()
        }
    } else {
        detected_system.clone()
    };

    let dynamic_summary = if sources_count == 0 {
        "Aucune source documentaire n'est injectée dans le bac à sable. L'assistant et l'Archiviste attendent vos documents de règles pour en déduire les lois et faits canoniques.".to_string()
    } else {
        format!(
            "Synthèse déduite de {} document(s) source(s) injecté(s) :\n- Système de règles identifié : {}\n- Le corpus comprend {} document(s) canonique(s), {} note(s) et {} personnage(s). Toutes les réponses et verdicts s'appuient strictement sur ces sources.",
            sources_count,
            dynamic_rules,
            sources_count,
            wiki_count,
            personae_count
        )
    };

    Ok(Json(TheaterSignalSheet {
        theater_id: id,
        name: ws.manifest.name,
        system_preset: dynamic_rules,
        privacy_mode: privacy,
        default_language: "fr".to_string(),
        sources_count,
        wiki_count,
        personae_count,
        tables_count,
        plays_count,
        current_season: String::new(),
        aura_or_matrix: String::new(),
        agent_curator_summary: dynamic_summary,
    }))
}

async fn archivist_query_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<ArchivistQueryRequest>,
) -> Result<Json<ArchivistVerdict>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let index_dir = theater_path.join("04_index");
    let engine = HybridSearchEngine::open_or_create(&index_dir, &theater_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut citations: Vec<Citation> = Vec::new();
    let mut matched_excerpts: Vec<String> = Vec::new();

    // 1. Hybrid search (Tantivy + Knowledge Graph + RRF)
    if let Ok(hits) = engine.search_hybrid(&payload.query, None, 6) {
        for h in hits {
            if let Some(allowed) = &payload.selected_sources {
                if !allowed.is_empty() {
                    let allowed_match = allowed.iter().any(|src| {
                        h.source_path.contains(src) || src.contains(&h.source_path)
                    });
                    if !allowed_match {
                        continue;
                    }
                }
            }
            citations.push(Citation::new(&h.source_path, h.page, &h.excerpt));
            matched_excerpts.push(h.excerpt);
        }
    }

    // 2. Direct paragraph & section scan across 00_sources/ and 01_wiki/ for NotebookLM-style precision
    let query_terms: Vec<String> = payload
        .query
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3)
        .map(|s| s.to_string())
        .collect();

    // Specific bonus for query intent (e.g., "maisons", "houses")
    let has_maisons_query = payload.query.to_lowercase().contains("maison")
        || payload.query.to_lowercase().contains("house")
        || payload.query.to_lowercase().contains("hermes");

    // Clear citations and matched_excerpts from whole-document initial hit
    citations.clear();
    matched_excerpts.clear();

    if !query_terms.is_empty() {
        let mut candidate_snippets: Vec<(usize, String, Option<usize>, String)> = Vec::new();

        // Scan 00_sources/
        let sources_dir = theater_path.join("00_sources");
        if let Ok(entries) = std::fs::read_dir(&sources_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let file_name = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
                let rel_path = format!("00_sources/{}", file_name);

                if let Some(allowed) = &payload.selected_sources {
                    if !allowed.is_empty()
                        && !allowed.iter().any(|s| s == &file_name || s == &rel_path)
                    {
                        continue;
                    }
                }

                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if matches!(ext.as_str(), "md" | "txt" | "json" | "yaml" | "yml") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        let lines: Vec<&str> = content.lines().collect();
                        let mut current_chunk_lines: Vec<String> = Vec::new();
                        let mut chunk_start_line = 1;

                        for (line_idx, line) in lines.iter().enumerate() {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                if !current_chunk_lines.is_empty() {
                                    let chunk_text = current_chunk_lines.join("\n");
                                    let clean = chunk_text.trim();
                                    if clean.len() >= 20 {
                                        let lower = clean.to_lowercase();
                                        let mut score = query_terms
                                            .iter()
                                            .filter(|term| lower.contains(term.as_str()))
                                            .count();

                                        if has_maisons_query {
                                            if lower.contains("twelve houses") || lower.contains("houses of hermes") || lower.contains("douze maisons") {
                                                score += 25;
                                            }
                                            if lower.contains("bjornaer") || lower.contains("bonisagus") || lower.contains("flambeau") {
                                                score += 10;
                                            }
                                        }

                                        if lower.contains("open license markdown version")
                                            || lower.contains("crowdfunding backers")
                                            || lower.contains("definitive edition the extensively revised")
                                        {
                                            score = 0;
                                        }

                                        if score > 0 {
                                            let snippet: String = clean.chars().take(1200).collect();
                                            candidate_snippets.push((score, rel_path.clone(), Some(chunk_start_line), snippet));
                                        }
                                    }
                                    current_chunk_lines.clear();
                                }
                                chunk_start_line = line_idx + 2;
                            } else {
                                if current_chunk_lines.is_empty() {
                                    chunk_start_line = line_idx + 1;
                                }
                                current_chunk_lines.push(line.to_string());
                            }
                        }

                        // Process last chunk if remaining
                        if !current_chunk_lines.is_empty() {
                            let chunk_text = current_chunk_lines.join("\n");
                            let clean = chunk_text.trim();
                            if clean.len() >= 20 {
                                let lower = clean.to_lowercase();
                                let score = query_terms
                                    .iter()
                                    .filter(|term| lower.contains(term.as_str()))
                                    .count();
                                if score > 0 {
                                    let snippet: String = clean.chars().take(1200).collect();
                                    candidate_snippets.push((score, rel_path.clone(), Some(chunk_start_line), snippet));
                                }
                            }
                        }
                    }
                }
            }
        }

        // Scan 01_wiki/ if no strict source filter or if wiki is included
        let wiki_dir = theater_path.join("01_wiki");
        if let Ok(cats) = std::fs::read_dir(&wiki_dir) {
            for cat in cats.flatten() {
                if cat.path().is_dir() {
                    let cat_name = cat.file_name().to_string_lossy().to_string();
                    if let Ok(files) = std::fs::read_dir(cat.path()) {
                        for f in files.flatten() {
                            let p = f.path();
                            if p.extension().and_then(|e| e.to_str()) == Some("md") {
                                let fname = p
                                    .file_name()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("")
                                    .to_string();
                                let rel_path = format!("01_wiki/{}/{}", cat_name, fname);
                                if let Some(allowed) = &payload.selected_sources {
                                    if !allowed.is_empty()
                                        && !allowed.iter().any(|s| s == &fname || s == &rel_path)
                                    {
                                        continue;
                                    }
                                }
                                if let Ok(content) = std::fs::read_to_string(&p) {
                                    let lines: Vec<&str> = content.lines().collect();
                                    let mut current_chunk_lines: Vec<String> = Vec::new();
                                    let mut chunk_start_line = 1;

                                    for (line_idx, line) in lines.iter().enumerate() {
                                        let trimmed = line.trim();
                                        if trimmed.is_empty() {
                                            if !current_chunk_lines.is_empty() {
                                                let chunk_text = current_chunk_lines.join("\n");
                                                let clean = chunk_text.trim();
                                                if clean.len() >= 15 && !clean.starts_with("---") {
                                                    let lower = clean.to_lowercase();
                                                    let score = query_terms
                                                        .iter()
                                                        .filter(|term| lower.contains(term.as_str()))
                                                        .count();
                                                    if score > 0 {
                                                        let snippet: String = clean.chars().take(1200).collect();
                                                        candidate_snippets.push((score, rel_path.clone(), Some(chunk_start_line), snippet));
                                                    }
                                                }
                                                current_chunk_lines.clear();
                                            }
                                            chunk_start_line = line_idx + 2;
                                        } else {
                                            if current_chunk_lines.is_empty() {
                                                chunk_start_line = line_idx + 1;
                                            }
                                            current_chunk_lines.push(line.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        candidate_snippets.sort_by(|a, b| b.0.cmp(&a.0));
        for (_, rel_path, line_no, snippet) in candidate_snippets.into_iter().take(4) {
            if !citations
                .iter()
                .any(|c| c.source_file == rel_path && c.snippet == snippet)
            {
                citations.push(Citation::with_line(&rel_path, Some(1), line_no, &snippet));
                matched_excerpts.push(snippet);
            }
        }
    }

    citations.truncate(4);
    matched_excerpts.truncate(3);

    // 3. NotebookLM Synthesis: If local LLM (Souffleur / LM Studio) is reachable, synthesize a fluent answer based on excerpts
    let synthesized_answer = if !matched_excerpts.is_empty() {
        let client = SouffleurClient::new(true);

        // Fetch first active model from LM Studio / local runtime if available
        let detected_model = if let Ok(resp) = reqwest::get("http://127.0.0.1:1234/v1/models").await {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                v["data"][0]["id"].as_str().map(|s| s.to_string())
            } else {
                None
            }
        } else {
            None
        };

        let chosen_model = detected_model.unwrap_or_else(|| "dolphin3.0-llama3.1-8b".to_string());

        let profile = ModelProfile {
            model_name: chosen_model,
            base_url: "http://127.0.0.1:1234/v1".to_string(),
            api_key: None,
            max_tokens: 1024,
            context_window: 8192,
            temperature: 0.2,
            is_local: true,
        };

        let context_block = matched_excerpts.join("\n\n---\n\n");
        let system_prompt = "Tu es L'Archiviste, l'agent documentaliste de Dramatis (harnais de jeu de rôle). Tu réponds strictement aux questions des joueurs et meneurs en t'appuyant EXCLUSIVEMENT sur les extraits de sources canoniques fournis ci-dessous. Ne fais aucune invention hors sources. Rédige ta réponse en français clair, élégant et structuré.";
        let user_prompt = format!(
            "Extraits des sources canoniques du jeu :\n\"\"\"\n{}\n\"\"\"\n\nQuestion de l'utilisateur : {}\n\nRéponds directement à la question en synthétisant précisément les faits trouvés dans les sources ci-dessus :",
            context_block, payload.query
        );

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
                name: None,
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_prompt,
                name: None,
            },
        ];

        match client.complete_chat(&profile, &messages, None).await {
            Ok(content) if !content.trim().is_empty() => Some(content.trim().to_string()),
            _ => Some(matched_excerpts.join("\n\n---\n\n")),
        }
    } else {
        None
    };

    let verdict = ArchivistAgent::answer_query(
        &payload.query,
        citations,
        synthesized_answer.as_deref(),
    );
    Ok(Json(verdict))
}

async fn get_mysteries_board_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<MysteriesBoard>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let board_path = theater_path.join("05_plays/mysteries_board.json");
    let board = MysteriesBoard::load_or_create(&board_path, &id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(board))
}

async fn ingest_debrief_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<SessionDebrief>,
) -> Result<Json<MysteriesBoard>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let board_path = theater_path.join("05_plays/mysteries_board.json");
    let mut board = MysteriesBoard::load_or_create(&board_path, &id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    CampaignChronicler::ingest_debrief(&mut board, &payload);
    board
        .save(&board_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(board))
}

#[derive(Deserialize)]
pub struct ReconcileTablesRequest {
    pub table_name: String,
    pub primary_key_col: String,
    pub old_rows: Vec<HashMap<String, String>>,
    pub new_rows: Vec<HashMap<String, String>>,
    #[serde(default)]
    pub character_dependencies: HashMap<String, Vec<String>>,
}

async fn reconcile_tables_handler(
    Json(payload): Json<ReconcileTablesRequest>,
) -> Json<TableDiffReport> {
    Json(ReconciliationDiffEngine::compute_table_diff(
        &payload.table_name,
        &payload.primary_key_col,
        &payload.old_rows,
        &payload.new_rows,
        &payload.character_dependencies,
    ))
}

// ============================================================================
// MODULE 5 : PERSONA FORGE, PSYCHE, CREATION, ALLIANCES, ARTIFICER & LEDGER
// ============================================================================

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
    let personae_dir = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("03_personae");
    let mut list = Vec::new();

    if let Ok(entries) = std::fs::read_dir(personae_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if file_name.ends_with(".persona.json") {
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
    let personae_dir = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("03_personae");
    std::fs::create_dir_all(&personae_dir).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut persona = PersonaState::new(&payload.id, &payload.name, &payload.system);
    persona.archetype = payload.archetype;

    if payload.system.to_lowercase().contains("shadowrun") {
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

    // 1. Save .persona.json
    let json_content = serde_json::to_string_pretty(&persona).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    std::fs::write(personae_dir.join(format!("{}.persona.json", payload.id)), json_content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 2. Save .persona.md
    let md_content = persona.to_markdown();
    std::fs::write(personae_dir.join(format!("{}.persona.md", payload.id)), md_content)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 3. Save .psyche.json (PER-01 Triple Facet Architecture)
    let psyche = PsycheProfile {
        actor_id: payload.id.clone(),
        psychological_matrix: vec!["Déterminé".to_string(), "Prudent".to_string()],
        voice_config: VoiceConfig {
            tts_engine: "kokoro".to_string(),
            voice_id: "fr_m_01".to_string(),
            pitch: 1.0,
            speed: 1.0,
        },
        primary_goals: vec!["Accomplir la mission du groupe".to_string()],
        secret_fears: vec!["Trahison".to_string()],
        negotiation_limits: NegotiationLimits {
            minimum_acceptable_offer: "Part équitable du butin".to_string(),
            walk_away_threshold: "Menace directe contre les alliés".to_string(),
            moral_red_lines: vec!["Ne jamais abandonner un compagnon".to_string()],
        },
        relationship_gauges: HashMap::new(),
    };
    let _ = psyche.save_to_file(&personae_dir.join(format!("{}.psyche.json", payload.id)));

    Ok(Json(persona))
}

async fn validate_sr6_creation_handler(
    Json(payload): Json<ShadowrunPriorityInput>,
) -> Json<CreationValidationResult> {
    Json(CharacterCreationEngine::validate_shadowrun_priority(&payload))
}

async fn validate_ars_creation_handler(
    Json(payload): Json<ArsMagicaCreationInput>,
) -> Json<CreationValidationResult> {
    Json(CharacterCreationEngine::validate_ars_magica(&payload, true))
}

async fn evaluate_artificer_handler(
    Json(payload): Json<HermeticCraftInput>,
) -> Json<HermeticCraftVerdict> {
    Json(ArtificerEngine::evaluate_hermetic_project(&payload))
}

async fn get_alliance_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<AllianceState>, StatusCode> {
    let cov_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("03_personae/alliance.json");
    if cov_path.exists() {
        let cov = AllianceState::load_from_file(&cov_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(Json(cov))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

async fn resolve_downtime_handler(
    Json(payload): Json<DowntimeActivity>,
) -> Json<DowntimeResolutionResult> {
    Json(DowntimeEngine::resolve_season(&payload))
}

async fn get_party_ledger_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<PartyLedger>, StatusCode> {
    let ledger_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("03_personae/party_ledger.json");
    let ledger = PartyLedger::load_or_create(&ledger_path, &id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(ledger))
}

// ============================================================================
// MODULE 6 : STAGE MANAGER, CHANNELS, INTERCEPTION, RESOLUTION & EVENT LOGS
// ============================================================================

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

#[derive(Deserialize)]
pub struct StageResolveIntentionRequest {
    pub intention: MechanicalIntention,
    pub target_defense: i64,
    pub physical_dice_override: Option<i64>,
}

#[derive(Deserialize)]
pub struct EvaluateInterceptionRequest {
    pub hook: InterceptionHook,
    pub message_content: String,
}

#[derive(Deserialize)]
pub struct RewindStageRequest {
    pub turns_to_rewind: usize,
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

async fn evaluate_interception_handler(
    Json(payload): Json<EvaluateInterceptionRequest>,
) -> Json<InterceptionVerdict> {
    Json(DeterministicInterceptionEngine::evaluate_interception(
        &payload.hook,
        &payload.message_content,
    ))
}

async fn stage_resolve_intention_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<StageResolveIntentionRequest>,
) -> Result<Json<MechanicalResolution>, StatusCode> {
    let roll_total = if let Some(forced) = payload.physical_dice_override {
        forced
    } else if let Ok(parsed) = AdvancedDiceParser::parse_and_roll(&payload.intention.skill_expression) {
        parsed.total
    } else {
        DiceEngine::roll_standard(1, 10, 0).total
    };

    let resolution = StageResolutionGate::resolve_intention(
        payload.intention,
        roll_total,
        payload.target_defense,
    );

    // Log in session_logs.jsonl (STG-06)
    let log_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("05_plays/default/session_logs.jsonl");
    let _ = SessionEventLogger::append_event(
        &log_path,
        "mechanical_resolution",
        &resolution.intention.actor_id,
        "#zone-main",
        &resolution.deterministic_verdict,
        serde_json::to_value(&resolution).unwrap_or_default(),
    );

    Ok(Json(resolution))
}

async fn list_session_logs_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<SessionLogEntry>>, StatusCode> {
    let log_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("05_plays/default/session_logs.jsonl");
    let logs = SessionEventLogger::read_all_events(&log_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(logs))
}

async fn rewind_stage_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<RewindStageRequest>,
) -> Result<Json<Vec<SessionLogEntry>>, StatusCode> {
    let log_path = state
        .workspaces_root
        .join(normalize_theater_dir(&id))
        .join("05_plays/default/session_logs.jsonl");
    let remaining = SessionEventLogger::rewind_events(&log_path, payload.turns_to_rewind)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(remaining))
}

async fn list_mcp_tools_handler() -> Json<Vec<McpToolSpec>> {
    Json(McpRegistry::list_all_tools())
}

// ============================================================================
// SERVER BOOTSTRAP & REFERENCE THEATERS SEEDING
// ============================================================================

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
        .route("/api/mcp/tools", get(list_mcp_tools_handler))
        // Module 1 : Theaters, Snapshots, Chronos & Exports
        .route("/api/theaters", post(create_theater_handler).get(list_theaters_handler))
        .route("/api/theaters/{id}", get(get_theater_handler).put(update_theater_handler).delete(delete_theater_handler))
        .route("/api/theaters/{id}/snapshots", get(list_snapshots_handler).post(create_snapshot_handler))
        .route("/api/theaters/{id}/snapshots/rollback", post(rollback_snapshot_handler))
        .route("/api/theaters/{id}/signal-sheet", get(get_theater_signals_handler))
        .route("/api/theaters/{id}/sources", get(list_sources_handler).post(upload_source_file_handler))
        .route("/api/theaters/{id}/sources/content", get(get_source_content_handler))
        .route("/api/theaters/{id}/sources/{file_name}", axum::routing::delete(delete_source_file_handler))
        .route("/api/theaters/{id}/sources/raw/{file_name}", get(get_source_raw_file_handler))
        .route("/api/theaters/{id}/chronos/advance", post(advance_chronos_handler))
        .route("/api/export/handout", post(export_handout_handler))
        // Module 2 & 3 : Ingest, Wiki, Hybrid RAG, Archivist & Chronicler
        .route("/api/theaters/{id}/ingest/markdown", post(ingest_markdown_handler))
        .route("/api/theaters/{id}/ingest/reconcile", post(reconcile_tables_handler))
        .route("/api/theaters/{id}/wiki", get(list_wiki_notes_handler).patch(patch_wiki_section_handler))
        .route("/api/theaters/{id}/wiki/{category}/{slug}", axum::routing::delete(delete_wiki_note_handler))
        .route("/api/theaters/{id}/rag/search", post(search_hybrid_handler))
        .route("/api/theaters/{id}/agents/archivist", post(archivist_query_handler))
        .route("/api/theaters/{id}/mysteries", get(get_mysteries_board_handler))
        .route("/api/theaters/{id}/chronicler/debrief", post(ingest_debrief_handler))
        // Module 4 : Machina, Dice, Rhai-SQL & Monte-Carlo
        .route("/api/machina/roll/standard", post(roll_standard_handler))
        .route("/api/machina/roll/shadowrun", post(roll_shadowrun_handler))
        .route("/api/machina/roll/ars-magica", post(roll_ars_magica_handler))
        .route("/api/machina/roll/expression", post(roll_expression_handler))
        .route("/api/machina/simulate/standard", post(simulate_standard_handler))
        .route("/api/machina/simulate/shadowrun", post(simulate_shadowrun_handler))
        .route("/api/machina/tactical-edge", post(evaluate_tactical_edge_handler))
        .route("/api/theaters/{id}/machina/eval", post(evaluate_rhai_handler))
        .route("/api/theaters/{id}/machina/schema", get(get_system_schema_handler))
        .route("/api/theaters/{id}/machina/tables", get(list_sql_tables_handler))
        // Module 5 : PersonaForge, Creation, Artificer, Alliances & Ledger
        .route("/api/theaters/{id}/personae", post(create_persona_handler).get(list_personae_handler))
        .route("/api/theaters/{id}/personae/{persona_id}", axum::routing::delete(delete_persona_handler))
        .route("/api/persona/validate/sr6", post(validate_sr6_creation_handler))
        .route("/api/persona/validate/ars-magica", post(validate_ars_creation_handler))
        .route("/api/persona/artificer", post(evaluate_artificer_handler))
        .route("/api/theaters/{id}/alliance", get(get_alliance_handler))
        .route("/api/theaters/{id}/downtime/resolve", post(resolve_downtime_handler))
        .route("/api/theaters/{id}/ledger", get(get_party_ledger_handler))
        // Module 6 : StageManager, Channels, Interception & Event Logs
        .route("/api/stage/scene/default", get(get_default_scene_topology_handler))
        .route("/api/stage/channels/filter", post(filter_stage_message_handler))
        .route("/api/stage/interception", post(evaluate_interception_handler))
        .route("/api/theaters/{id}/stage/resolve", post(stage_resolve_intention_handler))
        .route("/api/theaters/{id}/stage/logs", get(list_session_logs_handler))
        .route("/api/theaters/{id}/stage/rewind", post(rewind_stage_handler))
        .fallback(static_handler)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50 MB max upload
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
        None => match Asset::get("index.html") {
            Some(content) => {
                ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], content.data).into_response()
            }
            None => (StatusCode::NOT_FOUND, "Not Found").into_response(),
        },
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
    list.sort();

    Ok(Json(list))
}

async fn create_theater_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateTheaterRequest>,
) -> Result<Json<TheaterManifest>, StatusCode> {
    let dir_name = normalize_theater_dir(&payload.id);
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
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let ws = TheaterWorkspace::open(theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(ws.manifest))
}

#[derive(Deserialize)]
pub struct UpdateTheaterRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub system_id: Option<String>,
    pub privacy_mode: Option<String>,
    pub agent_routing: Option<HashMap<String, String>>,
}

async fn update_theater_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateTheaterRequest>,
) -> Result<Json<TheaterManifest>, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    let mut ws = TheaterWorkspace::open(&theater_path).map_err(|_| StatusCode::NOT_FOUND)?;

    if let Some(name) = payload.name {
        ws.manifest.name = name;
    }
    if let Some(desc) = payload.description {
        ws.manifest.description = desc;
    }
    if let Some(sys) = payload.system_id {
        ws.manifest.system_id = sys;
    }
    if let Some(priv_mode) = payload.privacy_mode {
        ws.manifest.privacy_mode = Some(priv_mode);
    }
    if let Some(routing) = payload.agent_routing {
        ws.manifest.agent_routing = Some(routing);
    }

    let yaml = serde_yaml::to_string(&ws.manifest).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    std::fs::write(theater_path.join("theater.yaml"), yaml).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(ws.manifest))
}

async fn delete_theater_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(&id));
    if !theater_path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    std::fs::remove_dir_all(theater_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}
