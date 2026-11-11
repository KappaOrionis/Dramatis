use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermeticCraftInput {
    pub spell_or_item_name: String,
    pub technique_name: String,
    pub technique_score: i64,
    pub form_name: String,
    pub form_score: i64,
    pub intelligence_score: i64,
    pub magic_theory_score: i64,
    pub aura_modifier: i64,
    pub lab_quality_modifier: i64,
    pub base_guideline_level: i64,
    pub range_magnitudes: i64,    // e.g. Personal=0, Touch=+1, Voice=+2, Sight=+3
    pub duration_magnitudes: i64, // e.g. Momentary=0, Concentration=+1, Diameter=+1, Sun=+2
    pub target_magnitudes: i64,   // e.g. Individual=0, Part=+1, Group=+2, Room=+2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermeticCraftVerdict {
    pub spell_or_item_name: String,
    pub final_effect_level: i64,
    pub lab_total: i64,
    pub surplus_per_season: i64,
    pub can_invent_in_one_season: bool,
    pub seasons_required: Option<u32>,
    pub explanation: String,
}

pub struct ArtificerEngine;

impl ArtificerEngine {
    /// Calculates the exact Ars Magica 5e Spell/Item Level from a base guideline + magnitudes
    /// Rule: up to level 5, +1 magnitude = +1 level; above level 5, +1 magnitude = +5 levels (`PER-06`)
    pub fn calculate_hermetic_level(base_level: i64, total_magnitudes: i64) -> i64 {
        let mut level = base_level;
        for _ in 0..total_magnitudes {
            if level < 5 {
                level += 1;
            } else {
                level += 5;
            }
        }
        level
    }

    pub fn evaluate_hermetic_project(input: &HermeticCraftInput) -> HermeticCraftVerdict {
        let total_magnitudes = input.range_magnitudes + input.duration_magnitudes + input.target_magnitudes;
        let final_effect_level = Self::calculate_hermetic_level(input.base_guideline_level, total_magnitudes);

        let lab_total = input.technique_score
            + input.form_score
            + input.intelligence_score
            + input.magic_theory_score
            + input.aura_modifier
            + input.lab_quality_modifier;

        let surplus = lab_total - final_effect_level;
        let can_invent_in_one_season = surplus >= final_effect_level;

        let seasons_required = if surplus <= 0 {
            None
        } else {
            let seasons = ((final_effect_level + surplus - 1) / surplus) as u32;
            Some(seasons.max(1))
        };

        let explanation = match seasons_required {
            Some(s) => format!(
                "Projet '{}' ({} {}, Niveau {}) : Total de Labo {} (Surplus +{}/saison -> {} saison(s) requise(s)).",
                input.spell_or_item_name,
                input.technique_name,
                input.form_name,
                final_effect_level,
                lab_total,
                surplus,
                s
            ),
            None => format!(
                "Projet '{}' impossible en l'état : Total de Labo ({}) <= Niveau de l'effet ({}).",
                input.spell_or_item_name, lab_total, final_effect_level
            ),
        };

        HermeticCraftVerdict {
            spell_or_item_name: input.spell_or_item_name.clone(),
            final_effect_level,
            lab_total,
            surplus_per_season: surplus,
            can_invent_in_one_season,
            seasons_required,
            explanation,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_artificer_pilum_of_fire_calculation() {
        // Pilum of Fire: Base CrIg 10, Range Voice (+2 magnitudes) -> Final Level 20
        let input = HermeticCraftInput {
            spell_or_item_name: "Pilum of Fire".to_string(),
            technique_name: "Creo".to_string(),
            technique_score: 10,
            form_name: "Ignem".to_string(),
            form_score: 12,
            intelligence_score: 3,
            magic_theory_score: 5,
            aura_modifier: 4,
            lab_quality_modifier: 2,
            base_guideline_level: 10,
            range_magnitudes: 2,
            duration_magnitudes: 0,
            target_magnitudes: 0,
        };

        let verdict = ArtificerEngine::evaluate_hermetic_project(&input);
        assert_eq!(verdict.final_effect_level, 20);
        assert_eq!(verdict.lab_total, 36); // 10+12+3+5+4+2 = 36
        assert_eq!(verdict.surplus_per_season, 16);
        assert_eq!(verdict.seasons_required, Some(2)); // 16/saison -> 2 saisons pour accumuler >= 20
    }
}

