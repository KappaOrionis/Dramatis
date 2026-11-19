use std::collections::{HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use dramatis_core::{CreationValidationResult, Role};
use dramatis_stage::{AgentContextView, CampaignManifest, MechanicalResolution};

use crate::config::{
    AgentConfig, HitlMode, LanguagePolicy, ValidationProfile, WorkflowConfig,
};
use crate::trace::{GateId, GateResult, GateStatus, ValidationReport};

/// Proposed filesystem/database mutation produced by a mutating workflow (`WF-02`, `WF-04`, `WF-05`, `WF-06`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutationProposal {
    pub action_kind: String,
    pub target_path: String,
    pub summary: String,
    pub diff_preview: String,
    pub payload: serde_json::Value,
}

/// Complete domain context supplied to `ValidationPipeline::run`.
pub struct ValidationContext<'a> {
    pub workflow_id: &'a str,
    pub agent_config: &'a AgentConfig,
    pub workflow_config: &'a WorkflowConfig,
    pub role: Role,
    pub dry_run: bool,
    pub user_query_text: Option<String>,
    pub expected_schema: serde_json::Value,
    pub retrieved_sources: Vec<(String, String)>,
    pub forbidden_secrets: Vec<String>,
    pub actor_view: Option<AgentContextView>,
    pub original_markdown: Option<String>,
    pub proposed_markdown: Option<String>,
    pub machina_deterministic_source: bool,
    pub campaign_manifest: Option<CampaignManifest>,
    pub mechanical_resolution: Option<MechanicalResolution>,
    pub creation_validation: Option<CreationValidationResult>,
    pub mutation_proposal: Option<MutationProposal>,
}

/// Executes the 4 sequential harness validation gates (`G1` to `G4`).
pub struct ValidationPipeline;

impl ValidationPipeline {
    /// Runs Gates G1-G4 over `output` and returns a structured `ValidationReport`.
    pub fn run(output: &serde_json::Value, ctx: &ValidationContext<'_>) -> ValidationReport {
        let g1 = Self::validate_g1_contract(output, ctx);
        let g2 = Self::validate_g2_epistemic(output, ctx);
        let g3 = Self::validate_g3_machina(output, ctx);
        let g4 = Self::validate_g4_hitl(ctx);

        let hard_failed = [&g1, &g2, &g3]
            .iter()
            .any(|g| g.status == GateStatus::Failed);
        let requires_hitl_approval = g4.status == GateStatus::PendingApproval;

        ValidationReport {
            overall_passed: !hard_failed,
            requires_hitl_approval,
            gates: vec![g1, g2, g3, g4],
        }
    }

    /// Gate G1: Validates output JSON schema (`required`, `properties`, `enum`) and language policy.
    fn validate_g1_contract(
        output: &serde_json::Value,
        ctx: &ValidationContext<'_>,
    ) -> GateResult {
        let mut errors = Vec::new();
        Self::check_schema_object(output, &ctx.expected_schema, "$", &mut errors);

        // Language check on primary prose field
        if let Some(text) = Self::extract_primary_text(output) {
            if text.split_whitespace().count() >= 5 {
                let detected_out = Self::detect_language(&text);
                match ctx.agent_config.prompts.language_policy {
                    LanguagePolicy::ForceFr => {
                        if detected_out == "en" {
                            errors.push(
                                "Politique linguistique force_fr violée : réponse détectée en anglais."
                                    .to_string(),
                            );
                        }
                    }
                    LanguagePolicy::ForceEn => {
                        if detected_out == "fr" {
                            errors.push(
                                "Language policy force_en violated: French response detected."
                                    .to_string(),
                            );
                        }
                    }
                    LanguagePolicy::MatchUserQuery => {
                        if let Some(query) = &ctx.user_query_text {
                            let query_lang = Self::detect_language(query);
                            if query_lang != "unknown"
                                && detected_out != "unknown"
                                && query_lang != detected_out
                            {
                                errors.push(format!(
                                    "Divergence de langue : requête='{}', réponse='{}'.",
                                    query_lang, detected_out
                                ));
                            }
                        }
                    }
                }
            }
        }

        if errors.is_empty() {
            GateResult {
                gate: GateId::G1Contract,
                status: GateStatus::Passed,
                message: "Contrat JSON Schema et politique linguistique conformes.".to_string(),
                details: Vec::new(),
            }
        } else {
            let status = if ctx.agent_config.guardrails.validation_profile
                == ValidationProfile::Permissive
            {
                GateStatus::Warning
            } else {
                GateStatus::Failed
            };
            GateResult {
                gate: GateId::G1Contract,
                status,
                message: errors.join(" | "),
                details: errors,
            }
        }
    }

