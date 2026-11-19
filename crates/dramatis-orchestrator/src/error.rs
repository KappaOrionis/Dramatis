use thiserror::Error;

/// Unified error type for the Dramatis agentic orchestrator crate.
#[derive(Error, Debug)]
pub enum OrchestratorError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML serialization error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Theater error: {0}")]
    Theater(#[from] dramatis_core::TheaterError),

    #[error("Gateway error: {0}")]
    Gateway(#[from] dramatis_gateway::GatewayError),

    #[error("Unknown agent id: {0}")]
    UnknownAgent(String),

    #[error("Unknown workflow id: {0}")]
    UnknownWorkflow(String),

    #[error("Validation failed: {0}")]
    ValidationFailed(String),

    #[error("HITL approval record not found: {0}")]
    ApprovalNotFound(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("Privacy policy violation: {0}")]
    PrivacyViolation(String),

    #[error("Workflow execution error: {0}")]
    Execution(String),
}
