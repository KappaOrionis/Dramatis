use std::collections::HashMap;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

/// Semantic tag definition attached to source documents (`00_sources/`).
/// Canonical `id` values remain strict English `snake_case`; localized UI names live in `labels`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct TagDefinition {
    pub id: String,
    pub is_builtin: bool,
    pub color: String,
    pub labels: HashMap<String, String>,
    pub target_workflows: Vec<String>,
    pub gm_only: bool,
}

impl Default for TagDefinition {
    fn default() -> Self {
        Self {
            id: String::new(),
            is_builtin: false,
            color: "cobalt".to_string(),
            labels: HashMap::new(),
            target_workflows: vec!["WF-01".to_string()],
            gm_only: false,
        }
    }
}

/// Per-theater source semantic tag registry persisted at `00_config/source_tags.yaml`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct SourceTagsCatalog {
    pub custom_tags: Vec<TagDefinition>,
    pub file_tags: HashMap<String, Vec<String>>,
}

/// Stateless helpers for loading, saving, inferring, and managing semantic source tags.
pub struct SourceTagRegistry;

impl SourceTagRegistry {
    /// Path to the per-theater YAML catalog (`00_config/source_tags.yaml`).
    pub fn catalog_path(theater_root: &Path) -> PathBuf {
        theater_root.join("00_config").join("source_tags.yaml")
    }

    /// Returns the 7 canonical built-in English tags with 5-language translations (`fr`, `en`, `es`, `de`, `pt`).
    pub fn builtin_tags() -> Vec<TagDefinition> {
        vec![
            Self::make_builtin(
                "rules",
                "gold",
                &[
                    ("fr", "Règles"),
                    ("en", "Rules"),
                    ("es", "Reglas"),
                    ("de", "Regeln"),
                    ("pt", "Regras"),
                ],
                &["WF-01", "WF-03", "WF-08"],
                false,
            ),
            Self::make_builtin(
                "background",
                "cobalt",
                &[
                    ("fr", "Background"),
                    ("en", "Background"),
                    ("es", "Trasfondo"),
                    ("de", "Hintergrund"),
                    ("pt", "Cenário"),
                ],
                &["WF-01", "WF-02", "WF-06"],
                false,
            ),
            Self::make_builtin(
                "characters",
                "emerald",
                &[
                    ("fr", "Personnages"),
                    ("en", "Characters"),
                    ("es", "Personajes"),
                    ("de", "Charaktere"),
                    ("pt", "Personagens"),
                ],
                &["WF-01", "WF-04", "WF-07"],
                false,
            ),
            Self::make_builtin(
                "scenario",
                "violet",
                &[
                    ("fr", "Scénario"),
                    ("en", "Scenario"),
                    ("es", "Escenario"),
                    ("de", "Szenario"),
                    ("pt", "Aventura"),
                ],
                &["WF-01", "WF-05", "WF-06"],
                false,
            ),
            Self::make_builtin(
                "grimoire_gear",
                "cyan",
                &[
                    ("fr", "Grimoire & Équipement"),
                    ("en", "Grimoire & Gear"),
                    ("es", "Grimorio y Equipo"),
                    ("de", "Grimoire & Ausrüstung"),
                    ("pt", "Grimório e Equipamento"),
                ],
                &["WF-01", "WF-03", "WF-04"],
                false,
            ),
            Self::make_builtin(
                "sheets_aids",
                "slate",
                &[
                    ("fr", "Fiches & Aides de jeu"),
                    ("en", "Sheets & Handouts"),
                    ("es", "Hojas y Ayudas"),
                    ("de", "Bögen & Spielhilfen"),
                    ("pt", "Fichas e Auxílios"),
                ],
                &["WF-04", "WF-08"],
                false,
            ),
            Self::make_builtin(
                "gm_secret",
                "coral",
                &[
                    ("fr", "Secret MJ"),
                    ("en", "GM Secret"),
                    ("es", "Secreto DJ"),
                    ("de", "SL-Geheimnis"),
                    ("pt", "Segredo Mestre"),
                ],
                &["WF-05", "WF-06"],
                true,
            ),
        ]
    }

    fn make_builtin(
        id: &str,
        color: &str,
        labels: &[(&str, &str)],
        target_workflows: &[&str],
        gm_only: bool,
    ) -> TagDefinition {
        let mut label_map = HashMap::new();
        for (lang, val) in labels {
            label_map.insert((*lang).to_string(), (*val).to_string());
        }
        TagDefinition {
            id: id.to_string(),
            is_builtin: true,
            color: color.to_string(),
            labels: label_map,
            target_workflows: target_workflows.iter().map(|s| (*s).to_string()).collect(),
            gm_only,
        }
    }

