use std::collections::HashSet;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArsMagicaCreationInput {
    pub age: u32,
    pub virtues_points: i32, // Positive sum of chosen virtues (max +10 for Magi)
    pub flaws_points: i32,   // Negative sum of chosen flaws (must balance virtues: virtues + flaws == 0)
    pub spent_early_childhood_xp: u32, // Fixed 45 XP
    pub spent_later_life_xp: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShadowrunPriorityInput {
    pub metatype_priority: char,   // 'A', 'B', 'C', 'D', 'E'
    pub attributes_priority: char,
    pub magic_priority: char,
    pub skills_priority: char,
    pub resources_priority: char,
    pub base_magic_rating: i64,
    pub cyberware_essence_costs: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreationValidationResult {
    pub is_valid: bool,
    pub calculated_essence: Option<f64>,
    pub effective_magic_rating: Option<i64>,
    pub total_xp_budget: Option<u32>,
    pub errors: Vec<String>,
    pub summary: String,
}

pub struct CharacterCreationEngine;

impl CharacterCreationEngine {
    /// Validates Ars Magica 5e character creation (`PER-02`)
    /// - Virtues cannot exceed +10 points
    /// - Virtues + Flaws must sum to 0
    /// - Early childhood = 45 XP, plus 15 XP per year after age 5 (or 240 XP Apprenticeship for Magi)
    pub fn validate_ars_magica(input: &ArsMagicaCreationInput, is_magus: bool) -> CreationValidationResult {
        let mut errors = Vec::new();

        if input.virtues_points > 10 {
            errors.push(format!(
                "Total des Vertus ({}) dépasse le plafond hermétique de +10 points.",
                input.virtues_points
            ));
        }

        if input.virtues_points + input.flaws_points != 0 {
            errors.push(format!(
                "Déséquilibre Vertus/Vices : Vertus (+{}) et Vices ({}) doivent s'équilibrer exactement à 0.",
                input.virtues_points, input.flaws_points
            ));
        }

        let max_later_xp = if is_magus {
            240 + (input.age.saturating_sub(25) * 15)
        } else {
            input.age.saturating_sub(5) * 15
        };

        let total_budget = 45 + max_later_xp;
        let total_spent = input.spent_early_childhood_xp + input.spent_later_life_xp;

        if total_spent > total_budget {
            errors.push(format!(
                "Dépense d'XP ({}) supérieure au budget autorisé pour l'âge {} ({} XP).",
                total_spent, input.age, total_budget
            ));
        }

        let is_valid = errors.is_empty();
        let summary = if is_valid {
            format!(
                "Création Ars Magica valide (Vertus +{} / Vices {}, Budget XP {}/{}).",
                input.virtues_points, input.flaws_points, total_spent, total_budget
            )
        } else {
            errors.join(" | ")
        };

        CreationValidationResult {
            is_valid,
            calculated_essence: None,
            effective_magic_rating: None,
            total_xp_budget: Some(total_budget),
            errors,
            summary,
        }
    }

    /// Validates Shadowrun 6e Priority Matrix A-E & computes decimal Essence + Magic loss (`PER-02`, `PER-03`)
    pub fn validate_shadowrun_priority(input: &ShadowrunPriorityInput) -> CreationValidationResult {
        let mut errors = Vec::new();
        let priorities = [
            input.metatype_priority.to_ascii_uppercase(),
            input.attributes_priority.to_ascii_uppercase(),
            input.magic_priority.to_ascii_uppercase(),
            input.skills_priority.to_ascii_uppercase(),
            input.resources_priority.to_ascii_uppercase(),
        ];

        let expected: HashSet<char> = ['A', 'B', 'C', 'D', 'E'].into_iter().collect();
        let actual: HashSet<char> = priorities.iter().copied().collect();

        if actual != expected {
            errors.push(format!(
                "La matrice de Priorités SR6 doit assigner exactement une fois chaque rang A, B, C, D, E (reçu : {:?}).",
                priorities
            ));
        }

        // Exact hundredths calculation for Essence (`PER-03`)
        let total_cost_hundredths: i64 = input
            .cyberware_essence_costs
            .iter()
            .map(|c| (c * 100.0).round() as i64)
            .sum();

        let remaining_hundredths = 600 - total_cost_hundredths;
        let calculated_essence = (remaining_hundredths as f64) / 100.0;

        if remaining_hundredths <= 0 {
            errors.push(format!(
                "Perte critique d'Essence ({:.2} <= 0.00) : le personnage succombe à la cyberpsychose / mort clinique.",
                calculated_essence
            ));
        }

        // Every started point of Essence lost reduces Magic by 1
        let essence_lost_ceil = ((total_cost_hundredths + 99) / 100).max(0);
        let effective_magic = (input.base_magic_rating - essence_lost_ceil).max(0);

        let is_valid = errors.is_empty();
        let summary = if is_valid {
            format!(
                "Priorités SR6 A-E valides. Essence : {:.2}/6.00 (Magie effective : {}).",
                calculated_essence, effective_magic
            )
        } else {
            errors.join(" | ")
        };

        CreationValidationResult {
            is_valid,
            calculated_essence: Some(calculated_essence),
            effective_magic_rating: Some(effective_magic),
            total_xp_budget: None,
            errors,
            summary,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ars_magica_creation_validation() {
        let valid_input = ArsMagicaCreationInput {
            age: 25,
            virtues_points: 7,
            flaws_points: -7,
            spent_early_childhood_xp: 45,
            spent_later_life_xp: 240,
        };
        let res = CharacterCreationEngine::validate_ars_magica(&valid_input, true);
        assert!(res.is_valid);
        assert_eq!(res.total_xp_budget, Some(285));
    }

    #[test]
    fn test_shadowrun_priority_and_decimal_essence() {
        let sr_input = ShadowrunPriorityInput {
            metatype_priority: 'D',
            attributes_priority: 'A',
            magic_priority: 'B',
            skills_priority: 'C',
            resources_priority: 'E',
            base_magic_rating: 4,
            cyberware_essence_costs: vec![0.20, 0.35], // Total 0.55 -> Essence 5.45 -> Magic reduced by 1 -> 3
        };

        let res = CharacterCreationEngine::validate_shadowrun_priority(&sr_input);
        assert!(res.is_valid);
        assert_eq!(res.calculated_essence, Some(5.45));
        assert_eq!(res.effective_magic_rating, Some(3));
    }
}
