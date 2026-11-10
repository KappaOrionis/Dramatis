use serde::{Deserialize, Serialize};
use crate::topology::ZoneId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RealityPlane {
    Physical,
    Astral,
    MatrixVr,
    MatrixAr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContextView {
    pub actor_id: String,
    pub actor_name: String,
    pub is_gm: bool,
    pub current_zone: ZoneId,
    pub active_plane: RealityPlane,
    pub visible_zones: Vec<ZoneId>,
    pub known_secrets: Vec<String>,
    pub relationship_gauges: std::collections::HashMap<String, f32>, // actor_id -> score (-1.0 to +1.0)
}

impl AgentContextView {
    pub fn can_perceive_event(
        &self,
        event_zone: &ZoneId,
        event_plane: RealityPlane,
        is_gm_only: bool,
    ) -> bool {
        if self.is_gm {
            return true;
        }

        if is_gm_only {
            return false;
        }

        // 1. Filtrage planaire strict
        if self.active_plane != event_plane {
            return false;
        }

        // 2. Filtrage spatial (présence ou ligne de vue)
        if self.current_zone != *event_zone && !self.visible_zones.contains(event_zone) {
            return false;
        }

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fog_of_war_perception() {
        let view = AgentContextView {
            actor_id: "samurai_1".to_string(),
            actor_name: "Kenshi".to_string(),
            is_gm: false,
            current_zone: ZoneId("room_a".to_string()),
            active_plane: RealityPlane::Physical,
            visible_zones: vec![ZoneId("room_b".to_string())],
            known_secrets: vec![],
            relationship_gauges: std::collections::HashMap::new(),
        };

        // Même zone et plan physique -> perçu
        assert!(view.can_perceive_event(&ZoneId("room_a".to_string()), RealityPlane::Physical, false));

        // Secret réservé au MJ -> masqué
        assert!(!view.can_perceive_event(&ZoneId("room_a".to_string()), RealityPlane::Physical, true));

        // Événement sur le plan astral (ex: esprit observant) -> ignoré par le mondain
        assert!(!view.can_perceive_event(&ZoneId("room_a".to_string()), RealityPlane::Astral, false));

        // Autre pièce sans ligne de vue -> masqué
        assert!(!view.can_perceive_event(&ZoneId("room_c".to_string()), RealityPlane::Physical, false));
    }
}

