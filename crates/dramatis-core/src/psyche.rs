use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PsycheError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub tts_engine: String, // e.g. "kokoro", "piper", "elevenlabs"
    pub voice_id: String,
    pub pitch: f32,
    pub speed: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NegotiationLimits {
    pub minimum_acceptable_offer: String,
    pub walk_away_threshold: String,
    pub moral_red_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PsycheProfile {
    pub actor_id: String,
    pub psychological_matrix: Vec<String>, // e.g. ["Paranoid", "Loyal to Covenant", "Calculating"]
    pub voice_config: VoiceConfig,
    pub primary_goals: Vec<String>,
    pub secret_fears: Vec<String>,
    pub negotiation_limits: NegotiationLimits,
    pub relationship_gauges: HashMap<String, i64>, // target_actor_id -> trust (-100 to +100)
}

impl PsycheProfile {
    pub fn load_from_file(path: &Path) -> Result<Self, PsycheError> {
        let content = std::fs::read_to_string(path)?;
        let psyche: Self = serde_json::from_str(&content)?;
        Ok(psyche)
    }

    pub fn save_to_file(&self, path: &Path) -> Result<(), PsycheError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }

    pub fn adjust_relationship(&mut self, target_id: &str, delta: i64) -> i64 {
        let current = self.relationship_gauges.entry(target_id.to_string()).or_insert(0);
        *current = (*current + delta).clamp(-100, 100);
        *current
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_psyche_profile_lifecycle() {
        let temp = tempdir().unwrap();
        let psyche_path = temp.path().join("lucius.psyche.json");

        let mut psyche = PsycheProfile {
            actor_id: "actor_lucius".to_string(),
            psychological_matrix: vec!["Hermetic Pride".to_string(), "Relentless Researcher".to_string()],
            voice_config: VoiceConfig {
                tts_engine: "kokoro".to_string(),
                voice_id: "am_adam".to_string(),
                pitch: 1.0,
                speed: 0.95,
            },
            primary_goals: vec!["Discover the Seventh Vis Source".to_string()],
            secret_fears: vec!["Twilight Corruption".to_string()],
            negotiation_limits: NegotiationLimits {
                minimum_acceptable_offer: "5 pawns of Vim Vis".to_string(),
                walk_away_threshold: "Any threat to the Covenant Aegis".to_string(),
                moral_red_lines: vec!["Never traffic with Infernal powers".to_string()],
            },
            relationship_gauges: HashMap::new(),
        };

        psyche.adjust_relationship("actor_tremere_elder", 15);
        assert_eq!(psyche.relationship_gauges.get("actor_tremere_elder"), Some(&15));

        psyche.save_to_file(&psyche_path).unwrap();
        assert!(psyche_path.exists());

        let loaded = PsycheProfile::load_from_file(&psyche_path).unwrap();
        assert_eq!(loaded.actor_id, "actor_lucius");
        assert_eq!(loaded.psychological_matrix.len(), 2);
        assert_eq!(loaded.relationship_gauges.get("actor_tremere_elder"), Some(&15));
    }
}
