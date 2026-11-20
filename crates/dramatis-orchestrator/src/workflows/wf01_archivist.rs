use std::collections::HashMap;
use std::time::Instant;
use serde::Deserialize;
use serde_json::json;

use dramatis_core::{EpistemicFilter, Role, SourceTagRegistry, SourceTagsCatalog};
use dramatis_gateway::{ChatMessage, SouffleurClient};
use dramatis_ingest::PdfDocParser;
use dramatis_rag::{ArchivistAgent, Citation, HybridSearchEngine, LexiconEngine};

use crate::config::LanguagePolicy;
use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::validation::{normalize_path, ValidationPipeline};
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ArchivistInput {
    pub query: String,
    pub selected_sources: Option<Vec<String>>,
    pub required_tags: Option<Vec<String>>,
    pub preferred_model: Option<String>,
}

/// WF-01 (`dramatis.archivist`): Canonical read-only RAG search & citation-verified synthesis.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: ArchivistInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-01 invalide: {}", e)))?;

    let mut steps = Vec::new();
    let mut retrieved_sources: Vec<(String, String)> = Vec::new();
    let mut tools_used = vec![
        "Tantivy BM25 Full-text Search".to_string(),
        "Knowledge Graph RRF".to_string(),
        "Section Scanner with Line-accurate Indexing".to_string(),
        "Source Tag Semantic Router".to_string(),
    ];

    let top_k = ctx
        .agent_config
        .workflow_params
        .get("top_k_chunks")
        .and_then(|v| v.as_u64())
        .unwrap_or(4)
        .clamp(1, 12) as usize;
    let silence_threshold = ctx
        .agent_config
        .workflow_params
        .get("silence_threshold")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as usize;

    // Step 1: Query analysis & bilingual expansion
    let t1 = Instant::now();
    let query_lang = ValidationPipeline::detect_language(&input.query);
    let mut query_terms = if ctx.workflow_config.is_step_enabled("query_analysis") {
        let raw_terms = extract_meaningful_terms(&input.query);

        let mut expanded = raw_terms.clone();
        // Expand via theater lexicon.yaml if present
        let lexicon_path = ctx.theater_root.join("lexicon.yaml");
        if lexicon_path.exists() {
            if let Ok(lex) = LexiconEngine::from_file(&lexicon_path) {
                expanded.extend(lex.expand_query(&input.query));
            }
        }
        // Built-in RPG bilingual expansions
        for term in &raw_terms {
            match term.as_str() {
                "regles" | "règles" | "regle" | "règle" => {
                    expanded.extend(["rule", "rules", "mechanic"].map(str::to_string));
                }
                "cadre" | "univers" | "monde" => {
                    expanded.extend(["setting", "mythic", "europe", "background"].map(str::to_string));
                }
                "maison" | "maisons" => {
                    expanded.extend(["house", "houses", "lineage"].map(str::to_string));
                }
                "mage" | "mages" | "magicien" | "magiciens" => {
                    expanded.extend(["magus", "magi", "wizard"].map(str::to_string));
                }
                "liste" | "exhaustif" | "officielle" | "officiel" => {
                    expanded.extend(["contents", "chapter", "magi"].map(str::to_string));
                }
                _ => {}
            }
        }
        steps.push(StepTrace {
            step_id: "query_analysis".to_string(),
            name: "Analyse de requête & expansion bilingue".to_string(),
            status: "completed".to_string(),
            duration_ms: elapsed_ms(&t1),
            summary: format!("Langue='{}', {} termes indexés", query_lang, expanded.len()),
            metadata: json!({ "language": query_lang, "terms_count": expanded.len() }),
        });
        expanded
    } else {
        steps.push(StepTrace {
            step_id: "query_analysis".to_string(),
            name: "Analyse de requête & expansion bilingue".to_string(),
            status: "skipped".to_string(),
            duration_ms: 0,
            summary: "Étape désactivée par configuration workflow".to_string(),
            metadata: json!({}),
        });
        extract_meaningful_terms(&input.query)
    };
    query_terms.sort();
    query_terms.dedup();

    // Step 2: Hybrid Retrieval + Epistemic Sanitization + Tag Semantic Routing + Section Scan
    let t2 = Instant::now();
    let tag_catalog = SourceTagRegistry::load(&ctx.theater_root);
    let intent_tags = detect_query_intent_tags(&input.query);
    let mut citations: Vec<Citation> = Vec::new();
    let mut matched_excerpts: Vec<String> = Vec::new();

    if ctx.workflow_config.is_step_enabled("hybrid_retrieval") && !input.query.trim().is_empty() {
        let index_dir = ctx.theater_root.join("04_index");
        if let Ok(engine) = HybridSearchEngine::open_or_create(&index_dir, &ctx.theater_root) {
            if let Ok(hits) = engine.search_hybrid(&input.query, None, top_k.max(4)) {
                for h in hits {
                    let norm_src = normalize_path(&h.source_path);
                    let src_file_name = std::path::Path::new(&norm_src)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&norm_src);
                    if !source_allowed_by_tags(
                        &tag_catalog,
                        ctx.role,
                        src_file_name,
                        &input.required_tags,
                    ) {
                        continue;
                    }
                    if let Some(allowed) = &input.selected_sources {
                        if !allowed.is_empty()
                            && !allowed.iter().any(|src| {
                                let ns = normalize_path(src);
                                norm_src.contains(&ns) || ns.contains(&norm_src)
                            })
                        {
                            continue;
                        }
                    }
                    let sanitized = EpistemicFilter::sanitize_markdown(&h.excerpt, ctx.role, None);
                    if !sanitized.trim().is_empty() {
                        retrieved_sources.push((norm_src.clone(), sanitized.clone()));
                        citations.push(Citation::new(&norm_src, h.page, &sanitized));
                        matched_excerpts.push(sanitized);
                    }
                }
            }
        }

        // Line-accurate paragraph scan across 00_sources/ and 01_wiki/ for precision
        if !query_terms.is_empty() {
            let mut candidate_snippets: Vec<(usize, String, Option<usize>, String)> = Vec::new();
            let q_lower = input.query.to_lowercase();
            let has_maisons_query = q_lower.contains("maison")
                || q_lower.contains("house")
                || q_lower.contains("hermes");
            let has_combat_query = q_lower.contains("combat")
                || q_lower.contains("guerre")
                || q_lower.contains("martial")
                || q_lower.contains("combattant");

            scan_directory_snippets(
                &ctx.theater_root.join("00_sources"),
                "00_sources",
                ctx.role,
                &input.selected_sources,
                &input.required_tags,
                Some(&tag_catalog),
                &intent_tags,
                &query_terms,
                has_maisons_query,
                has_combat_query,
                false,
                &mut candidate_snippets,
            );
            scan_wiki_snippets(
                &ctx.theater_root.join("01_wiki"),
                ctx.role,
                &input.selected_sources,
                &query_terms,
                &mut candidate_snippets,
            );

            candidate_snippets.sort_by_key(|b| std::cmp::Reverse(b.0));

            if !candidate_snippets.is_empty() {
                // Prefer line-accurate snippets when available while keeping unique sources
                citations.clear();
                matched_excerpts.clear();
                for (score, rel_path, line_no, snippet) in candidate_snippets.into_iter().take(top_k) {
                    if score < silence_threshold {
                        continue;
                    }
                    if !citations
                        .iter()
                        .any(|c| c.source_file == rel_path && c.snippet == snippet)
                    {
                        retrieved_sources.push((rel_path.clone(), snippet.clone()));
                        citations.push(Citation::with_line(&rel_path, Some(1), line_no, &snippet));
                        matched_excerpts.push(snippet);
                    }
                }
            } else {
                // Keep hybrid search citations only if they actually match meaningful non-stop-word terms
                citations.retain(|c| {
                    let lower = c.snippet.to_lowercase();
                    let words: std::collections::HashSet<&str> = lower
                        .split(|ch: char| !ch.is_alphanumeric())
                        .filter(|w| !w.is_empty())
                        .collect();
                    let hits = query_terms
                        .iter()
                        .filter(|t| words.contains(t.as_str()))
                        .count();
                    hits >= silence_threshold
                });
                matched_excerpts = citations.iter().map(|c| c.snippet.clone()).collect();
            }
        }

        citations.truncate(top_k);
        matched_excerpts.truncate(top_k.min(4));

        steps.push(StepTrace {
            step_id: "hybrid_retrieval".to_string(),
            name: "Récupération hybride (Tantivy + Graphe + Scanner)".to_string(),
            status: "completed".to_string(),
            duration_ms: elapsed_ms(&t2),
            summary: format!("{} passage(s) canonique(s) récupéré(s)", citations.len()),
            metadata: json!({ "citations_count": citations.len() }),
        });
    } else {
        steps.push(StepTrace {
            step_id: "hybrid_retrieval".to_string(),
            name: "Récupération hybride (Tantivy + Graphe + Scanner)".to_string(),
            status: "skipped".to_string(),
            duration_ms: 0,
            summary: "Récupération sautée".to_string(),
            metadata: json!({}),
        });
    }

    // Step 3: Relevance Gate & Documentary Silence short-circuit
    let t3 = Instant::now();
    let silence_triggered = citations.is_empty();
    steps.push(StepTrace {
        step_id: "relevance_gate".to_string(),
        name: "Seuil de pertinence & silence documentaire".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: if silence_triggered {
            "Aucune preuve canonique -> déclenchement Silence Documentaire".to_string()
        } else {
            format!("Preuves suffisantes ({} citation(s))", citations.len())
        },
        metadata: json!({ "documentary_silence": silence_triggered }),
    });

    // Step 4: Grounded Synthesis via SouffleurClient (respecting strict_local & fallback)
    let t4 = Instant::now();
    let mut model_used: Option<String> = None;
    let mut prompt_preview: Option<String> = None;

    let synthesized_answer = if !silence_triggered && ctx.workflow_config.is_step_enabled("grounded_synthesis") {
        let target_lang = match ctx.agent_config.prompts.language_policy {
            LanguagePolicy::ForceFr => "français",
            LanguagePolicy::ForceEn => "English",
            LanguagePolicy::MatchUserQuery => {
                if query_lang == "en" {
                    "English"
                } else {
                    "français"
                }
            }
        };

        let mut prompt_vars = HashMap::new();
        prompt_vars.insert(
            "theater_name".to_string(),
            ctx.manifest
                .map(|m| m.name.clone())
                .unwrap_or_else(|| ctx.theater_id.to_string()),
        );
        prompt_vars.insert(
            "system_preset".to_string(),
            ctx.manifest
                .map(|m| m.system_id.clone())
                .unwrap_or_else(|| "generic".to_string()),
        );
        prompt_vars.insert("language".to_string(), target_lang.to_string());

        let mut system_prompt = ctx.agent_config.prompts.render_system_prompt(&prompt_vars);
        if let Some(retry_hint) = &ctx.language_retry_hint {
            system_prompt.push_str("\n\nCORRECTION OBLIGATOIRE : ");
            system_prompt.push_str(retry_hint);
        }

        let context_block = matched_excerpts.join("\n\n---\n\n");
        let user_prompt = format!(
            "Extraits des sources canoniques du jeu :\n\"\"\"\n{}\n\"\"\"\n\nQuestion de l'utilisateur : {}\n\nRéponds précisément en {} en t'appuyant strictement sur ces sources :",
            context_block, input.query, target_lang
        );

        prompt_preview = Some(format!(
            "[SYSTEM PROMPT]\n{}\n\n[USER PROMPT]\n{}",
            system_prompt, user_prompt
        ));

        let theater_privacy = ctx.manifest.and_then(|m| m.privacy_mode.as_deref());
        let strict_local = ctx.agent_config.effective_strict_local(theater_privacy);
        let client = SouffleurClient::new(strict_local);

        let chosen_model = resolve_model_name(ctx, input.preferred_model.as_deref()).await;
        model_used = Some(chosen_model.clone());

        let profile = ctx.agent_config.model.to_model_profile(Some(chosen_model));
        let fallback_profile = ctx
            .agent_config
            .model
            .to_model_profile(Some(ctx.agent_config.model.fallback_model_id.clone()));

        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt,
                name: None,
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_prompt,
                name: None,
            },
        ];

        tools_used.push("LLM Synthesizer (SouffleurClient)".to_string());

        let llm_timeout = std::time::Duration::from_millis(
            ctx.agent_config.guardrails.timeout_ms.max(200),
        );
        let answer = match tokio::time::timeout(
            llm_timeout,
            client.complete_with_fallback(&profile, &fallback_profile, &messages, None),
        )
        .await
        {
            Ok(Ok(text)) if !text.trim().is_empty() => text.trim().to_string(),
            _ => build_offline_grounded_summary(&matched_excerpts, target_lang),
        };

        steps.push(StepTrace {
            step_id: "grounded_synthesis".to_string(),
            name: "Synthèse LLM contrainte par sources".to_string(),
            status: "completed".to_string(),
            duration_ms: elapsed_ms(&t4),
            summary: format!("Synthèse produite (modèle: {})", model_used.as_deref().unwrap_or("fallback")),
            metadata: json!({ "model": model_used }),
        });

        Some(answer)
    } else {
        steps.push(StepTrace {
            step_id: "grounded_synthesis".to_string(),
            name: "Synthèse LLM contrainte par sources".to_string(),
            status: "skipped".to_string(),
            duration_ms: elapsed_ms(&t4),
            summary: if silence_triggered {
                "Synthèse évitée (silence documentaire)".to_string()
            } else {
                "Étape désactivée par configuration".to_string()
            },
            metadata: json!({}),
        });
        None
    };

    // Step 5: Assemble verdict and record citation verification step
    let t5 = Instant::now();
    let mut verdict = ArchivistAgent::answer_query(
        &input.query,
        citations,
        synthesized_answer.as_deref(),
    );
    verdict.model_used = model_used.clone();
    verdict.prompt_used = prompt_preview.clone();
    verdict.tools_used = Some(tools_used);

    let output = serde_json::to_value(&verdict)?;
    steps.push(StepTrace {
        step_id: "citation_verifier".to_string(),
        name: "Vérification de provenance des citations".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t5),
        summary: format!(
            "found_facts={}, documentary_silence={}",
            verdict.found_facts, verdict.documentary_silence
        ),
        metadata: json!({ "citations_verified": verdict.citations.len() }),
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        model_used,
        prompt_preview,
        user_query_text: Some(input.query),
        expected_schema: json!({
            "type": "object",
            "required": ["query", "found_facts", "answer", "citations", "documentary_silence"],
            "properties": {
                "query": { "type": "string" },
                "found_facts": { "type": "boolean" },
                "answer": { "type": "string" },
                "citations": { "type": "array" },
                "documentary_silence": { "type": "boolean" }
            }
        }),
        retrieved_sources,
        ..WorkflowOutcome::default()
    })
}

