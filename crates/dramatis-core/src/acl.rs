use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Gm,
    Player,
    Spectator,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanonLevel {
    Official,
    Homebrew,
    CampaignFact,
    CampaignRumor {
        session_id: String,
        speaker: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    GmOnly,
    Public,
    DiscoveredBy(Vec<String>),
}

impl Visibility {
    pub fn is_visible_to(&self, role: Role, actor_id: Option<&str>) -> bool {
        match (self, role) {
            (_, Role::Gm) => true,
            (Visibility::Public, _) => true,
            (Visibility::GmOnly, _) => false,
            (Visibility::DiscoveredBy(allowed), Role::Player) => {
                if let Some(id) = actor_id {
                    allowed.iter().any(|a| a == id)
                } else {
                    false
                }
            }
            (Visibility::DiscoveredBy(_), Role::Spectator) => false,
        }
    }
}

