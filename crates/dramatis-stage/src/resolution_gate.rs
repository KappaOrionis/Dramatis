use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalIntention {
    pub actor_id: String,
    pub action_type: String, // "Attack", "CastSpell", "HackNode", "Negotiate"
    pub target_id: Option<String>,
    pub skill_expression: String, // e.g. "4d6kh3+2" or "Intellego + Vim"
    pub situational_modifiers: Vec<(String, i64)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MechanicalResolution {
    pub intention: MechanicalIntention,
    pub deterministic_verdict: String,
    pub success: bool,
    pub margin: i64,
    pub side_effects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TablePlayMode {
    Solo,         // 1 Human Player + Director + Bot Companions
    CoopNoGm,     // 2-5 Human Players + Director
    GmCopilot,    // Human GM + Director Copilot + Human Players
    SimOnlyBots,  // 100% Bots Simulation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GmOverrideCommand {
    pub gm_id: String,
    pub action: String, // "override_roll", "rewind_turns", "wizard_of_oz"
    pub target_turn_or_actor: String,
    pub injection_payload: serde_json::Value,
}

pub struct StageResolutionGate;

impl StageResolutionGate {
    /// Pure deterministic gate: converts a declarative intention into a finalized mechanical verdict
    /// No LLM is allowed to generate rolls or compute damages (Narration vs Machina principle)
    pub fn resolve_intention(
        intention: MechanicalIntention,
        simulated_roll_total: i64,
        target_defense: i64,
    ) -> MechanicalResolution {
        let total_modifier: i64 = intention.situational_modifiers.iter().map(|(_, m)| m).sum();
        let final_total = simulated_roll_total + total_modifier;
        let margin = final_total - target_defense;
        let success = margin >= 0;

        let verdict = if success {
            format!(
                "Succès de l'action `{}` par `{}` (Score {} vs Défense {}, Marge +{}).",
                intention.action_type, intention.actor_id, final_total, target_defense, margin
            )
        } else {
            format!(
                "Échec de l'action `{}` par `{}` (Score {} vs Défense {}, Marge {}).",
                intention.action_type, intention.actor_id, final_total, target_defense, margin
            )
        };

        MechanicalResolution {
            intention,
            deterministic_verdict: verdict,
            success,
            margin,
            side_effects: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stage_resolution_gate_deterministic() {
        let intention = MechanicalIntention {
            actor_id: "actor_magus".to_string(),
            action_type: "CastSpell".to_string(),
            target_id: Some("target_gargoyle".to_string()),
            skill_expression: "Creo + Ignem".to_string(),
            situational_modifiers: vec![("Aura de la zone".to_string(), 3), ("Blessure légère".to_string(), -1)],
        };

        let res = StageResolutionGate::resolve_intention(intention, 15, 12);
        assert!(res.success);
        assert_eq!(res.margin, 5); // 15 + (3 - 1) - 12 = 5
        assert!(res.deterministic_verdict.contains("Succès"));
    }
}
