use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AllianceError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Laboratory {
    pub owner_actor_id: String,
    pub location_name: String,
    pub general_quality: i64,
    pub safety_score: i64,
    pub specialization_bonuses: HashMap<String, i64>, // e.g. "Creo" -> +3, "Ignem" -> +2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisStock {
    pub art_name: String, // Creo, Intellego, Muto, Perdo, Rego, Animal, Aquam, Auram, Corporem, Herbam, Ignem, Imaginem, Mentem, Terram, Vim
    pub pawns: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryBook {
    pub book_id: String,
    pub title: String,
    pub topic: String,
    pub book_type: String, // "Summa" or "Tractatus"
    pub quality: u32,
    pub level: Option<u32>, // Only for Summae
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllianceState {
    pub covenant_id: String,
    pub name: String,
    pub tribunal: String, // e.g. "Provençal", "Normandy", "Loch Leglean"
    pub aegis_level: u32,
    pub vis_stocks: Vec<VisStock>,
    pub laboratories: Vec<Laboratory>,
    pub library: Vec<LibraryBook>,
    pub grogs_and_specialists: Vec<String>,
}

impl AllianceState {
    pub fn load_from_file(path: &Path) -> Result<Self, AllianceError> {
        let content = std::fs::read_to_string(path)?;
        let state: Self = serde_json::from_str(&content)?;
        Ok(state)
    }

    pub fn save_to_file(&self, path: &Path) -> Result<(), AllianceError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }

    pub fn add_or_spend_vis(&mut self, art: &str, delta_pawns: i32) -> bool {
        if let Some(stock) = self.vis_stocks.iter_mut().find(|s| s.art_name.eq_ignore_ascii_case(art)) {
            let new_pawns = stock.pawns as i32 + delta_pawns;
            if new_pawns < 0 {
                return false;
            }
            stock.pawns = new_pawns as u32;
            true
        } else if delta_pawns >= 0 {
            self.vis_stocks.push(VisStock {
                art_name: art.to_string(),
                pawns: delta_pawns as u32,
            });
            true
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowntimeActivity {
    pub actor_id: String,
    pub season: String, // "Spring", "Summer", "Autumn", "Winter"
    pub year: i64,
    pub activity_type: String, // "ReadingBook", "InventingSpell", "ExtractingVis", "StudyingVis"
    pub target_id: Option<String>,
    pub source_quality: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowntimeResolutionResult {
    pub actor_id: String,
    pub xp_gained: u32,
    pub vis_consumed: u32,
    pub notes: String,
}

pub struct DowntimeEngine;

impl DowntimeEngine {
    pub fn resolve_season(activity: &DowntimeActivity) -> DowntimeResolutionResult {
        match activity.activity_type.as_str() {
            "ReadingBook" => DowntimeResolutionResult {
                actor_id: activity.actor_id.clone(),
                xp_gained: activity.source_quality,
                vis_consumed: 0,
                notes: format!(
                    "Lecture saisonnière studieuse : gain de {} points d'expérience.",
                    activity.source_quality
                ),
            },
            "ExtractingVis" => DowntimeResolutionResult {
                actor_id: activity.actor_id.clone(),
                xp_gained: 2,
                vis_consumed: 0,
                notes: "Extraction de Vis de l'Aura du Covenant réussie (+1 pion de Vis Vim brut, +2 XP).".to_string(),
            },
            _ => DowntimeResolutionResult {
                actor_id: activity.actor_id.clone(),
                xp_gained: 5,
                vis_consumed: 0,
                notes: "Activité générique achevée durant la saison (+5 XP pratique).".to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_alliance_vis_and_downtime() {
        let temp = tempdir().unwrap();
        let cov_path = temp.path().join("covenant.json");

        let mut alliance = AllianceState {
            covenant_id: "cov_val_negra".to_string(),
            name: "Covenant de Val Negra".to_string(),
            tribunal: "Provençal".to_string(),
            aegis_level: 25,
            vis_stocks: vec![
                VisStock { art_name: "Ignem".to_string(), pawns: 10 },
            ],
            laboratories: Vec::new(),
            library: vec![
                LibraryBook {
                    book_id: "book_creo_summa".to_string(),
                    title: "De Natura Creatoris".to_string(),
                    topic: "Creo".to_string(),
                    book_type: "Summa".to_string(),
                    quality: 11,
                    level: Some(15),
                },
            ],
            grogs_and_specialists: vec!["Capitaine Bertrand".to_string()],
        };

        assert!(alliance.add_or_spend_vis("Ignem", -3));
        assert_eq!(alliance.vis_stocks[0].pawns, 7);

        alliance.save_to_file(&cov_path).unwrap();
        let loaded = AllianceState::load_from_file(&cov_path).unwrap();
        assert_eq!(loaded.vis_stocks[0].pawns, 7);

        let activity = DowntimeActivity {
            actor_id: "mage_lucius".to_string(),
            season: "Spring".to_string(),
            year: 1220,
            activity_type: "ReadingBook".to_string(),
            target_id: Some("book_creo_summa".to_string()),
            source_quality: 11,
        };

        let result = DowntimeEngine::resolve_season(&activity);
        assert_eq!(result.xp_gained, 11);
        assert_eq!(result.vis_consumed, 0);
    }
}
