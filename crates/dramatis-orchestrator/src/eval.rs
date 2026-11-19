use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use dramatis_core::Role;

use crate::config::ConfigRegistry;
use crate::engine::{OrchestratorEngine, WorkflowRequest};
use crate::error::OrchestratorError;
use crate::trace::{GateId, GateStatus};

/// Declarative assertions checked after running an `EvalCase`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct EvalAssertions {
    pub expect_overall_pass: Option<bool>,
    pub expect_gates_passed: Vec<GateId>,
    pub expect_documentary_silence: Option<bool>,
    pub output_contains: Vec<String>,
    pub output_not_contains: Vec<String>,
}

/// Single test scenario executed against one of the 7 workflows (`WF-01`..`WF-07`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalCase {
    pub id: String,
    pub name: String,
    pub workflow_id: String,
    #[serde(default = "default_eval_role")]
    pub role: Role,
    pub input: serde_json::Value,
    #[serde(default)]
    pub assertions: EvalAssertions,
}

fn default_eval_role() -> Role {
    Role::Gm
}

/// Named collection of evaluation cases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalSuite {
    pub suite_id: String,
    pub name: String,
    pub description: String,
    pub is_builtin: bool,
    pub cases: Vec<EvalCase>,
}

/// Lightweight metadata descriptor for listing available suites.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalSuiteSummary {
    pub suite_id: String,
    pub name: String,
    pub description: String,
    pub is_builtin: bool,
    pub cases_count: usize,
}

/// Execution outcome for one `EvalCase`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalCaseResult {
    pub case_id: String,
    pub name: String,
    pub workflow_id: String,
    pub passed: bool,
    pub trace_id: String,
    pub duration_ms: u64,
    pub failures: Vec<String>,
    pub gate_statuses: Vec<(GateId, GateStatus)>,
}

/// Aggregated report returned by `EvalRunner::run_suite`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalRunReport {
    pub suite_id: String,
    pub suite_name: String,
    pub executed_at: String,
    pub total_cases: usize,
    pub passed_cases: usize,
    pub failed_cases: usize,
    pub results: Vec<EvalCaseResult>,
}

/// Runs automated Dry-Run validation suites across all configured workflows of a Theater.
pub struct EvalRunner;

