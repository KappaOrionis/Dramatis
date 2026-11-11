use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::acl::Role;
use crate::chronos::ChronosConfig;
use crate::database::{SchemaInitError, TheaterDatabaseInitializer};
use crate::snapshot::TheaterSnapshotManager;

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
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(alias = "system_preset", default = "default_system_id")]
    pub system_id: String,
    #[serde(default = "default_description")]
    pub description: String,
    #[serde(default = "default_privacy")]
    pub privacy_mode: Option<String>,
    #[serde(default)]
    pub chronos: ChronosConfig,
    pub default_role: Option<Role>,
    #[serde(alias = "theater_id")]
    pub theater_id: Option<String>,
    #[serde(default)]
    pub default_language: Option<String>,
    #[serde(default)]
    pub agent_routing: Option<std::collections::HashMap<String, String>>,
}

fn default_version() -> String {
    "2.1.0".to_string()
}

fn default_system_id() -> String {
    "generic".to_string()
}

fn default_description() -> String {
    "Théâtre de jeu de rôle Dramatis".to_string()
}

fn default_privacy() -> Option<String> {
    Some("strict_local".to_string())
}

impl Default for TheaterManifest {
    fn default() -> Self {
        Self {
            name: "Nouveau Théâtre".to_string(),
            version: "2.1.0".to_string(),
            system_id: "generic".to_string(),
            description: "Théâtre de jeu de rôle Dramatis".to_string(),
            privacy_mode: Some("strict_local".to_string()),
            chronos: ChronosConfig::default(),
            default_role: Some(Role::Player),
            theater_id: None,
            default_language: Some("fr".to_string()),
            agent_routing: None,
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

        // Initialisation Git atomique si possible (THE-04)
        let snap_mgr = TheaterSnapshotManager::new(&root);
        let _ = snap_mgr.ensure_git_initialized();
        let _ = snap_mgr.create_snapshot("chore: initialize theater workspace");

        Ok(Self { root, manifest })
    }

    pub fn open<P: AsRef<Path>>(root: P) -> Result<Self, TheaterError> {
        let root = root.as_ref().to_path_buf();
        let manifest_path = root.join("theater.yaml");
        if !manifest_path.exists() {
            return Err(TheaterError::InvalidFormat(manifest_path));
        }

        // Assurer que les bases SQLite existent et ont le schéma unifié à l'ouverture
        let _ = std::fs::create_dir_all(root.join("04_index"));
        let _ = std::fs::create_dir_all(root.join("02_machina"));
        TheaterDatabaseInitializer::init_manifest_db(root.join("04_index/manifest.sqlite"))?;
        TheaterDatabaseInitializer::init_knowledge_graph_db(root.join("04_index/knowledge_graph.sqlite"))?;
        TheaterDatabaseInitializer::init_machina_tables_db(root.join("02_machina/tables.sqlite"))?;

        let content = std::fs::read_to_string(&manifest_path)?;
        let manifest: TheaterManifest = serde_yaml::from_str(&content)?;

        Ok(Self { root, manifest })
    }

    /// Clones an entire Theater workspace into a new destination directory (`THE-01`)
    pub fn clone_to<P: AsRef<Path>>(&self, target_root: P, new_name: Option<String>) -> Result<Self, TheaterError> {
        let target = target_root.as_ref().to_path_buf();
        copy_dir_recursive(&self.root, &target)?;

        let mut cloned_manifest = self.manifest.clone();
        if let Some(name) = new_name {
            cloned_manifest.name = name;
            let yaml = serde_yaml::to_string(&cloned_manifest)?;
            std::fs::write(target.join("theater.yaml"), yaml)?;
        }

        Self::open(target)
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let name = entry.file_name();
        if name == ".git" {
            continue;
        }
        let dst_path = dst.join(name);
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &dst_path)?;
        } else {
            std::fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(())
}
