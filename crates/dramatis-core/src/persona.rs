use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbilityScore {
    pub name: String,
    pub value: i64,
    pub modifier: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMonitor {
    pub name: String, // ex: "Physique", "Etourdissant", "Matriciel", "Blessures"
    pub max_boxes: usize,
    pub current_damage: usize,
    pub penalty: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaState {
    pub id: String,
    pub name: String,
    pub theater_system: String,
    pub archetype: Option<String>,
    pub attributes: HashMap<String, AbilityScore>,
    pub health_monitors: Vec<HealthMonitor>,
    pub essence: Option<f64>, // Decimal precision pour SR6
    pub experience_points: i64,
    pub karma_or_vis: Option<i64>,
    pub tags: Vec<String>,
}

impl PersonaState {
    pub fn new(id: &str, name: &str, system: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            theater_system: system.to_string(),
            archetype: None,
            attributes: HashMap::new(),
            health_monitors: Vec::new(),
            essence: Some(6.0),
            experience_points: 0,
            karma_or_vis: None,
            tags: Vec::new(),
        }
    }

    pub fn apply_damage(&mut self, monitor_name: &str, amount: usize) -> bool {
        if let Some(m) = self.health_monitors.iter_mut().find(|m| m.name == monitor_name) {
            m.current_damage = (m.current_damage + amount).min(m.max_boxes);
            // Recalcul du malus standard (ex: -1 par tranche de 3 cases)
            m.penalty = -((m.current_damage / 3) as i64);
            true
        } else {
            false
        }
    }

    pub fn to_markdown(&self) -> String {
        let mut md = format!("# Fiche de Personnage : {}\n\n", self.name);
        md.push_str(&format!("* **ID** : `{}`\n", self.id));
        md.push_str(&format!("* **Système** : {}\n", self.theater_system));
        if let Some(arch) = &self.archetype {
            md.push_str(&format!("* **Archétype** : {}\n", arch));
        }
        if let Some(ess) = self.essence {
            md.push_str(&format!("* **Essence** : {:.2}\n", ess));
        }

        md.push_str("\n## Attributs\n\n| Attribut | Valeur |\n| :--- | :--- |\n");
        for (k, v) in &self.attributes {
            md.push_str(&format!("| {} | {} |\n", k, v.value));
        }

        md.push_str("\n## Moniteurs de Santé\n\n| Moniteur | Dégâts / Max | Malus Actuel |\n| :--- | :--- | :--- |\n");
        for m in &self.health_monitors {
            md.push_str(&format!("| {} | {} / {} | {} |\n", m.name, m.current_damage, m.max_boxes, m.penalty));
        }

        md
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_persona_creation_and_damage() {
        let mut p = PersonaState::new("mage_1", "Lucius Hermeticus", "ars-magica-5e");
        p.health_monitors.push(HealthMonitor {
            name: "Blessures".to_string(),
            max_boxes: 12,
            current_damage: 0,
            penalty: 0,
        });

        assert!(p.apply_damage("Blessures", 4));
        let m = &p.health_monitors[0];
        assert_eq!(m.current_damage, 4);
        assert_eq!(m.penalty, -1);

        let md = p.to_markdown();
        assert!(md.contains("# Fiche de Personnage : Lucius Hermeticus"));
        assert!(md.contains("4 / 12"));
    }
}

