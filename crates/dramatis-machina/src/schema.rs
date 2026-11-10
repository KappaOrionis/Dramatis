use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SchemaError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeDefinition {
    pub key: String,
    pub label: String,
    pub min_val: i64,
    pub max_val: i64,
    pub default_val: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DerivedStatDefinition {
    pub key: String,
    pub label: String,
    pub rhai_formula: String, // e.g. "body + willpower"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorDefinition {
    pub key: String,
    pub label: String,
    pub capacity_formula: String, // e.g. "8 + (body / 2)"
    pub penalty_interval: Option<u32>, // e.g. every 3 boxes gives -1 penalty
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSchema {
    pub system_id: String,
    pub system_name: String,
    pub version: String,
    pub dice_paradigm: String, // "d20", "shadowrun_d6", "ars_magica_stress", etc.
    pub attributes: Vec<AttributeDefinition>,
    pub derived_stats: Vec<DerivedStatDefinition>,
    pub monitors: Vec<MonitorDefinition>,
    pub currencies: Vec<String>,
    pub metadata: HashMap<String, String>,
}

impl SystemSchema {
    pub fn load_from_file(path: &Path) -> Result<Self, SchemaError> {
        let content = std::fs::read_to_string(path)?;
        let schema: Self = serde_json::from_str(&content)?;
        schema.validate()?;
        Ok(schema)
    }

    pub fn save_to_file(&self, path: &Path) -> Result<(), SchemaError> {
        self.validate()?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(self)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }

    pub fn validate(&self) -> Result<(), SchemaError> {
        if self.system_id.trim().is_empty() {
            return Err(SchemaError::Validation("system_id cannot be empty".to_string()));
        }
        if self.attributes.is_empty() {
            return Err(SchemaError::Validation("attributes list cannot be empty".to_string()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_system_schema_serialization_and_validation() {
        let temp = tempdir().unwrap();
        let schema_path = temp.path().join("system_schema.json");

        let schema = SystemSchema {
            system_id: "shadowrun_6e".to_string(),
            system_name: "Shadowrun 6th Edition".to_string(),
            version: "1.0.0".to_string(),
            dice_paradigm: "shadowrun_d6".to_string(),
            attributes: vec![
                AttributeDefinition {
                    key: "bod".to_string(),
                    label: "Body".to_string(),
                    min_val: 1,
                    max_val: 10,
                    default_val: 3,
                },
                AttributeDefinition {
                    key: "wil".to_string(),
                    label: "Willpower".to_string(),
                    min_val: 1,
                    max_val: 10,
                    default_val: 3,
                },
            ],
            derived_stats: vec![
                DerivedStatDefinition {
                    key: "composure".to_string(),
                    label: "Composure".to_string(),
                    rhai_formula: "wil + cha".to_string(),
                },
            ],
            monitors: vec![
                MonitorDefinition {
                    key: "physical".to_string(),
                    label: "Physical Condition".to_string(),
                    capacity_formula: "8 + (bod / 2)".to_string(),
                    penalty_interval: Some(3),
                },
            ],
            currencies: vec!["Nuyen (¥)".to_string()],
            metadata: HashMap::new(),
        };

        schema.save_to_file(&schema_path).unwrap();
        assert!(schema_path.exists());

        let loaded = SystemSchema::load_from_file(&schema_path).unwrap();
        assert_eq!(loaded.system_id, "shadowrun_6e");
        assert_eq!(loaded.attributes.len(), 2);
        assert_eq!(loaded.monitors[0].penalty_interval, Some(3));
    }
}
