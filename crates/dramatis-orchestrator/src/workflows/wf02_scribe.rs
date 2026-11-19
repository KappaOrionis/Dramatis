use std::collections::HashMap;
use std::path::Path;
use std::time::Instant;
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;

use dramatis_core::TheaterSnapshotManager;
use dramatis_rag::{
    AutoWikilinker, EntityResolutionResult, EntityResolver, NonDestructiveWikiPatcher,
};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::validation::{build_unified_diff, MutationProposal};
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct ScribeInput {
    pub entity_title: String,
    pub category: String,
    pub section_title: String,
    pub aliases: Vec<String>,
    pub markdown_delta: String,
}

impl Default for ScribeInput {
    fn default() -> Self {
        Self {
            entity_title: String::new(),
            category: "concepts".to_string(),
            section_title: "Notes du Scribe".to_string(),
            aliases: Vec::new(),
            markdown_delta: String::new(),
        }
    }
}

/// WF-02 (`dramatis.scribe`): Entity resolution, lock check, AutoWikilinker, and non-destructive Wiki patch.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: ScribeInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-02 invalide: {}", e)))?;

    if input.entity_title.trim().is_empty() {
        return Err(OrchestratorError::InvalidConfig(
            "Le champ `entity_title` est requis pour WF-02.".to_string(),
        ));
    }

    let mut steps = Vec::new();
    let kg_path = ctx.theater_root.join("04_index").join("knowledge_graph.sqlite");

    // Step 1: Extract candidates
    let t1 = Instant::now();
    let valid_categories = [
        "histoire", "lieux", "pnj", "bestiaire", "factions", "objets", "concepts",
    ];
    let category = if valid_categories.contains(&input.category.as_str()) {
        input.category.clone()
    } else {
        "concepts".to_string()
    };
    steps.push(StepTrace {
        step_id: "extract_candidates".to_string(),
        name: "Extraction des entités & relations".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!("Entité '{}' (catégorie: {})", input.entity_title, category),
        metadata: json!({ "entity_title": input.entity_title, "category": category }),
    });

    // Step 2: Entity resolution against knowledge_graph.sqlite
    let t2 = Instant::now();
    let resolution = if ctx.workflow_config.is_step_enabled("entity_resolution") && kg_path.exists()
    {
        EntityResolver::resolve(&kg_path, &input.entity_title, &input.aliases)
            .unwrap_or_else(|_| EntityResolutionResult::CreateNew {
                proposed_title: input.entity_title.clone(),
            })
    } else {
        EntityResolutionResult::CreateNew {
            proposed_title: input.entity_title.clone(),
        }
    };

    let (canonical_title, action_taken, resolution_score) = match &resolution {
        EntityResolutionResult::MergeWithExisting {
            canonical_title,
            score,
            ..
        } => (canonical_title.clone(), "merged", *score),
        EntityResolutionResult::HumanReviewRequired {
            candidate_title,
            score,
            ..
        } => (candidate_title.clone(), "queued_for_review", *score),
        EntityResolutionResult::CreateNew { proposed_title } => {
            (proposed_title.clone(), "created", 0.0)
        }
    };

    steps.push(StepTrace {
        step_id: "entity_resolution".to_string(),
        name: "Résolution anti-doublon (knowledge_graph)".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: format!(
            "Résultat: '{}' -> action='{}' (score {:.2})",
            canonical_title, action_taken, resolution_score
        ),
        metadata: json!({
            "canonical_title": canonical_title,
            "action_taken": action_taken,
            "score": resolution_score
        }),
    });

    // Step 3: Lock check & load original markdown if present
    let t3 = Instant::now();
    let slug = slugify(&canonical_title);
    let rel_path = format!("01_wiki/{}/{}.md", category, slug);
    let target_file = ctx.theater_root.join("01_wiki").join(&category).join(format!("{}.md", slug));
    let original_md = if target_file.exists() {
        std::fs::read_to_string(&target_file)?
    } else {
        format!("# {}\n", canonical_title)
    };
    let has_locked_blocks = original_md.contains("<!-- LOCKED_BY_USER -->");
    steps.push(StepTrace {
        step_id: "lock_check".to_string(),
        name: "Contrôle des verrous <!-- LOCKED_BY_USER -->".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: if has_locked_blocks {
            format!("Sections verrouillées détectées dans {}", rel_path)
        } else {
            format!("Aucun verrou dans {}", rel_path)
        },
        metadata: json!({ "has_locked_blocks": has_locked_blocks, "target_path": rel_path }),
    });

    // Step 4: Auto-wikilinking via Aho-Corasick
    let t4 = Instant::now();
    let auto_wikilink_enabled = ctx
        .agent_config
        .workflow_params
        .get("auto_wikilink")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let linked_delta = if ctx.workflow_config.is_step_enabled("auto_wikilink") && auto_wikilink_enabled
    {
        let entries = load_kg_entries(&kg_path, &canonical_title, &input.aliases);
        if entries.is_empty() {
            input.markdown_delta.clone()
        } else {
            let linker = AutoWikilinker::new(entries);
            linker.link_text(&input.markdown_delta)
        }
    } else {
        input.markdown_delta.clone()
    };

    let links_injected = linked_delta.matches("[[").count();
    steps.push(StepTrace {
        step_id: "auto_wikilink".to_string(),
        name: "Injection Aho-Corasick [[WikiLinks]]".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t4),
        summary: format!("{} lien(s) wiki présent(s)", links_injected),
        metadata: json!({ "links_injected": links_injected }),
    });

    // Step 5: Non-destructive Markdown patch + unified diff proposal
    let t5 = Instant::now();
    let proposed_md = NonDestructiveWikiPatcher::patch_markdown(
        &original_md,
        &input.section_title,
        &linked_delta,
    );
    let diff_preview = build_unified_diff(&original_md, &proposed_md);

    let mutation_payload = json!({
        "relative_path": rel_path,
        "canonical_title": canonical_title,
        "category": category,
        "aliases": input.aliases,
        "proposed_markdown": proposed_md,
        "action_taken": action_taken,
    });

    steps.push(StepTrace {
        step_id: "diff_proposal".to_string(),
        name: "Préparation du patch & diff unifié".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t5),
        summary: format!("Patch prêt pour {}", rel_path),
        metadata: json!({ "target_path": rel_path }),
    });

    let output = json!({
        "action_taken": action_taken,
        "canonical_path": rel_path,
        "canonical_title": canonical_title,
        "links_injected": links_injected,
        "diff_preview": diff_preview,
        "proposed_markdown": proposed_md,
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        expected_schema: json!({
            "type": "object",
            "required": ["action_taken", "canonical_path", "links_injected"],
            "properties": {
                "action_taken": { "type": "string", "enum": ["merged", "created", "queued_for_review"] },
                "canonical_path": { "type": "string" },
                "links_injected": { "type": "integer" }
            }
        }),
        original_markdown: Some(original_md),
        proposed_markdown: Some(proposed_md),
        mutation_proposal: Some(MutationProposal {
            action_kind: "scribe_write_wiki".to_string(),
            target_path: rel_path.clone(),
            summary: format!("Mise à jour Wiki `{}` ({})", canonical_title, action_taken),
            diff_preview,
            payload: mutation_payload,
        }),
        ..WorkflowOutcome::default()
    })
}

