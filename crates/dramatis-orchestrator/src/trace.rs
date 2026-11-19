use std::path::Path;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::OrchestratorError;

/// Identifiers for the 4 sequential validation gates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GateId {
    G1Contract,
    G2Epistemic,
    G3Machina,
    G4Hitl,
}

/// Outcome status of an individual validation gate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GateStatus {
    Passed,
    Warning,
    Failed,
    PendingApproval,
    Skipped,
}

/// Evaluation result for a single validation gate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateResult {
    pub gate: GateId,
    pub status: GateStatus,
    pub message: String,
    #[serde(default)]
    pub details: Vec<String>,
}

/// Combined outcome across Gates G1-G4.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub overall_passed: bool,
    pub requires_hitl_approval: bool,
    pub gates: Vec<GateResult>,
}

/// Execution telemetry for a single step within a workflow run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepTrace {
    pub step_id: String,
    pub name: String,
    pub status: String, // "completed" | "skipped" | "failed"
    pub duration_ms: u64,
    pub summary: String,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// Full execution trace persisted for observability, Dry-Run inspection, and Evals.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTrace {
    pub trace_id: String,
    pub theater_id: String,
    pub workflow_id: String,
    pub agent_id: String,
    pub dry_run: bool,
    pub status: String, // "completed" | "pending_approval" | "validation_failed" | "failed"
    pub started_at: String,
    pub duration_ms: u64,
    pub model_used: Option<String>,
    pub prompt_preview: Option<String>,
    pub input_payload: serde_json::Value,
    pub output_payload: serde_json::Value,
    pub steps: Vec<StepTrace>,
    pub validation: ValidationReport,
    pub approval_id: Option<String>,
    pub retries: usize,
}

/// Lightweight summary row for listing traces in UI tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceSummary {
    pub trace_id: String,
    pub theater_id: String,
    pub workflow_id: String,
    pub agent_id: String,
    pub dry_run: bool,
    pub status: String,
    pub started_at: String,
    pub duration_ms: u64,
    pub model_used: Option<String>,
    pub approval_id: Option<String>,
}

/// Lifecycle state for a Gate G4 Human-in-the-Loop mutation proposal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HitlApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Overridden,
}

impl HitlApprovalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            HitlApprovalStatus::Pending => "pending",
            HitlApprovalStatus::Approved => "approved",
            HitlApprovalStatus::Rejected => "rejected",
            HitlApprovalStatus::Overridden => "overridden",
        }
    }

    pub fn parse_status(raw: &str) -> Self {
        match raw {
            "approved" => HitlApprovalStatus::Approved,
            "rejected" => HitlApprovalStatus::Rejected,
            "overridden" => HitlApprovalStatus::Overridden,
            _ => HitlApprovalStatus::Pending,
        }
    }
}

/// Persisted Gate G4 approval request waiting for GM review or already decided.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitlApprovalRecord {
    pub approval_id: String,
    pub trace_id: String,
    pub theater_id: String,
    pub workflow_id: String,
    pub agent_id: String,
    pub action_kind: String,
    pub target_path: String,
    pub summary: String,
    pub diff_preview: String,
    pub mutation_payload: serde_json::Value,
    pub status: HitlApprovalStatus,
    pub gm_note: Option<String>,
    pub created_at: String,
    pub decided_at: Option<String>,
}

/// Synchronous SQLite-backed store for `execution_traces` and `hitl_approvals` inside a Theater.
pub struct TraceStore {
    db_path: std::path::PathBuf,
}

