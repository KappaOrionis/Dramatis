use std::path::PathBuf;
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;

use dramatis_core::{Role, TheaterManifest, TheaterWorkspace};
use dramatis_orchestrator::{
    AgentConfig, AgentId, ConfigRegistry, EvalRunReport, EvalRunner, EvalSuiteSummary,
    ExecutionTrace, HitlApprovalRecord, HitlDecision, OrchestratorEngine, ResolvedAgentInfo,
    ResolvedWorkflowInfo, TraceStore, TraceSummary, WorkflowConfig, WorkflowExecutionResult,
    WorkflowRequest,
};

use crate::{normalize_theater_dir, AppState};

#[derive(Deserialize)]
pub struct ImportYamlRequest {
    pub yaml: String,
}

#[derive(Deserialize)]
pub struct RunWorkflowPayload {
    #[serde(default)]
    pub input: serde_json::Value,
    #[serde(default = "default_true")]
    pub dry_run: bool,
    #[serde(default = "default_gm_role")]
    pub role: Role,
    #[serde(default)]
    pub runtime_override: Option<serde_json::Value>,
}

fn default_true() -> bool {
    true
}

fn default_gm_role() -> Role {
    Role::Gm
}

#[derive(Deserialize)]
pub struct DecideApprovalPayload {
    pub decision: HitlDecision,
    #[serde(default)]
    pub override_payload: Option<serde_json::Value>,
    #[serde(default)]
    pub gm_note: Option<String>,
}

#[derive(Deserialize)]
pub struct RunEvalPayload {
    #[serde(default = "default_suite_id")]
    pub suite_id: String,
}

fn default_suite_id() -> String {
    "default_canonical".to_string()
}

#[derive(Deserialize)]
pub struct LimitQuery {
    pub limit: Option<usize>,
}