/// Persists an approved WF-02 Wiki mutation to disk, updates `knowledge_graph.sqlite`, and commits a Git snapshot.
pub fn apply_mutation(
    theater_root: &Path,
    payload: &serde_json::Value,
) -> Result<(), OrchestratorError> {
    let rel_path = payload["relative_path"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing relative_path in Scribe payload".into()))?;
    let canonical_title = payload["canonical_title"]
        .as_str()
        .unwrap_or("Entité");
    let category = payload["category"].as_str().unwrap_or("concepts");
    let proposed_md = payload["proposed_markdown"]
        .as_str()
        .ok_or_else(|| OrchestratorError::Execution("Missing proposed_markdown in Scribe payload".into()))?;

    let full_path = theater_root.join(rel_path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&full_path, proposed_md)?;

    // Upsert entity in knowledge_graph.sqlite
    let kg_path = theater_root.join("04_index").join("knowledge_graph.sqlite");
    if kg_path.exists() {
        let conn = Connection::open(&kg_path)?;
        let now = chrono::Utc::now().timestamp();
        let eid = format!("ent_{}", slugify(canonical_title));
        conn.execute(
            r#"
            INSERT INTO entities (entity_id, canonical_title, category, relative_path, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?5)
            ON CONFLICT(canonical_title) DO UPDATE SET
                relative_path = excluded.relative_path,
                category = excluded.category,
                updated_at = excluded.updated_at
            "#,
            rusqlite::params![eid, canonical_title, category, rel_path, now],
        )?;

        if let Some(aliases) = payload["aliases"].as_array() {
            for a in aliases {
                if let Some(a_str) = a.as_str() {
                    if !a_str.trim().is_empty() {
                        let _ = conn.execute(
                            "INSERT INTO aliases (entity_id, alias) VALUES (?1, ?2)",
                            rusqlite::params![eid, a_str.trim()],
                        );
                    }
                }
            }
        }
    }

    let snap_mgr = TheaterSnapshotManager::new(theater_root);
    let _ = snap_mgr.create_snapshot(&format!("scribe: update {}", canonical_title));

    Ok(())
}

fn load_kg_entries(
    kg_path: &Path,
    self_title: &str,
    self_aliases: &[String],
) -> HashMap<String, Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    if !self_aliases.is_empty() {
        map.insert(self_title.to_string(), self_aliases.to_vec());
    }
    let Ok(conn) = Connection::open(kg_path) else {
        return map;
    };
    if let Ok(mut stmt) = conn.prepare("SELECT entity_id, canonical_title FROM entities") {
        if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))) {
            for row in rows.flatten() {
                let (eid, title) = row;
                let mut aliases = Vec::new();
                if let Ok(mut a_stmt) = conn.prepare("SELECT alias FROM aliases WHERE entity_id = ?1") {
                    if let Ok(a_rows) = a_stmt.query_map([&eid], |r| r.get::<_, String>(0)) {
                        for a in a_rows.flatten() {
                            aliases.push(a);
                        }
                    }
                }
                map.entry(title).or_default().extend(aliases);
            }
        }
    }
    map
}

fn normalize_latin_char(c: char) -> char {
    match c {
        'à' | 'â' | 'ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'î' | 'ï' => 'i',
        'ô' | 'ö' => 'o',
        'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        other => other,
    }
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut prev_underscore = false;
    for raw_c in input.trim().to_lowercase().chars() {
        let c = normalize_latin_char(raw_c);
        if c.is_ascii_alphanumeric() {
            out.push(c);
            prev_underscore = false;
        } else if !prev_underscore && !out.is_empty() {
            out.push('_');
            prev_underscore = true;
        }
    }
    let trimmed = out.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "entity".to_string()
    } else {
        trimmed
    }
}
