use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexiconEntry {
    pub fr: String,
    pub en: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LexiconManifest {
    pub terms: Vec<LexiconEntry>,
}

pub struct LexiconEngine {
    fr_to_en: HashMap<String, String>,
    en_to_fr: HashMap<String, String>,
}

impl LexiconEngine {
    pub fn from_file<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let manifest: LexiconManifest = serde_yaml::from_str(&content).unwrap_or_default();

        let mut fr_to_en = HashMap::new();
        let mut en_to_fr = HashMap::new();

        for entry in manifest.terms {
            let fr_lower = entry.fr.to_lowercase();
            let en_lower = entry.en.to_lowercase();

            fr_to_en.insert(fr_lower.clone(), en_lower.clone());
            en_to_fr.insert(en_lower.clone(), fr_lower.clone());

            for alias in entry.aliases {
                let alias_lower = alias.to_lowercase();
                fr_to_en.insert(alias_lower.clone(), en_lower.clone());
                en_to_fr.insert(alias_lower, fr_lower.clone());
            }
        }

        Ok(Self { fr_to_en, en_to_fr })
    }

    pub fn expand_query(&self, query: &str) -> Vec<String> {
        let mut expansions = Vec::new();
        let words: Vec<&str> = query.split_whitespace().collect();

        for word in words {
            let w_lower = word.to_lowercase();
            if let Some(target) = self.fr_to_en.get(&w_lower) {
                expansions.push(target.clone());
            }
            if let Some(target) = self.en_to_fr.get(&w_lower) {
                expansions.push(target.clone());
            }
        }

        expansions
    }
}

