use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EventLogError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionLogEntry {
    pub sequence_id: u64,
    pub timestamp: String,
    pub event_type: String, // "narration", "mechanical_resolution", "channel_message", "gm_override", "vox_trigger"
    pub actor_id: String,
    pub channel: String,
    pub summary: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoxAudioState {
    pub active_music_track: Option<String>,
    pub active_ambient_loop: Option<String>,
    pub master_volume: f32,
    pub last_sfx_triggered: Option<String>,
    pub last_tts_utterance: Option<(String, String)>, // (actor_id, text)
}

impl Default for VoxAudioState {
    fn default() -> Self {
        Self {
            active_music_track: Some("nocturne_archive_loop.ogg".to_string()),
            active_ambient_loop: Some("fireplace_crackle.ogg".to_string()),
            master_volume: 0.75,
            last_sfx_triggered: None,
            last_tts_utterance: None,
        }
    }
}

pub struct SessionEventLogger;

impl SessionEventLogger {
    /// Appends an immutable event to `/05_plays/{play_id}/session_logs.jsonl` (`STG-06`)
    pub fn append_event(
        log_file_path: &Path,
        event_type: &str,
        actor_id: &str,
        channel: &str,
        summary: &str,
        payload: serde_json::Value,
    ) -> Result<SessionLogEntry, EventLogError> {
        if let Some(parent) = log_file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let existing = Self::read_all_events(log_file_path).unwrap_or_default();
        let next_seq = existing.last().map(|e| e.sequence_id + 1).unwrap_or(1);

        let entry = SessionLogEntry {
            sequence_id: next_seq,
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: event_type.to_string(),
            actor_id: actor_id.to_string(),
            channel: channel.to_string(),
            summary: summary.to_string(),
            payload,
        };

        let line = serde_json::to_string(&entry)?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file_path)?;
        writeln!(file, "{}", line)?;

        Ok(entry)
    }

    pub fn read_all_events(log_file_path: &Path) -> Result<Vec<SessionLogEntry>, EventLogError> {
        if !log_file_path.exists() {
            return Ok(Vec::new());
        }
        let content = std::fs::read_to_string(log_file_path)?;
        let mut entries = Vec::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                if let Ok(entry) = serde_json::from_str::<SessionLogEntry>(trimmed) {
                    entries.push(entry);
                }
            }
        }
        Ok(entries)
    }

    /// Rewinds (truncates) the last `turns_to_rewind` events from `session_logs.jsonl` (`STG-09`)
    pub fn rewind_events(
        log_file_path: &Path,
        turns_to_rewind: usize,
    ) -> Result<Vec<SessionLogEntry>, EventLogError> {
        let mut all = Self::read_all_events(log_file_path)?;
        let new_len = all.len().saturating_sub(turns_to_rewind);
        all.truncate(new_len);

        if let Some(parent) = log_file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = String::new();
        for entry in &all {
            out.push_str(&serde_json::to_string(entry)?);
            out.push('\n');
        }
        std::fs::write(log_file_path, out)?;

        Ok(all)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_session_event_log_append_and_rewind() {
        let temp = tempdir().unwrap();
        let log_path = temp.path().join("session_logs.jsonl");

        SessionEventLogger::append_event(
            &log_path,
            "narration",
            "dramatis.director",
            "#zone-cour",
            "La pluie bat les remparts de Val Negra.",
            serde_json::json!({}),
        ).unwrap();

        SessionEventLogger::append_event(
            &log_path,
            "mechanical_resolution",
            "dramatis.arbiter",
            "#zone-cour",
            "Jet de Perception réussi (14 vs 12).",
            serde_json::json!({"roll": 14}),
        ).unwrap();

        let all = SessionEventLogger::read_all_events(&log_path).unwrap();
        assert_eq!(all.len(), 2);

        let after_rewind = SessionEventLogger::rewind_events(&log_path, 1).unwrap();
        assert_eq!(after_rewind.len(), 1);
        assert_eq!(after_rewind[0].sequence_id, 1);
    }
}

