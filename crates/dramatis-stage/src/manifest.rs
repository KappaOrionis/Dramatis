use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PlayError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneClock {
    pub id: String,
    pub title: String,
    pub total_segments: u32,
    pub current_segments: u32,
    pub triggered_event_rhai_hook: Option<String>,
}

impl SceneClock {
    pub fn advance(&mut self, amount: u32) -> bool {
        self.current_segments = (self.current_segments + amount).min(self.total_segments);
        self.current_segments >= self.total_segments
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneNode {
    pub id: String,
    pub title: String,
    pub synopsis: String,
    pub active_zone_ids: Vec<String>,
    pub clues_obtainable: Vec<String>,
    pub next_scene_options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignManifest {
    pub play_id: String,
    pub campaign_name: String,
    pub active_scene_id: String,
    pub current_round: u32,
    pub clocks: Vec<SceneClock>,
    pub scenes: HashMap<String, SceneNode>,
    pub session_logs_file: String,
}

impl CampaignManifest {
    pub fn new(play_id: &str, campaign_name: &str, initial_scene: SceneNode) -> Self {
        let initial_scene_id = initial_scene.id.clone();
        let mut scenes = HashMap::new();
        scenes.insert(initial_scene_id.clone(), initial_scene);

        Self {
            play_id: play_id.to_string(),
            campaign_name: campaign_name.to_string(),
            active_scene_id: initial_scene_id,
            current_round: 1,
            clocks: Vec::new(),
            scenes,
            session_logs_file: "session_logs.jsonl".to_string(),
        }
    }

    pub fn load_from_file(path: &Path) -> Result<Self, PlayError> {
        let data = std::fs::read_to_string(path)?;
        let manifest: Self = serde_json::from_str(&data)?;
        Ok(manifest)
    }

    pub fn save_to_file(&self, path: &Path) -> Result<(), PlayError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldStateDelta {
    pub timestamp: String,
    pub scene_id: String,
    pub target_entity: String,
    pub mutation_type: String, // "created", "modified", "destroyed", "revealed"
    pub changes_json: serde_json::Value,
}

pub struct PlayOverlayManager;

impl PlayOverlayManager {
    /// Appends a delta without modifying /01_wiki (STG-01 isolation principle)
    pub fn record_delta(
        play_dir: &Path,
        delta: WorldStateDelta,
    ) -> Result<(), PlayError> {
        let delta_dir = play_dir.join("world_state_delta");
        std::fs::create_dir_all(&delta_dir)?;

        let delta_file = delta_dir.join(format!("{}.json", chrono::Utc::now().timestamp_millis()));
        let serialized = serde_json::to_string_pretty(&delta)?;
        std::fs::write(delta_file, serialized)?;
        Ok(())
    }

    /// Loads all accumulated deltas for a play
    pub fn load_all_deltas(play_dir: &Path) -> Result<Vec<WorldStateDelta>, PlayError> {
        let delta_dir = play_dir.join("world_state_delta");
        if !delta_dir.exists() {
            return Ok(Vec::new());
        }

        let mut deltas = Vec::new();
        for entry in std::fs::read_dir(delta_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let data = std::fs::read_to_string(&path)?;
                if let Ok(delta) = serde_json::from_str::<WorldStateDelta>(&data) {
                    deltas.push(delta);
                }
            }
        }
        Ok(deltas)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_campaign_manifest_and_clocks() {
        let temp = tempdir().unwrap();
        let play_dir = temp.path().join("05_plays").join("play_paris_by_night");
        let manifest_path = play_dir.join("campaign_manifest.json");

        let initial_scene = SceneNode {
            id: "scene_01".to_string(),
            title: "Arrivée à l'Auberge".to_string(),
            synopsis: "Les mages et leurs gardes arrivent sous un orage battant.".to_string(),
            active_zone_ids: vec!["zone_cour".to_string(), "zone_salle_commune".to_string()],
            clues_obtainable: vec!["Traces de griffes faeriques sur le seuil".to_string()],
            next_scene_options: vec!["scene_02_interrogatoire".to_string()],
        };

        let mut manifest = CampaignManifest::new("play_paris_by_night", "Chronique Paris 1220", initial_scene);
        let mut clock = SceneClock {
            id: "clock_alert".to_string(),
            title: "Alerte de la Garnison".to_string(),
            total_segments: 4,
            current_segments: 0,
            triggered_event_rhai_hook: Some("trigger_guard_reinforcements()".to_string()),
        };

        assert!(!clock.advance(2));
        assert!(clock.advance(2)); // Reached 4/4!

        manifest.clocks.push(clock);
        manifest.save_to_file(&manifest_path).unwrap();

        let loaded = CampaignManifest::load_from_file(&manifest_path).unwrap();
        assert_eq!(loaded.clocks[0].current_segments, 4);
        assert_eq!(loaded.active_scene_id, "scene_01");

        // Record delta
        let delta = WorldStateDelta {
            timestamp: chrono::Utc::now().to_rfc3339(),
            scene_id: "scene_01".to_string(),
            target_entity: "porte_auberge".to_string(),
            mutation_type: "destroyed".to_string(),
            changes_json: serde_json::json!({ "condition": "shattered" }),
        };
        PlayOverlayManager::record_delta(&play_dir, delta).unwrap();

        let loaded_deltas = PlayOverlayManager::load_all_deltas(&play_dir).unwrap();
        assert_eq!(loaded_deltas.len(), 1);
        assert_eq!(loaded_deltas[0].target_entity, "porte_auberge");
    }
}