    /// Gate G2: Enforces Epistemic boundaries, Fog of War anti-leak, and citation provenance.
    fn validate_g2_epistemic(
        output: &serde_json::Value,
        ctx: &ValidationContext<'_>,
    ) -> GateResult {
        let mut errors = Vec::new();
        let output_text = serde_json::to_string(output).unwrap_or_default();
        let lower_output = output_text.to_ascii_lowercase();

        // 1. Check secret marker leakage for non-GM roles or public narration/actor turns
        let strict_public_check = ctx.role != Role::Gm
            || matches!(ctx.workflow_id, "WF-06" | "WF-07");

        if strict_public_check {
            if lower_output.contains(":::secret") || lower_output.contains("gm_only") {
                errors.push(
                    "Fuite épistémique : marqueur `:::secret` ou `gm_only` détecté dans la sortie publique."
                        .to_string(),
                );
            }
            for secret in &ctx.forbidden_secrets {
                let needle = secret.trim().to_ascii_lowercase();
                if needle.len() >= 4 && lower_output.contains(&needle) {
                    errors.push(format!(
                        "Fuite de secret interdit détectée dans la sortie (`{}`).",
                        secret.trim()
                    ));
                }
            }
        }

        // 2. Check WF-01 citation provenance against retrieved chunks
        if ctx.workflow_id == "WF-01" {
            if let Some(cits) = output.get("citations").and_then(|v| v.as_array()) {
                let allowed_paths: HashSet<String> = ctx
                    .retrieved_sources
                    .iter()
                    .map(|(p, _)| normalize_path(p))
                    .collect();

                for cit in cits {
                    if let Some(src) = cit.get("source_file").and_then(|v| v.as_str()) {
                        let norm = normalize_path(src);
                        let matched = allowed_paths
                            .iter()
                            .any(|allowed| allowed == &norm || allowed.ends_with(&norm) || norm.ends_with(allowed));
                        if !matched {
                            errors.push(format!(
                                "Citation non attestée : source `{}` absente des extraits récupérés.",
                                src
                            ));
                        }
                    } else {
                        errors.push("Citation invalide sans champ `source_file`.".to_string());
                    }
                }
            }
        }

        // 3. Verify WF-07 AgentContextView perception sanity
        if ctx.workflow_id == "WF-07" {
            if let Some(view) = &ctx.actor_view {
                if !view.is_gm {
                    if let Some(perceived_zones) =
                        output.get("perceived_zones").and_then(|v| v.as_array())
                    {
                        for z in perceived_zones {
                            if let Some(z_str) = z.as_str() {
                                if z_str != view.current_zone.0
                                    && !view.visible_zones.iter().any(|vz| vz.0 == z_str)
                                {
                                    errors.push(format!(
                                        "Violation spatiale Fog of War : l'acteur a accédé à la zone `{}`.",
                                        z_str
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }

        if errors.is_empty() {
            GateResult {
                gate: GateId::G2Epistemic,
                status: GateStatus::Passed,
                message: "Intégrité épistémique, provenance et brouillard de guerre validés.".to_string(),
                details: Vec::new(),
            }
        } else {
            GateResult {
                gate: GateId::G2Epistemic,
                status: GateStatus::Failed,
                message: errors.join(" | "),
                details: errors,
            }
        }
    }

    /// Gate G3: Enforces Narration vs Machina invariants, `LOCKED_BY_USER` SHA-256 integrity,
    /// decimal bounds, and topological graph reachability.
    fn validate_g3_machina(
        output: &serde_json::Value,
        ctx: &ValidationContext<'_>,
    ) -> GateResult {
        let mut errors = Vec::new();
        let mut details = Vec::new();

        // 1. LOCKED_BY_USER SHA-256 preservation check (critical for WF-02 Scribe)
        if let (Some(orig), Some(prop)) = (&ctx.original_markdown, &ctx.proposed_markdown) {
            let orig_locks = extract_locked_section_hashes(orig);
            let prop_locks = extract_locked_section_hashes(prop);
            for (title, orig_hash) in &orig_locks {
                match prop_locks.iter().find(|(t, _)| t == title) {
                    Some((_, prop_hash)) if prop_hash == orig_hash => {
                        details.push(format!(
                            "Section verrouillée `{}` préservée (SHA-256 {}).",
                            title,
                            &orig_hash[..12]
                        ));
                    }
                    _ => {
                        errors.push(format!(
                            "Invariant <!-- LOCKED_BY_USER --> violé sur la section `{}`.",
                            title
                        ));
                    }
                }
            }
        }

        // 2. WF-03 Arbiter strict Machina determinism check
        if ctx.workflow_id == "WF-03" && !ctx.machina_deterministic_source {
            errors.push(
                "Séparation Récit/Loi violée : le verdict de WF-03 ne provient pas de dramatis-machina."
                    .to_string(),
            );
        }

        // 3. WF-04 Steward bounds check (Essence, HealthMonitor, CreationValidation)
        if ctx.workflow_id == "WF-04" {
            let essence_opt = output
                .get("persona")
                .and_then(|p| p.get("essence"))
                .and_then(|v| v.as_f64())
                .or_else(|| output.get("calculated_essence").and_then(|v| v.as_f64()));

            if let Some(ess) = essence_opt {
                if !(0.0..=6.0).contains(&ess) {
                    errors.push(format!(
                        "Essence hors bornes ({:.2}) : doit rester entre 0.00 et 6.00.",
                        ess
                    ));
                }
            }

            if let Some(monitors) = output
                .get("persona")
                .and_then(|p| p.get("health_monitors"))
                .and_then(|m| m.as_array())
            {
                for mon in monitors {
                    let cur = mon.get("current_damage").and_then(|v| v.as_u64()).unwrap_or(0);
                    let max_b = mon.get("max_boxes").and_then(|v| v.as_u64()).unwrap_or(0);
                    let name = mon.get("name").and_then(|v| v.as_str()).unwrap_or("Monitor");
                    if cur > max_b {
                        errors.push(format!(
                            "Moniteur de santé `{}` incohérent : dégâts {} > max {}.",
                            name, cur, max_b
                        ));
                    }
                }
            }

            if let Some(creation) = &ctx.creation_validation {
                let allow_house_rules = ctx
                    .agent_config
                    .workflow_params
                    .get("allow_house_rules")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if !creation.is_valid && !allow_house_rules {
                    errors.push(format!(
                        "Audit de création échoué : {}",
                        creation.errors.join("; ")
                    ));
                }
            }
        }

        // 4. WF-05 Playwright topological graph & clocks check
        if ctx.workflow_id == "WF-05" {
            if let Some(manifest) = &ctx.campaign_manifest {
                if !manifest.scenes.contains_key(&manifest.active_scene_id) {
                    errors.push(format!(
                        "Scène active `{}` introuvable dans le graphe de scènes.",
                        manifest.active_scene_id
                    ));
                } else {
                    // Verify transition links and BFS reachability
                    let mut visited = HashSet::new();
                    let mut queue = VecDeque::new();
                    visited.insert(manifest.active_scene_id.clone());
                    queue.push_back(manifest.active_scene_id.clone());

                    while let Some(curr) = queue.pop_front() {
                        if let Some(node) = manifest.scenes.get(&curr) {
                            for next in &node.next_scene_options {
                                if !manifest.scenes.contains_key(next) {
                                    errors.push(format!(
                                        "Lien narratif cassé depuis `{}` vers `{}` inexistant.",
                                        curr, next
                                    ));
                                } else if visited.insert(next.clone()) {
                                    queue.push_back(next.clone());
                                }
                            }
                        }
                    }

                    for scene_id in manifest.scenes.keys() {
                        if !visited.contains(scene_id) {
                            errors.push(format!(
                                "Nœud narratif orphelin (inatteignable depuis `{}`) : `{}`.",
                                manifest.active_scene_id, scene_id
                            ));
                        }
                    }
                }

                for clock in &manifest.clocks {
                    if clock.total_segments == 0 || clock.current_segments > clock.total_segments {
                        errors.push(format!(
                            "Horloge `{}` invalide ({}/{}).",
                            clock.id, clock.current_segments, clock.total_segments
                        ));
                    }
                }
            }
        }

        // 5. WF-06 Director fidelity to MechanicalResolution
        if ctx.workflow_id == "WF-06" {
            if let Some(mech) = &ctx.mechanical_resolution {
                if let Some(narrated_success) =
                    output.get("verdict_success").and_then(|v| v.as_bool())
                {
                    if narrated_success != mech.success {
                        errors.push(format!(
                            "Contradiction mécanique : verdict Légiste success={}, narration success={}.",
                            mech.success, narrated_success
                        ));
                    }
                }
            }
        }

        if errors.is_empty() {
            GateResult {
                gate: GateId::G3Machina,
                status: GateStatus::Passed,
                message: if details.is_empty() {
                    "Invariants mécaniques et structurels respectés.".to_string()
                } else {
                    details.join(" | ")
                },
                details,
            }
        } else {
            GateResult {
                gate: GateId::G3Machina,
                status: GateStatus::Failed,
                message: errors.join(" | "),
                details: errors,
            }
        }
    }

    /// Gate G4: Determines whether a proposed mutation executes immediately or queues for GM HITL approval.
    fn validate_g4_hitl(ctx: &ValidationContext<'_>) -> GateResult {
        if ctx.mutation_proposal.is_none() {
            return GateResult {
                gate: GateId::G4Hitl,
                status: GateStatus::Skipped,
                message: "Workflow en lecture seule (aucune écriture disque proposée).".to_string(),
                details: Vec::new(),
            };
        }

        if ctx.dry_run {
            return GateResult {
                gate: GateId::G4Hitl,
                status: GateStatus::Skipped,
                message: "Mode Dry-Run : mutation simulée uniquement, aucune écriture disque."
                    .to_string(),
                details: Vec::new(),
            };
        }

        let effective_mode = ctx
            .workflow_config
            .hitl_mode
            .unwrap_or(ctx.agent_config.guardrails.hitl_mode);

        match effective_mode {
            HitlMode::ApprovalRequired => GateResult {
                gate: GateId::G4Hitl,
                status: GateStatus::PendingApproval,
                message: "Validation MJ (Human-in-the-Loop) requise avant écriture disque."
                    .to_string(),
                details: Vec::new(),
            },
            HitlMode::Auto => GateResult {
                gate: GateId::G4Hitl,
                status: GateStatus::Passed,
                message: "Mode auto-application activé : mutation autorisée.".to_string(),
                details: Vec::new(),
            },
        }
    }

    fn extract_primary_text(output: &serde_json::Value) -> Option<String> {
        for key in ["answer", "narration", "dialogue", "summary"] {
            if let Some(s) = output.get(key).and_then(|v| v.as_str()) {
                if !s.trim().is_empty() {
                    return Some(s.to_string());
                }
            }
        }
        None
    }

    /// Lightweight heuristic detector distinguishing `"fr"`, `"en"`, or `"unknown"`.
    pub fn detect_language(text: &str) -> &'static str {
        let lower = text.to_ascii_lowercase();
        let has_fr_diacritics = text
            .chars()
            .any(|c| matches!(c, 'é' | 'è' | 'ê' | 'à' | 'ç' | 'ù' | 'ô' | 'î' | 'ï' | 'û'));

        let words: Vec<&str> = lower
            .split(|c: char| !c.is_alphabetic())
            .filter(|w| !w.is_empty())
            .collect();

        if words.is_empty() {
            return "unknown";
        }

        let fr_markers = [
            "le", "la", "les", "des", "une", "un", "est", "sont", "dans", "pour", "avec", "par",
            "que", "qui", "sur", "pas", "plus", "quelles", "quels", "quelle", "quel", "maison",
            "maisons", "règles", "sources", "aucune", "vous", "nous", "du", "au", "aux", "ce",
            "cette", "ces", "et", "ou", "donc",
        ];
        let en_markers = [
            "the", "and", "that", "this", "with", "from", "are", "was", "were", "have", "has",
            "which", "what", "when", "where", "house", "houses", "rules", "between", "into",
            "they", "their", "these", "those", "for", "but", "not", "can", "will",
        ];

        let mut fr_score = if has_fr_diacritics { 2usize } else { 0 };
        let mut en_score = 0usize;

        for w in &words {
            if fr_markers.contains(w) {
                fr_score += 1;
            }
            if en_markers.contains(w) {
                en_score += 1;
            }
        }

        if fr_score == 0 && en_score == 0 {
            "unknown"
        } else if fr_score > en_score {
            "fr"
        } else if en_score > fr_score {
            "en"
        } else if has_fr_diacritics {
            "fr"
        } else {
            "unknown"
        }
    }

    fn check_schema_object(
        val: &serde_json::Value,
        schema: &serde_json::Value,
        path: &str,
        errors: &mut Vec<String>,
    ) {
        if schema.is_null() {
            return;
        }
        if let Some(expected_type) = schema.get("type").and_then(|v| v.as_str()) {
            let type_ok = match expected_type {
                "object" => val.is_object(),
                "array" => val.is_array(),
                "string" => val.is_string(),
                "boolean" => val.is_boolean(),
                "integer" => val.is_i64() || val.is_u64(),
                "number" => val.is_number(),
                _ => true,
            };
            if !type_ok {
                errors.push(format!(
                    "Type invalide à `{}` : attendu `{}`.",
                    path, expected_type
                ));
                return;
            }
        }

        if let Some(enum_arr) = schema.get("enum").and_then(|v| v.as_array()) {
            if !enum_arr.contains(val) {
                errors.push(format!("Valeur à `{}` hors enum autorisé.", path));
            }
        }

        if let Some(req) = schema.get("required").and_then(|v| v.as_array()) {
            for r in req {
                if let Some(key) = r.as_str() {
                    if val.get(key).is_none() {
                        errors.push(format!("Champ requis manquant : `{}.{}`.", path, key));
                    }
                }
            }
        }

        if let Some(props) = schema.get("properties").and_then(|v| v.as_object()) {
            for (k, sub_schema) in props {
                if let Some(sub_val) = val.get(k) {
                    let sub_path = format!("{}.{}", path, k);
                    Self::check_schema_object(sub_val, sub_schema, &sub_path, errors);
                }
            }
        }
    }
}

/// Extracts `(section_title, sha256_hex)` for every Markdown `##` section containing `<!-- LOCKED_BY_USER -->`.
pub fn extract_locked_section_hashes(markdown: &str) -> Vec<(String, String)> {
    let mut results = Vec::new();
    let normalized = markdown.replace("\r\n", "\n");

    let chunks: Vec<&str> = normalized.split("\n## ").collect();
    for (idx, chunk) in chunks.iter().enumerate() {
        let sec = if idx == 0 {
            if let Some(stripped) = chunk.strip_prefix("## ") {
                stripped
            } else {
                continue;
            }
        } else {
            chunk
        };

        let mut lines = sec.splitn(2, '\n');
        let title = lines.next().unwrap_or("").trim().to_string();
        let body = lines.next().unwrap_or("");
        if body.contains("<!-- LOCKED_BY_USER -->") || title.contains("<!-- LOCKED_BY_USER -->") {
            let mut hasher = Sha256::new();
            hasher.update(sec.trim().as_bytes());
            results.push((title, hex::encode(hasher.finalize())));
        }
    }

    results
}

/// Produces a readable line-by-line diff preview between original and proposed text.
pub fn build_unified_diff(original: &str, proposed: &str) -> String {
    let orig_lines: Vec<&str> = original.lines().collect();
    let prop_lines: Vec<&str> = proposed.lines().collect();
    let mut out = Vec::new();
    let max_len = orig_lines.len().max(prop_lines.len());

    for i in 0..max_len {
        match (orig_lines.get(i), prop_lines.get(i)) {
            (Some(a), Some(b)) if a == b => {
                out.push(format!("  {}", a));
            }
            (Some(a), Some(b)) => {
                out.push(format!("- {}", a));
                out.push(format!("+ {}", b));
            }
            (Some(a), None) => {
                out.push(format!("- {}", a));
            }
            (None, Some(b)) => {
                out.push(format!("+ {}", b));
            }
            (None, None) => {}
        }
    }

    if out.len() > 160 {
        out.truncate(160);
        out.push("... (diff tronqué à 160 lignes)".to_string());
    }
    out.join("\n")
}

/// Normalizes Windows/Unix path separators to `/` for reliable matching.
pub fn normalize_path(path: &str) -> String {
    path.replace('\\', "/").trim().to_string()
}