impl TraceStore {
    /// Ensures `04_index/orchestrator.sqlite` exists with WAL mode and required tables.
    pub fn open(theater_root: &Path) -> Result<Self, OrchestratorError> {
        let index_dir = theater_root.join("04_index");
        std::fs::create_dir_all(&index_dir)?;
        let db_path = index_dir.join("orchestrator.sqlite");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS execution_traces (
                trace_id TEXT PRIMARY KEY,
                theater_id TEXT NOT NULL,
                workflow_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                dry_run INTEGER NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                model_used TEXT,
                approval_id TEXT,
                trace_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_traces_started
                ON execution_traces(started_at DESC);

            CREATE TABLE IF NOT EXISTS hitl_approvals (
                approval_id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                theater_id TEXT NOT NULL,
                workflow_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                action_kind TEXT NOT NULL,
                target_path TEXT NOT NULL,
                summary TEXT NOT NULL,
                diff_preview TEXT NOT NULL,
                mutation_payload_json TEXT NOT NULL,
                status TEXT NOT NULL,
                gm_note TEXT,
                created_at TEXT NOT NULL,
                decided_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_approvals_status
                ON hitl_approvals(status, created_at DESC);
            "#,
        )?;
        Ok(Self { db_path })
    }

    /// Generates a new timestamped UUID trace ID.
    pub fn new_trace_id() -> String {
        format!("tr_{}", Uuid::new_v4().simple())
    }

    /// Generates a new approval ID.
    pub fn new_approval_id() -> String {
        format!("apr_{}", Uuid::new_v4().simple())
    }

    /// Records a completed or pending `ExecutionTrace` into SQLite.
    pub fn record_trace(&self, trace: &ExecutionTrace) -> Result<(), OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let serialized = serde_json::to_string(trace)?;
        conn.execute(
            r#"
            INSERT OR REPLACE INTO execution_traces (
                trace_id, theater_id, workflow_id, agent_id, dry_run, status,
                started_at, duration_ms, model_used, approval_id, trace_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                trace.trace_id,
                trace.theater_id,
                trace.workflow_id,
                trace.agent_id,
                if trace.dry_run { 1i64 } else { 0i64 },
                trace.status,
                trace.started_at,
                trace.duration_ms as i64,
                trace.model_used,
                trace.approval_id,
                serialized,
            ],
        )?;
        Ok(())
    }