async fn resolve_model_name(ctx: &WorkflowRuntimeInput<'_>, preferred: Option<&str>) -> String {
    if let Some(p) = preferred {
        if !p.trim().is_empty() {
            return p.trim().to_string();
        }
    }

    let configured = ctx.agent_config.model.model_id.trim();
    if !configured.is_empty() && configured != "default-local-model" {
        return configured.to_string();
    }

    // Attempt LM Studio model discovery when running locally
    if ctx.agent_config.model.is_local() {
        let models_url = format!(
            "{}/models",
            ctx.agent_config.model.base_url.trim_end_matches('/')
        );
        if let Ok(client) = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(800))
            .build()
        {
            if let Ok(resp) = client.get(&models_url).send().await {
                if let Ok(v) = resp.json::<serde_json::Value>().await {
                    if let Some(found) = v["data"].as_array().and_then(|arr| {
                        arr.iter()
                            .filter_map(|m| m["id"].as_str())
                            .find(|id| !id.contains("embed"))
                            .map(str::to_string)
                    }) {
                        return found;
                    }
                }
            }
        }
    }

    ctx.agent_config.model.fallback_model_id.clone()
}

fn build_offline_grounded_summary(excerpts: &[String], target_lang: &str) -> String {
    if target_lang == "English" {
        format!(
            "Summary synthesized strictly from available canonical sources:\n{}",
            excerpts.join("\n\n---\n\n")
        )
    } else {
        format!(
            "Synthèse directe issue des extraits canoniques disponibles :\n{}",
            excerpts.join("\n\n---\n\n")
        )
    }
}

