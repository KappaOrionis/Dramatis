use std::time::Instant;

use serde_json::json;
use sha2::{Digest, Sha256};

use dramatis_core::SourceTagRegistry;
use dramatis_ingest::{
    ExcelTableIngester, FormulaTranspiler, HierarchicalChunker, MarkdownDocParser, PdfDocParser,
    SourceHasher,
};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::workflows::{WorkflowOutcome, WorkflowRuntimeInput};

fn detect_format(file_name: &str, explicit_type: Option<&str>) -> &'static str {
    if let Some(t) = explicit_type {
        match t.trim().to_ascii_lowercase().as_str() {
            "md" | "markdown" | "txt" | "text" => return "markdown",
            "pdf" => return "pdf",
            "xlsx" | "xls" | "excel" => return "excel",
            "png" | "jpg" | "jpeg" | "webp" | "image" => return "image",
            "ogg" | "mp3" | "wav" | "flac" | "audio" => return "audio",
            _ => {}
        }
    }

    let lower = file_name.trim().to_ascii_lowercase();
    if lower.ends_with(".pdf") {
        "pdf"
    } else if lower.ends_with(".xlsx") || lower.ends_with(".xls") {
        "excel"
    } else if lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".webp")
    {
        "image"
    } else if lower.ends_with(".ogg")
        || lower.ends_with(".mp3")
        || lower.ends_with(".wav")
        || lower.ends_with(".flac")
    {
        "audio"
    } else {
        "markdown"
    }
}

pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let file_name = ctx
        .input_payload
        .get("file_name")
        .and_then(|v| v.as_str())
        .unwrap_or("source_document.md")
        .to_string();

    let explicit_type = ctx.input_payload.get("file_type").and_then(|v| v.as_str());
    let content_text = ctx
        .input_payload
        .get("content_text")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let source_path_rel = ctx
        .input_payload
        .get("source_path")
        .and_then(|v| v.as_str());

    let explicit_tags: Option<Vec<String>> = ctx
        .input_payload
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(SourceTagRegistry::normalize_tag_id)
                .filter(|t| !t.is_empty())
                .collect::<Vec<_>>()
        })
        .filter(|v| !v.is_empty());

    let mut steps = Vec::new();

    // Step 1: Format detection & semantic tag inference
    let t1 = Instant::now();
    let detected_format = detect_format(&file_name, explicit_type);
    let resolved_tags = explicit_tags.unwrap_or_else(|| {
        SourceTagRegistry::infer_tags_for_source(&file_name, Some(content_text))
    });
    steps.push(StepTrace {
        step_id: "format_detection".to_string(),
        name: "Détection du format & routage".to_string(),
        status: "completed".to_string(),
        duration_ms: t1.elapsed().as_millis() as u64,
        summary: format!(
            "Fichier `{}` routé vers `{}` | tags={:?}",
            file_name, detected_format, resolved_tags
        ),
        metadata: json!({
            "file_name": file_name,
            "detected_format": detected_format,
            "tags": resolved_tags
        }),
    });

    // Step 2: SHA-256 deduplication check
    let t2 = Instant::now();
    let resolved_disk_path = source_path_rel
        .map(|rel| ctx.theater_root.join(rel))
        .unwrap_or_else(|| ctx.theater_root.join("00_sources").join(&file_name));

    let sha256 = if resolved_disk_path.exists() {
        SourceHasher::compute_sha256(&resolved_disk_path)
            .unwrap_or_else(|_| "sha256_read_error".to_string())
    } else {
        let mut hasher = Sha256::new();
        hasher.update(file_name.as_bytes());
        hasher.update(content_text.as_bytes());
        format!("{:x}", hasher.finalize())
    };

    steps.push(StepTrace {
        step_id: "sha256_dedup".to_string(),
        name: "Contrôle d'empreinte SHA-256".to_string(),
        status: "completed".to_string(),
        duration_ms: t2.elapsed().as_millis() as u64,
        summary: format!("Empreinte calculée : {}...", &sha256[..12.min(sha256.len())]),
        metadata: json!({ "sha256": sha256 }),
    });

    // Step 3: Typed extraction
    let t3 = Instant::now();
    let max_chunk_chars = ctx
        .agent_config
        .workflow_params
        .get("max_chunk_chars")
        .and_then(|v| v.as_u64())
        .unwrap_or(1200) as usize;

    let mut sections_count: usize = 0;
    let mut chunks_count: usize = 0;
    let mut tables_count: usize = 0;
    let mut media_kind: Option<String> = None;

    match detected_format {
        "markdown" => {
            let text_to_parse = if !content_text.is_empty() {
                content_text.to_string()
            } else if resolved_disk_path.exists() {
                std::fs::read_to_string(&resolved_disk_path).unwrap_or_default()
            } else {
                String::new()
            };
            let sections = MarkdownDocParser::parse(&text_to_parse);
            sections_count = sections.len();
            let chunker = HierarchicalChunker::new(max_chunk_chars);
            for sec in &sections {
                tables_count += sec.tables.len();
                let parent = chunker.split_section(&sec.content, &file_name, &sec.title, "public", &[]);
                chunks_count += parent.child_chunks.len().max(1);
            }
            if chunks_count == 0 && !text_to_parse.trim().is_empty() {
                chunks_count = 1;
            }
        }
        "pdf" => {
            let extracted = if resolved_disk_path.exists() {
                PdfDocParser::extract_text(&resolved_disk_path).unwrap_or_default()
            } else {
                content_text.to_string()
            };
            let sections = MarkdownDocParser::parse(&extracted);
            sections_count = sections.len().max(if extracted.trim().is_empty() { 0 } else { 1 });
            let chunker = HierarchicalChunker::new(max_chunk_chars);
            for sec in &sections {
                let parent = chunker.split_section(&sec.content, &file_name, &sec.title, "public", &[]);
                chunks_count += parent.child_chunks.len().max(1);
            }
            if chunks_count == 0 && !extracted.trim().is_empty() {
                chunks_count = 1;
            }
        }
        "excel" => {
            if resolved_disk_path.exists() && !ctx.dry_run {
                let db_path = ctx.theater_root.join("04_index/tables.sqlite");
                let rhai_dir = ctx.theater_root.join("04_index/rhai_formulas");
                if let Ok(mut conn) = rusqlite::Connection::open(&db_path) {
                    if let Ok(report) = ExcelTableIngester::ingest_workbook_full(
                        &resolved_disk_path,
                        &mut conn,
                        None,
                        Some(&rhai_dir),
                    ) {
                        tables_count = report.created_tables.len();
                        chunks_count = tables_count.max(1);
                    }
                }
            } else {
                // Dry-run validation of Excel -> Rhai transpilation pipeline
                let _rhai = FormulaTranspiler::transpile_formula_to_rhai(
                    "eval_table_lookup",
                    &["rank"],
                    "rank * 2 + 5",
                );
                tables_count = 1;
                chunks_count = 1;
            }
        }
        "image" | "audio" => {
            media_kind = Some(detected_format.to_string());
            chunks_count = 1;
        }
        _ => {}
    }

    steps.push(StepTrace {
        step_id: "typed_extraction".to_string(),
        name: "Extraction & découpage spécialisé".to_string(),
        status: "completed".to_string(),
        duration_ms: t3.elapsed().as_millis() as u64,
        summary: format!(
            "{} section(s), {} chunk(s), {} table(s) extraite(s)",
            sections_count, chunks_count, tables_count
        ),
        metadata: json!({
            "sections_count": sections_count,
            "chunks_count": chunks_count,
            "tables_count": tables_count,
            "media_kind": media_kind,
        }),
    });

    // Step 4: Index registration (skipped in dry-run)
    let t4 = Instant::now();
    let sync_status = if ctx.dry_run {
        "simulated_dry_run"
    } else {
        if detected_format == "markdown" && !content_text.is_empty() {
            let target = ctx.theater_root.join("00_sources").join(&file_name);
            if let Some(parent) = target.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&target, content_text);
        }
        let _ = SourceTagRegistry::set_file_tags(&ctx.theater_root, &file_name, resolved_tags.clone());
        if detected_format == "markdown" && !content_text.is_empty() {
            "ingested"
        } else {
            "indexed"
        }
    };

    steps.push(StepTrace {
        step_id: "index_registration".to_string(),
        name: "Enregistrement dans l'index du Théâtre".to_string(),
        status: if ctx.dry_run { "skipped" } else { "completed" }.to_string(),
        duration_ms: t4.elapsed().as_millis() as u64,
        summary: format!("Statut d'indexation : {}", sync_status),
        metadata: json!({ "sync_status": sync_status }),
    });

    let output = json!({
        "file_name": file_name,
        "detected_format": detected_format,
        "tags": resolved_tags,
        "sha256": sha256,
        "sync_status": sync_status,
        "sections_count": sections_count,
        "chunks_count": chunks_count,
        "tables_count": tables_count,
        "media_kind": media_kind,
        "dry_run": ctx.dry_run,
    });

    let expected_schema = json!({
        "type": "object",
        "required": ["file_name", "detected_format", "sha256", "chunks_count"]
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        expected_schema,
        model_used: None,
        prompt_preview: None,
        user_query_text: None,
        retrieved_sources: vec![],
        forbidden_secrets: vec![],
        actor_view: None,
        original_markdown: None,
        proposed_markdown: None,
        machina_deterministic_source: true,
        campaign_manifest: None,
        mechanical_resolution: None,
        creation_validation: None,
        mutation_proposal: None,
    })
}