fn resolve_theater_root(state: &AppState, id: &str) -> (PathBuf, Option<TheaterManifest>) {
    let theater_path = state.workspaces_root.join(normalize_theater_dir(id));
    let manifest = TheaterWorkspace::open(&theater_path)
        .ok()
        .map(|ws| ws.manifest);
    (theater_path, manifest)
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/api/theaters/{id}/orchestrator/agents",
            get(list_agents_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/agents/{agent_id}",
            get(get_agent_handler).put(update_agent_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/agents/{agent_id}/reset",
            post(reset_agent_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/agents/{agent_id}/import-yaml",
            post(import_agent_yaml_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/workflows",
            get(list_workflows_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/workflows/{workflow_id}",
            axum::routing::put(update_workflow_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/workflows/{workflow_id}/reset",
            post(reset_workflow_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/workflows/{workflow_id}/run",
            post(run_workflow_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/traces",
            get(list_traces_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/traces/{trace_id}",
            get(get_trace_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/approvals",
            get(list_approvals_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/approvals/{approval_id}/decide",
            post(decide_approval_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/evals",
            get(list_evals_handler),
        )
        .route(
            "/api/theaters/{id}/orchestrator/evals/run",
            post(run_eval_handler),
        )
}

async fn list_agents_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ResolvedAgentInfo>>, StatusCode> {
    let (theater_root, manifest) = resolve_theater_root(&state, &id);
    ConfigRegistry::list_agents(&theater_root, manifest.as_ref())
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_agent_handler(
    State(state): State<Arc<AppState>>,
    Path((id, agent_id)): Path<(String, String)>,
) -> Result<Json<ResolvedAgentInfo>, StatusCode> {
    let agent = AgentId::parse(&agent_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, manifest) = resolve_theater_root(&state, &id);
    ConfigRegistry::resolve_agent(&theater_root, manifest.as_ref(), agent, None)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_agent_handler(
    State(state): State<Arc<AppState>>,
    Path((id, agent_id)): Path<(String, String)>,
    Json(config): Json<AgentConfig>,
) -> Result<Json<ResolvedAgentInfo>, StatusCode> {
    let agent = AgentId::parse(&agent_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, _) = resolve_theater_root(&state, &id);
    ConfigRegistry::save_agent_config(&theater_root, agent, config)
        .map(Json)
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn reset_agent_handler(
    State(state): State<Arc<AppState>>,
    Path((id, agent_id)): Path<(String, String)>,
) -> Result<Json<ResolvedAgentInfo>, StatusCode> {
    let agent = AgentId::parse(&agent_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, manifest) = resolve_theater_root(&state, &id);
    ConfigRegistry::reset_agent_config(&theater_root, manifest.as_ref(), agent)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn import_agent_yaml_handler(
    State(state): State<Arc<AppState>>,
    Path((id, agent_id)): Path<(String, String)>,
    Json(payload): Json<ImportYamlRequest>,
) -> Result<Json<ResolvedAgentInfo>, StatusCode> {
    let agent = AgentId::parse(&agent_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, _) = resolve_theater_root(&state, &id);
    ConfigRegistry::import_agent_yaml(&theater_root, agent, &payload.yaml)
        .map(Json)
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn list_workflows_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ResolvedWorkflowInfo>>, StatusCode> {
    let (theater_root, _) = resolve_theater_root(&state, &id);
    ConfigRegistry::list_workflows(&theater_root)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn update_workflow_handler(
    State(state): State<Arc<AppState>>,
    Path((id, workflow_id)): Path<(String, String)>,
    Json(config): Json<WorkflowConfig>,
) -> Result<Json<ResolvedWorkflowInfo>, StatusCode> {
    let agent = AgentId::parse_workflow(&workflow_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, _) = resolve_theater_root(&state, &id);
    ConfigRegistry::save_workflow_config(&theater_root, agent, config)
        .map(Json)
        .map_err(|_| StatusCode::BAD_REQUEST)
}

async fn reset_workflow_handler(
    State(state): State<Arc<AppState>>,
    Path((id, workflow_id)): Path<(String, String)>,
) -> Result<Json<ResolvedWorkflowInfo>, StatusCode> {
    let agent = AgentId::parse_workflow(&workflow_id).map_err(|_| StatusCode::NOT_FOUND)?;
    let (theater_root, _) = resolve_theater_root(&state, &id);
    ConfigRegistry::reset_workflow_config(&theater_root, agent)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn run_workflow_handler(
    State(state): State<Arc<AppState>>,
    Path((id, workflow_id)): Path<(String, String)>,
    Json(payload): Json<RunWorkflowPayload>,
) -> Result<Json<WorkflowExecutionResult>, (StatusCode, String)> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    let req = WorkflowRequest {
        theater_id: id,
        theater_root,
        workflow_id,
        input: payload.input,
        dry_run: payload.dry_run,
        role: payload.role,
        runtime_override: payload.runtime_override,
    };

    OrchestratorEngine::execute(req)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn list_traces_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<LimitQuery>,
) -> Result<Json<Vec<TraceSummary>>, StatusCode> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    let store = TraceStore::open(&theater_root).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    store
        .list_traces(q.limit.unwrap_or(50))
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn get_trace_handler(
    State(state): State<Arc<AppState>>,
    Path((id, trace_id)): Path<(String, String)>,
) -> Result<Json<ExecutionTrace>, StatusCode> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    let store = TraceStore::open(&theater_root).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match store.get_trace(&trace_id) {
        Ok(Some(trace)) => Ok(Json(trace)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn list_approvals_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<LimitQuery>,
) -> Result<Json<Vec<HitlApprovalRecord>>, StatusCode> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    let store = TraceStore::open(&theater_root).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    store
        .list_approvals(q.limit.unwrap_or(50))
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn decide_approval_handler(
    State(state): State<Arc<AppState>>,
    Path((id, approval_id)): Path<(String, String)>,
    Json(payload): Json<DecideApprovalPayload>,
) -> Result<Json<HitlApprovalRecord>, (StatusCode, String)> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    OrchestratorEngine::decide_approval(
        &theater_root,
        &approval_id,
        payload.decision,
        payload.override_payload,
        payload.gm_note,
    )
    .map(Json)
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn list_evals_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Json<Vec<EvalSuiteSummary>> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    Json(EvalRunner::list_suites(&theater_root))
}

async fn run_eval_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<RunEvalPayload>,
) -> Result<Json<EvalRunReport>, (StatusCode, String)> {
    let theater_root = state.workspaces_root.join(normalize_theater_dir(&id));
    EvalRunner::run_suite(&theater_root, &id, &payload.suite_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}
