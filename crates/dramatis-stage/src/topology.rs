use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ZoneId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TacticalTag {
    pub name: String,
    pub modifier_type: String, // ex: "cover", "darkness", "noise", "aura"
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TacticalZone {
    pub id: ZoneId,
    pub title: String,
    pub description: String,
    pub connected_zones: Vec<ZoneId>,
    pub tags: Vec<TacticalTag>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SceneTopology {
    pub zones: HashMap<ZoneId, TacticalZone>,
}

impl SceneTopology {
    pub fn add_zone(&mut self, zone: TacticalZone) {
        self.zones.insert(zone.id.clone(), zone);
    }

    pub fn get_zone(&self, id: &ZoneId) -> Option<&TacticalZone> {
        self.zones.get(id)
    }

    pub fn are_connected(&self, from: &ZoneId, to: &ZoneId) -> bool {
        if from == to {
            return true;
        }
        if let Some(zone) = self.zones.get(from) {
            zone.connected_zones.contains(to)
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zone_connectivity() {
        let mut topo = SceneTopology::default();
        let z1 = TacticalZone {
            id: ZoneId("hall".to_string()),
            title: "Grand Hall".to_string(),
            description: "Vestibule sombre".to_string(),
            connected_zones: vec![ZoneId("courtyard".to_string())],
            tags: vec![TacticalTag {
                name: "Pénombre".to_string(),
                modifier_type: "darkness".to_string(),
                value: -2,
            }],
        };

        let z2 = TacticalZone {
            id: ZoneId("courtyard".to_string()),
            title: "Cour Intérieure".to_string(),
            description: "Espace à ciel ouvert".to_string(),
            connected_zones: vec![ZoneId("hall".to_string())],
            tags: vec![],
        };

        topo.add_zone(z1);
        topo.add_zone(z2);

        assert!(topo.are_connected(&ZoneId("hall".to_string()), &ZoneId("courtyard".to_string())));
        assert!(!topo.are_connected(&ZoneId("hall".to_string()), &ZoneId("dungeon".to_string())));
    }
}