    /// Normalizes any raw tag string into a clean ASCII `snake_case` identifier.
    pub fn normalize_tag_id(raw: &str) -> String {
        let mut out = String::new();
        let mut prev_underscore = false;

        for ch in raw.trim().to_lowercase().chars() {
            let folded = match ch {
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'à' | 'â' | 'ä' => 'a',
                'ç' => 'c',
                'ô' | 'ö' => 'o',
                'ù' | 'û' | 'ü' => 'u',
                'î' | 'ï' => 'i',
                'ñ' => 'n',
                _ => ch,
            };

            if folded.is_ascii_alphanumeric() {
                out.push(folded);
                prev_underscore = false;
            } else if !prev_underscore && !out.is_empty() {
                out.push('_');
                prev_underscore = true;
            }
        }

        while out.ends_with('_') {
            out.pop();
        }
        out
    }

    /// Loads the theater's semantic tag catalog from disk, returning empty defaults if absent.
    pub fn load(theater_root: &Path) -> SourceTagsCatalog {
        let path = Self::catalog_path(theater_root);
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(parsed) = serde_yaml::from_str::<SourceTagsCatalog>(&content) {
                return parsed;
            }
        }
        SourceTagsCatalog::default()
    }

    /// Persists the semantic tag catalog to `00_config/source_tags.yaml`.
    pub fn save(theater_root: &Path, catalog: &SourceTagsCatalog) -> Result<(), std::io::Error> {
        let path = Self::catalog_path(theater_root);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let yaml = serde_yaml::to_string(catalog).map_err(std::io::Error::other)?;
        std::fs::write(path, yaml)
    }

    /// Combines built-in tags and user-defined custom tags in stable order.
    pub fn all_tag_definitions(catalog: &SourceTagsCatalog) -> Vec<TagDefinition> {
        let mut defs = Self::builtin_tags();
        let builtin_ids: Vec<String> = defs.iter().map(|d| d.id.clone()).collect();
        for custom in &catalog.custom_tags {
            if !builtin_ids.contains(&custom.id) {
                let mut cloned = custom.clone();
                cloned.is_builtin = false;
                defs.push(cloned);
            }
        }
        defs
    }

    /// Infers one or more canonical English tags from filename and optional excerpt.
    pub fn infer_tags_for_source(file_name: &str, text_excerpt: Option<&str>) -> Vec<String> {
        let lower_name = file_name.to_ascii_lowercase();
        let lower_excerpt = text_excerpt
            .unwrap_or("")
            .chars()
            .take(1500)
            .collect::<String>()
            .to_ascii_lowercase();
        let combined = if lower_excerpt.is_empty() {
            lower_name.clone()
        } else {
            format!("{} {}", lower_name, lower_excerpt)
        };

        let mut inferred: Vec<String> = Vec::new();

        let is_sheet = [
            "charsheet",
            "sheet",
            "recordsheet",
            "record_sheet",
            "fiche",
            "feuille",
            "screen",
            "ecran",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw));
        if is_sheet {
            push_unique(&mut inferred, "sheets_aids");
            if lower_name.contains("charsheet")
                || lower_name.contains("char")
                || lower_name.contains("perso")
            {
                push_unique(&mut inferred, "characters");
            }
            if lower_name.contains("covenant") || lower_name.contains("alliance") {
                push_unique(&mut inferred, "background");
            }
        }

        let is_grimoire = [
            "spell",
            "grimoire",
            "sort",
            "equip",
            "gear",
            "armory",
            "bestiar",
            "monster",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw) || combined.contains(kw));
        if is_grimoire && (lower_name.contains("spell") || lower_name.contains("grimoire") || lower_name.contains("gear") || lower_name.contains("armory") || lower_name.contains("bestiar")) {
            push_unique(&mut inferred, "grimoire_gear");
            if lower_name.contains("spell")
                || lower_name.contains("grimoire")
                || lower_name.contains("hermetic")
            {
                push_unique(&mut inferred, "rules");
            }
        }

        let is_scenario = [
            "adventure",
            "scenario",
            "scénario",
            "campaign",
            "campagne",
            "broken covenant",
            "module",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw));
        if is_scenario {
            push_unique(&mut inferred, "scenario");
        }

        let is_rules = [
            "core rules",
            "core_rules",
            "definitive edition",
            "rulebook",
            "rules",
            "regles",
            "règles",
            "manuel",
            "combat",
            ".xlsx",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw));
        if is_rules {
            push_unique(&mut inferred, "rules");
        }

        let is_characters = [
            "magi of",
            "magi_of",
            "npc",
            "pnj",
            "persona",
            "character",
            "personnage",
            "pregen",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw));
        if is_characters {
            push_unique(&mut inferred, "characters");
        }

        let is_background = [
            "house",
            "lineage",
            "lore",
            "setting",
            "history",
            "atlas",
            "world",
            "background",
            "univers",
            "magi of",
            "magi_of",
        ]
        .iter()
        .any(|kw| lower_name.contains(kw));
        if is_background {
            push_unique(&mut inferred, "background");
        }

        let is_secret = ["secret", "gm_only", "mj_only", "spoiler"]
            .iter()
            .any(|kw| combined.contains(kw));
        if is_secret {
            push_unique(&mut inferred, "gm_secret");
        }

        if inferred.is_empty() {
            inferred.push("background".to_string());
        }
        inferred
    }

    /// Returns the resolved multi-tag list for a file (explicit assignment if saved, else inferred).
    pub fn tags_for_file(catalog: &SourceTagsCatalog, file_name: &str) -> Vec<String> {
        if let Some(explicit) = catalog.file_tags.get(file_name) {
            return normalize_tag_list(explicit);
        }
        Self::infer_tags_for_source(file_name, None)
    }

    /// Checks whether any tag assigned to `file_name` marks it as restricted to the Game Master.
    pub fn is_gm_only_file(catalog: &SourceTagsCatalog, file_name: &str) -> bool {
        let defs = Self::all_tag_definitions(catalog);
        let tags = Self::tags_for_file(catalog, file_name);
        tags.iter().any(|tid| {
            tid == "gm_secret"
                || defs
                    .iter()
                    .find(|d| d.id == *tid)
                    .map(|d| d.gm_only)
                    .unwrap_or(false)
        })
    }

    /// Creates or updates a user-defined custom tag in `00_config/source_tags.yaml`.
    pub fn upsert_custom_tag(
        theater_root: &Path,
        mut def: TagDefinition,
    ) -> Result<SourceTagsCatalog, std::io::Error> {
        let normalized_id = Self::normalize_tag_id(&def.id);
        if normalized_id.is_empty() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Tag id cannot be empty",
            ));
        }

        // Prevent overwriting built-in tag identifiers via custom creation.
        if Self::builtin_tags().iter().any(|b| b.id == normalized_id) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                format!("Tag '{}' is a built-in system tag", normalized_id),
            ));
        }

        def.id = normalized_id.clone();
        def.is_builtin = false;
        if def.color.trim().is_empty() {
            def.color = "cobalt".to_string();
        }
        if def.target_workflows.is_empty() {
            def.target_workflows = vec!["WF-01".to_string()];
        }

        let mut catalog = Self::load(theater_root);
        if let Some(existing) = catalog
            .custom_tags
            .iter_mut()
            .find(|t| t.id == normalized_id)
        {
            *existing = def;
        } else {
            catalog.custom_tags.push(def);
        }
        Self::save(theater_root, &catalog)?;
        Ok(catalog)
    }

    /// Deletes a custom user tag and detaches it from any tagged documents.
    pub fn delete_custom_tag(
        theater_root: &Path,
        raw_tag_id: &str,
    ) -> Result<SourceTagsCatalog, std::io::Error> {
        let norm = Self::normalize_tag_id(raw_tag_id);
        if Self::builtin_tags().iter().any(|b| b.id == norm) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Built-in tag '{}' cannot be deleted", norm),
            ));
        }

        let mut catalog = Self::load(theater_root);
        catalog.custom_tags.retain(|t| t.id != norm);
        for tags in catalog.file_tags.values_mut() {
            tags.retain(|t| *t != norm);
        }
        Self::save(theater_root, &catalog)?;
        Ok(catalog)
    }

    /// Sets the explicit multi-tag list for a source filename inside `00_config/source_tags.yaml`.
    pub fn set_file_tags(
        theater_root: &Path,
        file_name: &str,
        tags: Vec<String>,
    ) -> Result<Vec<String>, std::io::Error> {
        let mut catalog = Self::load(theater_root);
        let normalized = normalize_tag_list(&tags);
        catalog
            .file_tags
            .insert(file_name.to_string(), normalized.clone());
        Self::save(theater_root, &catalog)?;
        Ok(normalized)
    }

    /// Removes explicit tag mappings for a deleted source file.
    pub fn remove_file_entry(
        theater_root: &Path,
        file_name: &str,
    ) -> Result<(), std::io::Error> {
        let mut catalog = Self::load(theater_root);
        if catalog.file_tags.remove(file_name).is_some() {
            Self::save(theater_root, &catalog)?;
        }
        Ok(())
    }
}

