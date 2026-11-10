use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::acl::Role;
use crate::chronos::ChronosConfig;
use crate::database::{SchemaInitError, TheaterDatabaseInitializer};

#[derive(Error, Debug)]
pub enum TheaterError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML serialization error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Database initialization error: {0}")]
    Db(#[from] SchemaInitError),
    #[error("Invalid theater format at {0}")]
    InvalidFormat(PathBuf),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TheaterManifest {
    pub name: String,
    pub version: String,
    pub system_id: String,
    pub description: String,
    pub privacy_mode: Option<String>,
    pub chronos: ChronosConfig,
    pub default_role: Option<Role>,
}

impl Default for TheaterManifest {
    fn default() -> Self {
        Self {
            name: "Nouveau Théâtre".to_string(),
            version: "2.1.0".to_string(),
            system_id: "generic".to_string(),
            description: "Théâtre de jeu de rôle Dramatis".to_string(),
            privacy_mode: Some("hybrid".to_string()),
            chronos: ChronosConfig::default(),
            default_role: Some(Role::Player),
        }
    }
}

pub struct TheaterWorkspace {
    pub root: PathBuf,
    pub manifest: TheaterManifest,
}

impl TheaterWorkspace {
    pub fn create_new<P: AsRef<Path>>(root: P, manifest: TheaterManifest) -> Result<Self, TheaterError> {
        let root = root.as_ref().to_path_buf();
        std::fs::create_dir_all(&root)?;

        let subdirs = [
            "00_sources",
            "00_sources/extracted_assets",
            "01_wiki",
            "01_wiki/histoire",
            "01_wiki/lieux",
            "01_wiki/pnj",
            "01_wiki/bestiaire",
            "01_wiki/factions",
            "01_wiki/objets",
            "01_wiki/concepts",
            "02_machina",
            "03_personae",
            "04_index",
            "05_plays",
        ];

        for dir in subdirs {
            std::fs::create_dir_all(root.join(dir))?;
        }

        let manifest_content = serde_yaml::to_string(&manifest)?;
        std::fs::write(root.join("theater.yaml"), manifest_content)?;

        let default_lexicon = "# Glossaire Bilingue FR <-> EN pour requêtes BM25\nterms: []\n";
        std::fs::write(root.join("lexicon.yaml"), default_lexicon)?;

        // Initialisation automatique des 3 bases de données SQLite du Théâtre
        TheaterDatabaseInitializer::init_manifest_db(root.join("04_index/manifest.sqlite"))?;
        TheaterDatabaseInitializer::init_knowledge_graph_db(root.join("04_index/knowledge_graph.sqlite"))?;
        TheaterDatabaseInitializer::init_machina_tables_db(root.join("02_machina/tables.sqlite"))?;

        Ok(Self { root, manifest })
    }

    pub fn open<P: AsRef<Path>>(root: P) -> Result<Self, TheaterError> {
        let root = root.as_ref().to_path_buf();
        let manifest_path = root.join("theater.yaml");
        if !manifest_path.exists() {
            return Err(TheaterError::InvalidFormat(manifest_path));
        }

        let content = std::fs::read_to_string(&manifest_path)?;
        let manifest: TheaterManifest = serde_yaml::from_str(&content)?;

        Ok(Self { root, manifest })
    }
}