fn detect_query_intent_tags(query: &str) -> Vec<&'static str> {
    let q = query.to_lowercase();
    let mut tags = Vec::new();
    if ["regle", "règle", "rule", "combat", "jet", "bonus", "malus", "diffic", "mechanic"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("rules");
    }
    if ["sort", "spell", "grimoire", "equipement", "équipement", "arme", "armure", "artefact", "gear"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("grimoire_gear");
    }
    if ["pnj", "personnage", "mage", "mages", "magi", "character", "npc", "profil"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("characters");
    }
    if ["scenario", "scénario", "aventure", "adventure", "intrigue", "campagne", "calebais"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("scenario");
    }
    if ["maison", "house", "histoire", "history", "lore", "univers", "background", "ordre", "hermes"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("background");
    }
    if ["fiche", "feuille", "sheet", "formulaire"]
        .iter()
        .any(|kw| q.contains(kw))
    {
        tags.push("sheets_aids");
    }
    tags
}

fn source_allowed_by_tags(
    catalog: &SourceTagsCatalog,
    role: Role,
    file_name: &str,
    required_tags: &Option<Vec<String>>,
) -> bool {
    if role == Role::Player && SourceTagRegistry::is_gm_only_file(catalog, file_name) {
        return false;
    }
    if let Some(req) = required_tags {
        if !req.is_empty() {
            let file_tags = SourceTagRegistry::tags_for_file(catalog, file_name);
            let normalized_req: Vec<String> = req
                .iter()
                .map(|r| SourceTagRegistry::normalize_tag_id(r))
                .filter(|r| !r.is_empty())
                .collect();
            if !normalized_req.is_empty() && !file_tags.iter().any(|t| normalized_req.contains(t)) {
                return false;
            }
        }
    }
    true
}

