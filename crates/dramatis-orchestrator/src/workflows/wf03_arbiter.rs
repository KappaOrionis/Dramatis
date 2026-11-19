use std::collections::HashMap;
use std::time::Instant;
use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;

use dramatis_machina::{AdvancedDiceParser, DiceEngine, MonteCarloSimulator, RhaiSandbox};
use dramatis_stage::{MechanicalIntention, StageResolutionGate};

use crate::error::OrchestratorError;
use crate::trace::StepTrace;
use crate::workflows::{elapsed_ms, WorkflowOutcome, WorkflowRuntimeInput};

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct ArbiterInput {
    pub actor_id: String,
    pub action_type: String,
    pub target_id: Option<String>,
    pub skill_expression: String,
    pub roll_mode: Option<String>, // "expression" | "standard" | "shadowrun" | "ars_magica" | "rhai"
    pub target_defense: Option<i64>,
    pub situational_modifiers: Vec<(String, i64)>,
    pub rhai_script: Option<String>,
    pub rhai_vars: HashMap<String, i64>,
    pub physical_roll_override: Option<i64>,
    pub run_monte_carlo: Option<bool>,
    pub monte_carlo_iterations: Option<usize>,
}

impl Default for ArbiterInput {
    fn default() -> Self {
        Self {
            actor_id: "actor_1".to_string(),
            action_type: "SkillCheck".to_string(),
            target_id: None,
            skill_expression: "1d20".to_string(),
            roll_mode: None,
            target_defense: Some(12),
            situational_modifiers: Vec::new(),
            rhai_script: None,
            rhai_vars: HashMap::new(),
            physical_roll_override: None,
            run_monte_carlo: None,
            monte_carlo_iterations: None,
        }
    }
}

