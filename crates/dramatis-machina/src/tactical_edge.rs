use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TacticalCover {
    None,
    Light,      // +2 DR
    Medium,     // +4 DR
    Heavy,      // +6 DR
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LightingCondition {
    Clear,
    Dim,        // -1 to AR
    Darkness,   // -3 to AR unless thermal
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeEvaluationInput {
    pub attack_rating: i64,
    pub defense_rating: i64,
    pub cover: TacticalCover,
    pub lighting: LightingCondition,
    pub attacker_has_thermal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EdgeEvaluationResult {
    pub final_ar: i64,
    pub final_dr: i64,
    pub ar_advantage: i64,
    pub edge_awarded_to: Option<String>, // "attacker", "defender", or None
    pub legal_edge_boosts: Vec<String>,
}

pub struct TacticalEdgeEngine;

impl TacticalEdgeEngine {
    /// Evaluates Attack Rating (AR) vs Defense Rating (DR) to determine dynamic Edge gains (MAC-04)
    /// Rule (Shadowrun 6e): If AR >= DR + 4 -> Attacker gains 1 Edge. If DR >= AR + 4 -> Defender gains 1 Edge.
    pub fn evaluate_edge(input: &EdgeEvaluationInput) -> EdgeEvaluationResult {
        let mut final_ar = input.attack_rating;
        let mut final_dr = input.defense_rating;

        // Apply cover to DR
        match input.cover {
            TacticalCover::None => {}
            TacticalCover::Light => final_dr += 2,
            TacticalCover::Medium => final_dr += 4,
            TacticalCover::Heavy => final_dr += 6,
        }

        // Apply lighting to AR
        match input.lighting {
            LightingCondition::Clear => {}
            LightingCondition::Dim => {
                if !input.attacker_has_thermal {
                    final_ar -= 1;
                }
            }
            LightingCondition::Darkness => {
                if !input.attacker_has_thermal {
                    final_ar -= 3;
                }
            }
        }

        let ar_advantage = final_ar - final_dr;
        let (edge_awarded_to, legal_edge_boosts) = if ar_advantage >= 4 {
            (
                Some("attacker".to_string()),
                vec![
                    "Reroll 1 die (1 Edge)".to_string(),
                    "+1 to a single die roll (1 Edge)".to_string(),
                    "+1 Hit after roll (2 Edge)".to_string(),
                    "Reroll all failed dice (4 Edge)".to_string(),
                ],
            )
        } else if ar_advantage <= -4 {
            (
                Some("defender".to_string()),
                vec![
                    "Reroll 1 defense die (1 Edge)".to_string(),
                    "+2 to Defense Rating (1 Edge)".to_string(),
                    "Negate 1 opponent hit (2 Edge)".to_string(),
                ],
            )
        } else {
            (None, Vec::new())
        };

        EdgeEvaluationResult {
            final_ar,
            final_dr,
            ar_advantage,
            edge_awarded_to,
            legal_edge_boosts,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_attacker_gains_edge_on_superior_ar() {
        let input = EdgeEvaluationInput {
            attack_rating: 14,
            defense_rating: 8,
            cover: TacticalCover::None,
            lighting: LightingCondition::Clear,
            attacker_has_thermal: false,
        };

        let res = TacticalEdgeEngine::evaluate_edge(&input);
        assert_eq!(res.ar_advantage, 6);
        assert_eq!(res.edge_awarded_to, Some("attacker".to_string()));
        assert!(!res.legal_edge_boosts.is_empty());
    }

    #[test]
    fn test_cover_protects_and_awards_defender_edge() {
        let input = EdgeEvaluationInput {
            attack_rating: 10,
            defense_rating: 10,
            cover: TacticalCover::Heavy, // +6 DR
            lighting: LightingCondition::Clear,
            attacker_has_thermal: false,
        };

        let res = TacticalEdgeEngine::evaluate_edge(&input);
        assert_eq!(res.final_dr, 16);
        assert_eq!(res.ar_advantage, -6);
        assert_eq!(res.edge_awarded_to, Some("defender".to_string()));
    }
}