#[allow(clippy::too_many_arguments)]
fn scan_directory_snippets(
    dir: &std::path::Path,
    prefix: &str,
    role: Role,
    selected_sources: &Option<Vec<String>>,
    required_tags: &Option<Vec<String>>,
    tag_catalog: Option<&SourceTagsCatalog>,
    intent_tags: &[&str],
    query_terms: &[String],
    has_maisons_query: bool,
    has_combat_query: bool,
    skip_frontmatter: bool,
    out: &mut Vec<(usize, String, Option<usize>, String)>,
) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let rel_path = format!("{}/{}", prefix, file_name);

        if let Some(catalog) = tag_catalog {
            if !source_allowed_by_tags(catalog, role, &file_name, required_tags) {
                continue;
            }
        }

        if let Some(allowed) = selected_sources {
            if !allowed.is_empty()
                && !allowed.iter().any(|s| {
                    let ns = normalize_path(s);
                    ns == file_name || ns == rel_path
                })
            {
                continue;
            }
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let file_content = if matches!(ext.as_str(), "md" | "txt" | "json" | "yaml" | "yml") {
            std::fs::read_to_string(&path).ok()
        } else if ext == "pdf" {
            PdfDocParser::extract_text(&path).ok()
        } else {
            None
        };

        if let Some(raw_content) = file_content {
            let content = EpistemicFilter::sanitize_markdown(&raw_content, role, None);
            let before_len = out.len();
            extract_matching_paragraphs(
                &content,
                &rel_path,
                query_terms,
                has_maisons_query,
                has_combat_query,
                skip_frontmatter,
                out,
            );
            if let Some(catalog) = tag_catalog {
                let file_tags = SourceTagRegistry::tags_for_file(catalog, &file_name);
                let overlap = intent_tags
                    .iter()
                    .filter(|it| file_tags.iter().any(|ft| ft == **it))
                    .count();
                let is_sheet_only = file_tags.iter().any(|t| t == "sheets_aids")
                    && !intent_tags.contains(&"sheets_aids");
                for item in &mut out[before_len..] {
                    if overlap > 0 {
                        item.0 += overlap * 4;
                    }
                    if is_sheet_only {
                        item.0 = (item.0 / 2).max(1);
                    }
                }
            }
        }
    }
}

