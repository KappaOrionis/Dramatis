use serde::{Deserialize, Serialize};
use crate::fog::RealityPlane;
use crate::topology::ZoneId;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChannelType {
    PublicZone(ZoneId),
    WhisperGm(String), // actor_id
    Parley(String, String), // actor_a, actor_b
    NetNetwork(String), // "commlink", "telepathy", etc.
    OocLounge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageMessage {
    pub message_id: String,
    pub channel: ChannelType,
    pub sender_id: String,
    pub sender_name: String,
    pub content: String,
    pub plane: RealityPlane,
    pub timestamp_epoch_ms: i64,
    pub is_gm_only: bool,
}

pub struct StageChannelRouter;

impl StageChannelRouter {
    pub fn is_recipient_allowed(
        channel: &ChannelType,
        recipient_id: &str,
        is_gm: bool,
    ) -> bool {
        if is_gm {
            return true;
        }

        match channel {
            ChannelType::PublicZone(_) => true,
            ChannelType::OocLounge => true,
            ChannelType::WhisperGm(actor) => actor == recipient_id,
            ChannelType::Parley(a, b) => a == recipient_id || b == recipient_id,
            ChannelType::NetNetwork(_) => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stage_channel_permissions() {
        let whisper = ChannelType::WhisperGm("player_bob".to_string());
        assert!(StageChannelRouter::is_recipient_allowed(&whisper, "player_bob", false));
        assert!(!StageChannelRouter::is_recipient_allowed(&whisper, "player_alice", false));
        assert!(StageChannelRouter::is_recipient_allowed(&whisper, "player_alice", true)); // MJ voit tout

        let parley = ChannelType::Parley("bob".to_string(), "alice".to_string());
        assert!(StageChannelRouter::is_recipient_allowed(&parley, "bob", false));
        assert!(StageChannelRouter::is_recipient_allowed(&parley, "alice", false));
        assert!(!StageChannelRouter::is_recipient_allowed(&parley, "eve", false));
    }
}

