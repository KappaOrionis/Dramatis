use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LedgerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartyItem {
    pub item_id: String,
    pub name: String,
    pub quantity: u32,
    pub weight_kg: f32,
    pub carried_by_actor: Option<String>, // If None, kept in common stash/vehicle
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PartyLedger {
    pub campaign_id: String,
    pub shared_funds: std::collections::HashMap<String, i64>, // currency_name -> amount (e.g. "¥" -> 45000, "Mythic Livre" -> 120)
    pub inventory: Vec<PartyItem>,
    pub debt_or_favors: Vec<String>,
}

impl PartyLedger {
    pub fn load_or_create(path: &Path, campaign_id: &str) -> Result<Self, LedgerError> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let ledger: Self = serde_json::from_str(&content)?;
            Ok(ledger)
        } else {
            Ok(Self {
                campaign_id: campaign_id.to_string(),
                shared_funds: std::collections::HashMap::new(),
                inventory: Vec::new(),
                debt_or_favors: Vec::new(),
            })
        }
    }

    pub fn save_to_file(&self, path: &Path) -> Result<(), LedgerError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }

    pub fn modify_fund(&mut self, currency: &str, delta: i64) -> i64 {
        let current = self.shared_funds.entry(currency.to_string()).or_insert(0);
        *current += delta;
        *current
    }

    pub fn add_item(&mut self, item: PartyItem) {
        if let Some(existing) = self.inventory.iter_mut().find(|i| i.item_id == item.item_id) {
            existing.quantity += item.quantity;
        } else {
            self.inventory.push(item);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_party_ledger_funds_and_inventory() {
        let temp = tempdir().unwrap();
        let ledger_path = temp.path().join("party_ledger.json");

        let mut ledger = PartyLedger::load_or_create(&ledger_path, "campaign_shadowrun").unwrap();
        ledger.modify_fund("¥", 15000);
        assert_eq!(*ledger.shared_funds.get("¥").unwrap(), 15000);

        ledger.add_item(PartyItem {
            item_id: "medkit_rating_6".to_string(),
            name: "Savior Medkit Rating 6".to_string(),
            quantity: 2,
            weight_kg: 2.5,
            carried_by_actor: Some("decker_sam".to_string()),
            notes: "Contains 6 trauma patches".to_string(),
        });

        assert_eq!(ledger.inventory.len(), 1);
        ledger.save_to_file(&ledger_path).unwrap();

        let reloaded = PartyLedger::load_or_create(&ledger_path, "campaign_shadowrun").unwrap();
        assert_eq!(*reloaded.shared_funds.get("¥").unwrap(), 15000);
        assert_eq!(reloaded.inventory[0].quantity, 2);
    }
}

