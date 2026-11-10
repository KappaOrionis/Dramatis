use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ChroniclerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MysteryStatus {
    Unsolved,
    Investigating,
    PartiallySolved,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MysteryNode {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: MysteryStatus,
    pub clues_discovered: Vec<String>,
    pub related_entities: Vec<String>,
    pub session_introduced: u32,
    pub session_resolved: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MysteriesBoard {
    pub campaign_id: String,
    pub updated_at: String,
    pub mysteries: Vec<MysteryNode>,
}

impl MysteriesBoard {
    pub fn load_or_create(path: &Path, campaign_id: &str) -> Result<Self, ChroniclerError> {
        if path.exists() {
            let data = std::fs::read_to_string(path)?;
            let board: Self = serde_json::from_str(&data)?;
            Ok(board)
        } else {
            Ok(Self {
                campaign_id: campaign_id.to_string(),
                updated_at: chrono::Utc::now().to_rfc3339(),
                mysteries: Vec::new(),
            })
        }
    }

    pub fn save(&self, path: &Path) -> Result<(), ChroniclerError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }

    pub fn add_or_update_mystery(&mut self, mystery: MysteryNode) {
        if let Some(existing) = self.mysteries.iter_mut().find(|m| m.id == mystery.id) {
            *existing = mystery;
        } else {
            self.mysteries.push(mystery);
        }
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn add_clue_to_mystery(&mut self, mystery_id: &str, clue: &str) -> bool {
        if let Some(m) = self.mysteries.iter_mut().find(|m| m.id == mystery_id) {
            if !m.clues_discovered.iter().any(|c| c == clue) {
                m.clues_discovered.push(clue.to_string());
                if m.status == MysteryStatus::Unsolved {
                    m.status = MysteryStatus::Investigating;
                }
                self.updated_at = chrono::Utc::now().to_rfc3339();
                return true;
            }
        }
        false
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionDebrief {
    pub session_number: u32,
    pub session_date: String,
    pub key_events: Vec<String>,
    pub revealed_clues: Vec<String>,
    pub new_entities: Vec<String>,
    pub world_state_changes: Vec<String>,
}

pub struct CampaignChronicler;

impl CampaignChronicler {
    pub fn ingest_debrief(
        board: &mut MysteriesBoard,
        debrief: &SessionDebrief,
    ) {
        for clue in &debrief.revealed_clues {
            for mystery in &mut board.mysteries {
                if mystery.status != MysteryStatus::Resolved {
                    let clue_lower = clue.to_lowercase();
                    if mystery.related_entities.iter().any(|e| clue_lower.contains(&e.to_lowercase())) {
                        mystery.clues_discovered.push(clue.clone());
                        mystery.status = MysteryStatus::Investigating;
                    }
                }
            }
        }
        board.updated_at = chrono::Utc::now().to_rfc3339();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_mysteries_board_management() {
        let temp = tempdir().unwrap();
        let board_file = temp.path().join("mysteries_board.json");

        let mut board = MysteriesBoard::load_or_create(&board_file, "campaign_shadowrun").unwrap();
        assert!(board.mysteries.is_empty());

        let mystery = MysteryNode {
            id: "myst_01".to_string(),
            title: "Qui a saboté le sous-sol de Renraku ?".to_string(),
            description: "Une explosion inexpliquée a détruit la matrice interne.".to_string(),
            status: MysteryStatus::Unsolved,
            clues_discovered: vec!["Empreinte de decker Renraku".to_string()],
            related_entities: vec!["Renraku".to_string(), "Decker".to_string()],
            session_introduced: 1,
            session_resolved: None,
        };

        board.add_or_update_mystery(mystery);
        assert_eq!(board.mysteries.len(), 1);

        let debrief = SessionDebrief {
            session_number: 2,
            session_date: "2026-11-10".to_string(),
            key_events: vec!["Infiltration chez Renraku".to_string()],
            revealed_clues: vec!["Badge d'accès de sécurité Renraku volé".to_string()],
            new_entities: vec!["Mr. Johnson".to_string()],
            world_state_changes: vec!["Alerte rouge au sous-sol".to_string()],
        };

        CampaignChronicler::ingest_debrief(&mut board, &debrief);
        assert_eq!(board.mysteries[0].clues_discovered.len(), 2);
        assert_eq!(board.mysteries[0].status, MysteryStatus::Investigating);

        board.save(&board_file).unwrap();
        let reloaded = MysteriesBoard::load_or_create(&board_file, "campaign_shadowrun").unwrap();
        assert_eq!(reloaded.mysteries.len(), 1);
        assert_eq!(reloaded.mysteries[0].clues_discovered.len(), 2);
    }
}