fn push_unique(list: &mut Vec<String>, item: &str) {
    if !list.iter().any(|x| x == item) {
        list.push(item.to_string());
    }
}

fn normalize_tag_list(raw_tags: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for raw in raw_tags {
        let id = SourceTagRegistry::normalize_tag_id(raw);
        if !id.is_empty() && !normalized.contains(&id) {
            normalized.push(id);
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_builtin_tags_use_strict_english_ids_and_five_locales() {
        let builtins = SourceTagRegistry::builtin_tags();
        assert_eq!(builtins.len(), 7);
        for tag in &builtins {
            assert!(tag.id.chars().all(|c| c.is_ascii_lowercase() || c == '_'));
            for lang in ["fr", "en", "es", "de", "pt"] {
                assert!(tag.labels.contains_key(lang), "missing {} for {}", lang, tag.id);
            }
        }
        assert!(builtins.iter().any(|t| t.id == "gm_secret" && t.gm_only));
    }

    #[test]
    fn test_normalize_tag_id_folds_diacritics_to_ascii_snake_case() {
        assert_eq!(
            SourceTagRegistry::normalize_tag_id("Trésors & Reliques !"),
            "tresors_reliques"
        );
        assert_eq!(
            SourceTagRegistry::normalize_tag_id("Scénario d'Hiver"),
            "scenario_d_hiver"
        );
    }

    #[test]
    fn test_infer_tags_on_ars_magica_corpus_examples() {
        assert_eq!(
            SourceTagRegistry::infer_tags_for_source("Ars Magica - Definitive Edition (Core Rules).md", None),
            vec!["rules".to_string()]
        );
        assert_eq!(
            SourceTagRegistry::infer_tags_for_source("Ars Magica 5e - Houses of Hermes - True Lineages.md", None),
            vec!["background".to_string()]
        );
        assert_eq!(
            SourceTagRegistry::infer_tags_for_source("Ars Magica 5e - Adventure - Broken Covenant of Calebais.md", None),
            vec!["scenario".to_string()]
        );
        let magi_tags = SourceTagRegistry::infer_tags_for_source("Ars Magica 5e - Magi of Hermes.md", None);
        assert!(magi_tags.contains(&"characters".to_string()));
        assert!(magi_tags.contains(&"background".to_string()));

        let grimoire_tags = SourceTagRegistry::infer_tags_for_source("arm5-grand-grimoire-of-hermetic-spells.pdf", None);
        assert!(grimoire_tags.contains(&"grimoire_gear".to_string()));
        assert!(grimoire_tags.contains(&"rules".to_string()));

        let charsheet_tags = SourceTagRegistry::infer_tags_for_source("ArM5Charsheet-NEW.pdf", None);
        assert!(charsheet_tags.contains(&"sheets_aids".to_string()));
    }

    #[test]
    fn test_custom_tag_crud_and_multi_tag_persistence_and_epistemic_lock() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        let mut custom_labels = HashMap::new();
        custom_labels.insert("fr".to_string(), "Bestiaire".to_string());
        custom_labels.insert("en".to_string(), "Bestiary".to_string());

        let custom = TagDefinition {
            id: "Bestiaire".to_string(),
            is_builtin: false,
            color: "emerald".to_string(),
            labels: custom_labels,
            target_workflows: vec!["WF-01".to_string(), "WF-05".to_string()],
            gm_only: false,
        };
        let cat = SourceTagRegistry::upsert_custom_tag(root, custom).unwrap();
        assert_eq!(cat.custom_tags.len(), 1);
        assert_eq!(cat.custom_tags[0].id, "bestiaire");

        let saved_tags = SourceTagRegistry::set_file_tags(
            root,
            "monstres_secrets.md",
            vec!["bestiaire".to_string(), "gm_secret".to_string()],
        )
        .unwrap();
        assert_eq!(saved_tags, vec!["bestiaire".to_string(), "gm_secret".to_string()]);

        let reloaded = SourceTagRegistry::load(root);
        assert!(SourceTagRegistry::is_gm_only_file(&reloaded, "monstres_secrets.md"));
        assert!(!SourceTagRegistry::is_gm_only_file(&reloaded, "Ars Magica - Definitive Edition (Core Rules).md"));

        // Built-in tags cannot be deleted
        assert!(SourceTagRegistry::delete_custom_tag(root, "rules").is_err());

        // Custom tags can be deleted cleanly and detached from files
        let after_delete = SourceTagRegistry::delete_custom_tag(root, "bestiaire").unwrap();
        assert!(after_delete.custom_tags.is_empty());
        assert_eq!(
            SourceTagRegistry::tags_for_file(&after_delete, "monstres_secrets.md"),
            vec!["gm_secret".to_string()]
        );
    }
}