    /// Lists recent trace summaries ordered newest first.
    pub fn list_traces(&self, limit: usize) -> Result<Vec<TraceSummary>, OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT trace_id, theater_id, workflow_id, agent_id, dry_run, status,
                   started_at, duration_ms, model_used, approval_id
            FROM execution_traces
            ORDER BY started_at DESC
            LIMIT ?1
            "#,
        )?;
        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(TraceSummary {
                trace_id: r.get(0)?,
                theater_id: r.get(1)?,
                workflow_id: r.get(2)?,
                agent_id: r.get(3)?,
                dry_run: r.get::<_, i64>(4)? != 0,
                status: r.get(5)?,
                started_at: r.get(6)?,
                duration_ms: r.get::<_, i64>(7)?.max(0) as u64,
                model_used: r.get(8)?,
                approval_id: r.get(9)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    /// Retrieves a full `ExecutionTrace` by ID.
    pub fn get_trace(&self, trace_id: &str) -> Result<Option<ExecutionTrace>, OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt =
            conn.prepare("SELECT trace_json FROM execution_traces WHERE trace_id = ?1")?;
        let mut rows = stmt.query(params![trace_id])?;
        if let Some(row) = rows.next()? {
            let json_str: String = row.get(0)?;
            let parsed: ExecutionTrace = serde_json::from_str(&json_str)?;
            Ok(Some(parsed))
        } else {
            Ok(None)
        }
    }

    /// Persists a newly created pending HITL approval request.
    pub fn create_approval(&self, record: &HitlApprovalRecord) -> Result<(), OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let payload_json = serde_json::to_string(&record.mutation_payload)?;
        conn.execute(
            r#"
            INSERT INTO hitl_approvals (
                approval_id, trace_id, theater_id, workflow_id, agent_id,
                action_kind, target_path, summary, diff_preview,
                mutation_payload_json, status, gm_note, created_at, decided_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            "#,
            params![
                record.approval_id,
                record.trace_id,
                record.theater_id,
                record.workflow_id,
                record.agent_id,
                record.action_kind,
                record.target_path,
                record.summary,
                record.diff_preview,
                payload_json,
                record.status.as_str(),
                record.gm_note,
                record.created_at,
                record.decided_at,
            ],
        )?;
        Ok(())
    }

    /// Lists HITL approval records (pending first, then newest resolved).
    pub fn list_approvals(&self, limit: usize) -> Result<Vec<HitlApprovalRecord>, OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT approval_id, trace_id, theater_id, workflow_id, agent_id,
                   action_kind, target_path, summary, diff_preview,
                   mutation_payload_json, status, gm_note, created_at, decided_at
            FROM hitl_approvals
            ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
            LIMIT ?1
            "#,
        )?;
        let rows = stmt.query_map(params![limit as i64], Self::row_to_approval)?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    /// Fetches a single HITL approval record by ID.
    pub fn get_approval(&self, approval_id: &str) -> Result<HitlApprovalRecord, OrchestratorError> {
        let conn = Connection::open(&self.db_path)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT approval_id, trace_id, theater_id, workflow_id, agent_id,
                   action_kind, target_path, summary, diff_preview,
                   mutation_payload_json, status, gm_note, created_at, decided_at
            FROM hitl_approvals
            WHERE approval_id = ?1
            "#,
        )?;
        let mut rows = stmt.query(params![approval_id])?;
        if let Some(row) = rows.next()? {
            Ok(Self::row_to_approval(row)?)
        } else {
            Err(OrchestratorError::ApprovalNotFound(approval_id.to_string()))
        }
    }

    /// Updates an approval record's decision status, optional override payload, and GM note.
    pub fn update_approval_resolution(
        &self,
        approval_id: &str,
        status: HitlApprovalStatus,
        override_payload: Option<serde_json::Value>,
        gm_note: Option<String>,
    ) -> Result<HitlApprovalRecord, OrchestratorError> {
        let mut existing = self.get_approval(approval_id)?;
        let now = Utc::now().to_rfc3339();
        existing.status = status;
        existing.decided_at = Some(now.clone());
        if let Some(note) = gm_note {
            existing.gm_note = Some(note);
        }
        if let Some(ov) = override_payload {
            existing.mutation_payload = ov;
        }
        let payload_json = serde_json::to_string(&existing.mutation_payload)?;

        let conn = Connection::open(&self.db_path)?;
        conn.execute(
            r#"
            UPDATE hitl_approvals
            SET status = ?1, gm_note = ?2, decided_at = ?3, mutation_payload_json = ?4
            WHERE approval_id = ?5
            "#,
            params![
                existing.status.as_str(),
                existing.gm_note,
                existing.decided_at,
                payload_json,
                approval_id,
            ],
        )?;

        // Update linked execution trace status if present
        if let Ok(Some(mut trace)) = self.get_trace(&existing.trace_id) {
            trace.status = format!("hitl_{}", existing.status.as_str());
            let _ = self.record_trace(&trace);
        }

        Ok(existing)
    }

    fn row_to_approval(r: &rusqlite::Row<'_>) -> rusqlite::Result<HitlApprovalRecord> {
        let payload_raw: String = r.get(9)?;
        let status_raw: String = r.get(10)?;
        let mutation_payload = serde_json::from_str(&payload_raw).unwrap_or(serde_json::Value::Null);
        Ok(HitlApprovalRecord {
            approval_id: r.get(0)?,
            trace_id: r.get(1)?,
            theater_id: r.get(2)?,
            workflow_id: r.get(3)?,
            agent_id: r.get(4)?,
            action_kind: r.get(5)?,
            target_path: r.get(6)?,
            summary: r.get(7)?,
            diff_preview: r.get(8)?,
            mutation_payload,
            status: HitlApprovalStatus::parse_status(&status_raw),
            gm_note: r.get(11)?,
            created_at: r.get(12)?,
            decided_at: r.get(13)?,
        })
    }
}