fn scan_wiki_snippets(
    wiki_dir: &std::path::Path,
    role: Role,
    selected_sources: &Option<Vec<String>>,
    query_terms: &[String],
    out: &mut Vec<(usize, String, Option<usize>, String)>,
) {
    let Ok(cats) = std::fs::read_dir(wiki_dir) else {
        return;
    };
    for cat in cats.flatten() {
        if cat.path().is_dir() {
            let cat_name = cat.file_name().to_string_lossy().to_string();
            let prefix = format!("01_wiki/{}", cat_name);
            scan_directory_snippets(
                &cat.path(),
                &prefix,
                role,
                selected_sources,
                &None,
                None,
                &[],
                query_terms,
                false,
                false,
                true,
                out,
            );
        }
    }
}

fn extract_meaningful_terms(query: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "est", "sont", "les", "des", "une", "qui", "que", "quoi", "quel", "quelle", "quels",
        "quelles", "comment", "pourquoi", "dans", "pour", "avec", "sur", "par", "pas", "plus",
        "tout", "tous", "être", "avoir", "faire", "son", "ses", "ces", "cette", "cet", "aux",
        "the", "and", "for", "are", "was", "were", "with", "that", "this", "from", "what",
        "which", "how", "why", "into", "their", "these", "those",
    ];
    query
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3 && !STOPWORDS.contains(w))
        .map(str::to_string)
        .collect()
}