impl EvalRunner {
    /// Lists the built-in canonical suite plus any custom `00_config/evals/*.yaml` files.
    pub fn list_suites(theater_root: &Path) -> Vec<EvalSuiteSummary> {
        let mut suites = Vec::new();
        let builtin = Self::default_canonical_eval_suite();
        suites.push(EvalSuiteSummary {
            suite_id: builtin.suite_id.clone(),
            name: builtin.name.clone(),
            description: builtin.description.clone(),
            is_builtin: true,
            cases_count: builtin.cases.len(),
        });

        let evals_dir = ConfigRegistry::evals_dir(theater_root);
        if let Ok(entries) = std::fs::read_dir(evals_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
                    if let Ok(raw) = std::fs::read_to_string(&path) {
                        if let Ok(custom) = serde_yaml::from_str::<EvalSuite>(&raw) {
                            suites.push(EvalSuiteSummary {
                                suite_id: custom.suite_id,
                                name: custom.name,
                                description: custom.description,
                                is_builtin: false,
                                cases_count: custom.cases.len(),
                            });
                        }
                    }
                }
            }
        }
        suites
    }

    /// Loads a suite by ID (built-in or YAML file).
    pub fn load_suite(theater_root: &Path, suite_id: &str) -> Result<EvalSuite, OrchestratorError> {
        let builtin = Self::default_canonical_eval_suite();
        if suite_id == builtin.suite_id || suite_id.trim().is_empty() {
            return Ok(builtin);
        }

        let evals_dir = ConfigRegistry::evals_dir(theater_root);
        if evals_dir.exists() {
            for entry in std::fs::read_dir(evals_dir)?.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
                    if let Ok(raw) = std::fs::read_to_string(&path) {
                        if let Ok(mut suite) = serde_yaml::from_str::<EvalSuite>(&raw) {
                            if suite.suite_id == suite_id {
                                suite.is_builtin = false;
                                return Ok(suite);
                            }
                        }
                    }
                }
            }
        }

        Err(OrchestratorError::InvalidConfig(format!(
            "Suite d'évaluation introuvable: {}",
            suite_id
        )))
    }

    /// Runs every case in the selected suite with `dry_run: true` and aggregates assertions.
    pub async fn run_suite(
        theater_root: &Path,
        theater_id: &str,
        suite_id: &str,
    ) -> Result<EvalRunReport, OrchestratorError> {
        let suite = Self::load_suite(theater_root, suite_id)?;
        let mut results = Vec::with_capacity(suite.cases.len());

        for case in &suite.cases {
            let req = WorkflowRequest {
                theater_id: theater_id.to_string(),
                theater_root: PathBuf::from(theater_root),
                workflow_id: case.workflow_id.clone(),
                input: case.input.clone(),
                dry_run: true,
                role: case.role,
                runtime_override: None,
            };

            match OrchestratorEngine::execute(req).await {
                Ok(res) => {
                    let failures = Self::evaluate_assertions(&case.assertions, &res.output, &res.validation);
                    let gate_statuses = res
                        .validation
                        .gates
                        .iter()
                        .map(|g| (g.gate, g.status))
                        .collect();

                    results.push(EvalCaseResult {
                        case_id: case.id.clone(),
                        name: case.name.clone(),
                        workflow_id: case.workflow_id.clone(),
                        passed: failures.is_empty(),
                        trace_id: res.trace_id,
                        duration_ms: res.trace.duration_ms,
                        failures,
                        gate_statuses,
                    });
                }
                Err(err) => {
                    results.push(EvalCaseResult {
                        case_id: case.id.clone(),
                        name: case.name.clone(),
                        workflow_id: case.workflow_id.clone(),
                        passed: false,
                        trace_id: String::new(),
                        duration_ms: 0,
                        failures: vec![format!("Erreur d'exécution: {}", err)],
                        gate_statuses: Vec::new(),
                    });
                }
            }
        }

        let total_cases = results.len();
        let passed_cases = results.iter().filter(|r| r.passed).count();
        let failed_cases = total_cases.saturating_sub(passed_cases);

        Ok(EvalRunReport {
            suite_id: suite.suite_id,
            suite_name: suite.name,
            executed_at: Utc::now().to_rfc3339(),
            total_cases,
            passed_cases,
            failed_cases,
            results,
        })
    }

    fn evaluate_assertions(
        assertions: &EvalAssertions,
        output: &serde_json::Value,
        validation: &crate::trace::ValidationReport,
    ) -> Vec<String> {
        let mut failures = Vec::new();
        let out_str = serde_json::to_string(output).unwrap_or_default().to_lowercase();

        if let Some(expected_pass) = assertions.expect_overall_pass {
            if validation.overall_passed != expected_pass {
                failures.push(format!(
                    "Attendu overall_passed={}, obtenu {}",
                    expected_pass, validation.overall_passed
                ));
            }
        }

        for gate in &assertions.expect_gates_passed {
            let ok = validation
                .gates
                .iter()
                .find(|g| g.gate == *gate)
                .map(|g| matches!(g.status, GateStatus::Passed | GateStatus::Skipped))
                .unwrap_or(false);
            if !ok {
                failures.push(format!("La porte {:?} n'est pas Passed/Skipped", gate));
            }
        }

        if let Some(expected_silence) = assertions.expect_documentary_silence {
            let actual = output
                .get("documentary_silence")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if actual != expected_silence {
                failures.push(format!(
                    "Attendu documentary_silence={}, obtenu {}",
                    expected_silence, actual
                ));
            }
        }

        for needle in &assertions.output_contains {
            if !out_str.contains(&needle.to_lowercase()) {
                failures.push(format!("Texte attendu absent de la sortie: `{}`", needle));
            }
        }

        for forbidden in &assertions.output_not_contains {
            if out_str.contains(&forbidden.to_lowercase()) {
                failures.push(format!("Texte interdit présent dans la sortie: `{}`", forbidden));
            }
        }

        failures
    }

    /// Built-in 7-workflow canonical regression suite runnable in Dry-Run on any Theater.
    pub fn default_canonical_eval_suite() -> EvalSuite {
        EvalSuite {
            suite_id: "default_canonical".to_string(),
            name: "Validation Canonique des 7 Workflows".to_string(),
            description: "Vérifie en mode Dry-Run le silence documentaire (WF-01), les verrous Wiki (WF-02), le déterminisme Machina (WF-03), l'Essence/XP (WF-04), la connexité nodale (WF-05), l'anti-fuite MJ (WF-06) et le Brouillard de Guerre (WF-07).".to_string(),
            is_builtin: true,
            cases: vec![
                EvalCase {
                    id: "eval_wf01_silence".to_string(),
                    name: "WF-01 Archiviste — Silence Documentaire sur requête hors-corpus".to_string(),
                    workflow_id: "WF-01".to_string(),
                    role: Role::Player,
                    input: json!({
                        "query": "Quel est le numéro de matricule galactique du vaisseau Xylar-999888 ?"
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G2Epistemic],
                        expect_documentary_silence: Some(true),
                        output_contains: vec!["silence documentaire".to_string()],
                        output_not_contains: Vec::new(),
                    },
                },
                EvalCase {
                    id: "eval_wf02_scribe".to_string(),
                    name: "WF-02 Scribe — Résolution & Patch Markdown non destructif".to_string(),
                    workflow_id: "WF-02".to_string(),
                    role: Role::Gm,
                    input: json!({
                        "entity_title": "Sanctuaire de Vérification",
                        "category": "lieux",
                        "section_title": "Observation",
                        "aliases": ["Sanctuaire Test"],
                        "markdown_delta": "Ce lieu ancien abrite une aura paisible."
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G3Machina],
                        expect_documentary_silence: None,
                        output_contains: vec!["01_wiki/lieux/".to_string()],
                        output_not_contains: Vec::new(),
                    },
                },
                EvalCase {
                    id: "eval_wf03_arbiter".to_string(),
                    name: "WF-03 Légiste — Résolution mécanique 100% déterministe".to_string(),
                    workflow_id: "WF-03".to_string(),
                    role: Role::Gm,
                    input: json!({
                        "actor_id": "magus_test",
                        "action_type": "CastSpell",
                        "skill_expression": "2d6+5",
                        "target_defense": 10,
                        "situational_modifiers": [["Aura", 2]],
                        "run_monte_carlo": true,
                        "monte_carlo_iterations": 200
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G3Machina],
                        expect_documentary_silence: None,
                        output_contains: vec!["castspell".to_string()],
                        output_not_contains: Vec::new(),
                    },
                },
                EvalCase {
                    id: "eval_wf04_steward".to_string(),
                    name: "WF-04 Intendant — Audit création Shadowrun & Essence décimale".to_string(),
                    workflow_id: "WF-04".to_string(),
                    role: Role::Gm,
                    input: json!({
                        "persona_id": "eval_runner_sr6",
                        "mutation_type": "validate_shadowrun",
                        "creation_input": {
                            "metatype_priority": "D",
                            "attributes_priority": "A",
                            "magic_priority": "B",
                            "skills_priority": "C",
                            "resources_priority": "E",
                            "base_magic_rating": 6,
                            "cyberware_essence_costs": [0.75, 0.50]
                        }
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G3Machina],
                        expect_documentary_silence: None,
                        output_contains: vec!["4.75".to_string()],
                        output_not_contains: Vec::new(),
                    },
                },
                EvalCase {
                    id: "eval_wf05_playwright".to_string(),
                    name: "WF-05 Dramaturge — Cohérence topologique du graphe de scènes".to_string(),
                    workflow_id: "WF-05".to_string(),
                    role: Role::Gm,
                    input: json!({
                        "play_id": "eval_play_01",
                        "campaign_name": "Évaluation Nodale",
                        "advance_clock": { "clock_id": "alerte_garde", "delta_segments": 2 }
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G3Machina],
                        expect_documentary_silence: None,
                        output_contains: vec!["eval_play_01".to_string()],
                        output_not_contains: Vec::new(),
                    },
                },
                EvalCase {
                    id: "eval_wf06_director".to_string(),
                    name: "WF-06 Metteur en Scène — Anti-fuite secret MJ & fidélité verdict".to_string(),
                    workflow_id: "WF-06".to_string(),
                    role: Role::Gm,
                    input: json!({
                        "play_id": "eval_play_01",
                        "zone_id": "cour_interieure",
                        "scene_summary": "Les torches illuminent la cour pavée.",
                        "gm_secrets": ["TRAHISON_SECRETE_DUC_MORGAN"],
                        "ambient_mood": "mystere"
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G2Epistemic, GateId::G3Machina],
                        expect_documentary_silence: None,
                        output_contains: vec!["zone:cour_interieure".to_string()],
                        output_not_contains: vec!["trahison_secrete_duc_morgan".to_string()],
                    },
                },
                EvalCase {
                    id: "eval_wf07_actor".to_string(),
                    name: "WF-07 Acteur — Filtrage Brouillard de Guerre Tri-Dimensionnel".to_string(),
                    workflow_id: "WF-07".to_string(),
                    role: Role::Player,
                    input: json!({
                        "actor_id": "kenshi",
                        "actor_name": "Kenshi",
                        "current_zone": "room_a",
                        "active_plane": "physical",
                        "visible_zones": [],
                        "scene_events": [
                            { "zone_id": "room_a", "plane": "physical", "is_gm_only": false, "content": "Un messager entre dans la salle." },
                            { "zone_id": "room_c", "plane": "physical", "is_gm_only": false, "content": "SECRET_SALLE_CACHEE_99" },
                            { "zone_id": "room_a", "plane": "astral", "is_gm_only": false, "content": "SPECTRE_ASTRAL_INVISIBLE" }
                        ],
                        "prompt": "Décris ta réaction."
                    }),
                    assertions: EvalAssertions {
                        expect_overall_pass: Some(true),
                        expect_gates_passed: vec![GateId::G1Contract, GateId::G2Epistemic],
                        expect_documentary_silence: None,
                        output_contains: Vec::new(),
                        output_not_contains: vec![
                            "secret_salle_cachee_99".to_string(),
                            "spectre_astral_invisible".to_string(),
                        ],
                    },
                },
            ],
        }
    }
}