/// WF-03 (`dramatis.arbiter`): 100% deterministic mechanical resolution via `dramatis-machina` & Rhai sandbox.
pub async fn run(ctx: &WorkflowRuntimeInput<'_>) -> Result<WorkflowOutcome, OrchestratorError> {
    let input: ArbiterInput = serde_json::from_value(ctx.input_payload.clone())
        .map_err(|e| OrchestratorError::InvalidConfig(format!("Entrée WF-03 invalide: {}", e)))?;

    let mut steps = Vec::new();
    let physical_dice_mode = ctx
        .agent_config
        .workflow_params
        .get("physical_dice_mode")
        .and_then(|v| v.as_str())
        .unwrap_or("off");

    let default_roll_mode = ctx
        .agent_config
        .workflow_params
        .get("default_roll_mode")
        .and_then(|v| v.as_str())
        .unwrap_or("expression");

    let roll_mode = input
        .roll_mode
        .as_deref()
        .unwrap_or(default_roll_mode);

    // Step 1: Intent parsing
    let t1 = Instant::now();
    let intention = MechanicalIntention {
        actor_id: input.actor_id.clone(),
        action_type: input.action_type.clone(),
        target_id: input.target_id.clone(),
        skill_expression: input.skill_expression.clone(),
        situational_modifiers: input.situational_modifiers.clone(),
    };
    steps.push(StepTrace {
        step_id: "intent_parsing".to_string(),
        name: "Normalisation de l'intention mécanique".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t1),
        summary: format!(
            "Acteur `{}` -> `{}` ({})",
            intention.actor_id, intention.action_type, intention.skill_expression
        ),
        metadata: json!({ "roll_mode": roll_mode }),
    });

    // Step 2: Query tables.sqlite for registered mechanical tables
    let t2 = Instant::now();
    let tables_db_path = ctx.theater_root.join("02_machina").join("tables.sqlite");
    let available_tables = if ctx.workflow_config.is_step_enabled("rule_lookup") && tables_db_path.exists() {
        list_machina_tables(&tables_db_path)
    } else {
        Vec::new()
    };
    steps.push(StepTrace {
        step_id: "rule_lookup".to_string(),
        name: "Consultation des tables mécaniques SQLite".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t2),
        summary: format!("{} table(s) SQLite disponible(s)", available_tables.len()),
        metadata: json!({ "tables": available_tables }),
    });

    // Step 3: Deterministic execution via dramatis-machina
    let t3 = Instant::now();
    let mut audit_details = serde_json::Map::new();
    let raw_roll_total: i64 = if let (Some(phys), true) = (
        input.physical_roll_override,
        physical_dice_mode != "off",
    ) {
        audit_details.insert("source".to_string(), json!("physical_dice_override"));
        audit_details.insert("physical_value".to_string(), json!(phys));
        phys
    } else {
        match roll_mode {
            "rhai" => {
                let script = input
                    .rhai_script
                    .as_deref()
                    .unwrap_or("10");
                let sandbox = RhaiSandbox::with_sqlite_tables(&tables_db_path);
                let mut scope = rhai::Scope::new();
                for (k, v) in &input.rhai_vars {
                    scope.set_value(k.clone(), *v);
                }
                let res: i64 = sandbox
                    .evaluate_formula(script, scope)
                    .map_err(|e| OrchestratorError::Execution(format!("Erreur Rhai: {}", e)))?;
                audit_details.insert("source".to_string(), json!("rhai_sandbox"));
                audit_details.insert("script".to_string(), json!(script));
                res
            }
            "shadowrun" => {
                let pool_size: usize = input.skill_expression.trim().parse().unwrap_or(6);
                let sr = DiceEngine::roll_shadowrun(pool_size);
                audit_details.insert("source".to_string(), json!("shadowrun_pool"));
                audit_details.insert("hits".to_string(), json!(sr.hits));
                audit_details.insert("is_glitch".to_string(), json!(sr.is_glitch));
                audit_details.insert("is_critical_glitch".to_string(), json!(sr.is_critical_glitch));
                audit_details.insert("rolls".to_string(), json!(sr.rolls));
                sr.hits as i64
            }
            "ars_magica" => {
                let botch_dice: usize = input.skill_expression.trim().parse().unwrap_or(1);
                let ars = DiceEngine::roll_ars_magica_stress(botch_dice);
                let effective = if ars.is_botch { 0 } else { ars.final_die_value as i64 };
                audit_details.insert("source".to_string(), json!("ars_magica_stress"));
                audit_details.insert("final_die_value".to_string(), json!(ars.final_die_value));
                audit_details.insert("multiplier".to_string(), json!(ars.multiplier));
                audit_details.insert("is_botch".to_string(), json!(ars.is_botch));
                audit_details.insert("botch_zeros".to_string(), json!(ars.botch_zeros));
                effective
            }
            _ => {
                let adv = AdvancedDiceParser::parse_and_roll(&input.skill_expression)
                    .map_err(|e| OrchestratorError::InvalidConfig(format!("Expression dés invalide: {}", e)))?;
                audit_details.insert("source".to_string(), json!("advanced_dice_parser"));
                audit_details.insert("kept_rolls".to_string(), json!(adv.kept_rolls));
                audit_details.insert("all_rolls".to_string(), json!(adv.all_rolls));
                adv.total
            }
        }
    };

    steps.push(StepTrace {
        step_id: "machina_execution".to_string(),
        name: "Exécution déterministe (Dés / Rhai)".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t3),
        summary: format!("Résultat brut Machina = {}", raw_roll_total),
        metadata: serde_json::Value::Object(audit_details.clone()),
    });

    // Step 4: Optional Monte Carlo check
    let t4 = Instant::now();
    let should_mc = input.run_monte_carlo.unwrap_or_else(|| {
        ctx.agent_config
            .workflow_params
            .get("run_monte_carlo")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    });
    let mc_summary = if should_mc && ctx.workflow_config.is_step_enabled("monte_carlo_check") {
        let iterations = input
            .monte_carlo_iterations
            .unwrap_or_else(|| {
                ctx.agent_config
                    .workflow_params
                    .get("monte_carlo_iterations")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(2000) as usize
            })
            .clamp(100, 20_000);
        let threshold = input.target_defense.unwrap_or(12);
        let sim = MonteCarloSimulator::simulate_standard_vs_threshold(1, 20, 0, threshold, iterations);
        steps.push(StepTrace {
            step_id: "monte_carlo_check".to_string(),
            name: "Simulation statistique Monte-Carlo".to_string(),
            status: "completed".to_string(),
            duration_ms: elapsed_ms(&t4),
            summary: format!("{} itérations -> taux de succès {:.1}%", iterations, sim.success_rate * 100.0),
            metadata: json!({ "success_rate": sim.success_rate, "iterations": iterations }),
        });
        Some(sim)
    } else {
        steps.push(StepTrace {
            step_id: "monte_carlo_check".to_string(),
            name: "Simulation statistique Monte-Carlo".to_string(),
            status: "skipped".to_string(),
            duration_ms: 0,
            summary: "Simulation non demandée".to_string(),
            metadata: json!({}),
        });
        None
    };

    // Step 5: Format immutable MechanicalResolution
    let t5 = Instant::now();
    let target_defense = input.target_defense.unwrap_or(10);
    let resolution = StageResolutionGate::resolve_intention(
        intention,
        raw_roll_total,
        target_defense,
    );

    let verdict_tag = if resolution.success {
        if resolution.margin >= 5 {
            "critical_success"
        } else {
            "success"
        }
    } else if resolution.margin <= -5 {
        "botch_or_glitch"
    } else {
        "failure"
    };

    let output = json!({
        "verdict": verdict_tag,
        "success": resolution.success,
        "total_score": raw_roll_total + input.situational_modifiers.iter().map(|(_, m)| m).sum::<i64>(),
        "raw_roll_total": raw_roll_total,
        "target_defense": target_defense,
        "margin": resolution.margin,
        "is_critical": resolution.margin >= 5 || resolution.margin <= -5,
        "deterministic_verdict": resolution.deterministic_verdict,
        "audit_trace": audit_details,
        "monte_carlo": mc_summary,
    });

    steps.push(StepTrace {
        step_id: "verdict_formatting".to_string(),
        name: "Formatage du MechanicalResolution".to_string(),
        status: "completed".to_string(),
        duration_ms: elapsed_ms(&t5),
        summary: resolution.deterministic_verdict.clone(),
        metadata: json!({ "verdict": verdict_tag, "margin": resolution.margin }),
    });

    Ok(WorkflowOutcome {
        output,
        steps,
        expected_schema: json!({
            "type": "object",
            "required": ["verdict", "success", "total_score", "margin", "deterministic_verdict"],
            "properties": {
                "verdict": { "type": "string", "enum": ["critical_success", "success", "failure", "botch_or_glitch"] },
                "success": { "type": "boolean" },
                "total_score": { "type": "integer" },
                "margin": { "type": "integer" },
                "deterministic_verdict": { "type": "string" }
            }
        }),
        machina_deterministic_source: true,
        mechanical_resolution: Some(resolution),
        ..WorkflowOutcome::default()
    })
}

fn list_machina_tables(db_path: &std::path::Path) -> Vec<String> {
    let Ok(conn) = Connection::open(db_path) else {
        return Vec::new();
    };
    let Ok(mut stmt) = conn.prepare("SELECT table_name FROM table_metadata") else {
        return Vec::new();
    };
    let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) else {
        return Vec::new();
    };
    rows.flatten().collect()
}