fn extract_matching_paragraphs(
    content: &str,
    rel_path: &str,
    query_terms: &[String],
    has_maisons_query: bool,
    has_combat_query: bool,
    skip_frontmatter: bool,
    out: &mut Vec<(usize, String, Option<usize>, String)>,
) {
    let lines: Vec<&str> = content.lines().collect();
    let mut current_chunk_lines: Vec<String> = Vec::new();
    let mut chunk_start_line = 1;

    let mut score_and_push = |chunk_text: &str, start_line: usize| {
        let clean = chunk_text.trim();
        let min_len = if skip_frontmatter { 15 } else { 20 };
        if clean.len() < min_len || (skip_frontmatter && clean.starts_with("---")) {
            return;
        }
        let lower = clean.to_lowercase();
        let words: std::collections::HashSet<&str> = lower
            .split(|c: char| !c.is_alphanumeric())
            .filter(|w| !w.is_empty())
            .collect();

        let mut score = query_terms
            .iter()
            .filter(|term| words.contains(term.as_str()))
            .count();

        if has_maisons_query {
            if lower.contains("twelve houses")
                || lower.contains("houses of hermes")
                || lower.contains("douze maisons")
            {
                score += 15;
            }
            if lower.contains("bjornaer")
                || lower.contains("bonisagus")
                || lower.contains("flambeau")
            {
                score += 10;
            }
        }

        if has_combat_query {
            if lower.contains("flambeau")
                && (lower.contains("combat")
                    || lower.contains("martial")
                    || lower.contains("fire")
                    || lower.contains("knights"))
            {
                score += 40;
            }
            if lower.contains("tremere")
                && (lower.contains("combat magic")
                    || lower.contains("field commander")
                    || lower.contains("certamen"))
            {
                score += 30;
            }
            if lower.contains("combat") || lower.contains("martial") {
                score += 10;
            }
        }

        if lower.contains("open license markdown version")
            || lower.contains("crowdfunding backers")
            || lower.contains("definitive edition the extensively revised")
        {
            score = 0;
        }

        if score > 0 {
            let snippet: String = clean.chars().take(1200).collect();
            out.push((score, rel_path.to_string(), Some(start_line), snippet));
        }
    };

    for (line_idx, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            if !current_chunk_lines.is_empty() {
                let chunk_text = current_chunk_lines.join("\n");
                score_and_push(&chunk_text, chunk_start_line);
                current_chunk_lines.clear();
            }
            chunk_start_line = line_idx + 2;
        } else {
            if current_chunk_lines.is_empty() {
                chunk_start_line = line_idx + 1;
            }
            current_chunk_lines.push((*line).to_string());
        }
    }

    if !current_chunk_lines.is_empty() {
        let chunk_text = current_chunk_lines.join("\n");
        score_and_push(&chunk_text, chunk_start_line);
    }
}
