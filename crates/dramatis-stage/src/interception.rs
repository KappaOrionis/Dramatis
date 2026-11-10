use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InterceptionType {
    EavesdropWhisper, // Perception check against a whisper
    MatrixSnoop,      // Electronic sniffing on #net-commlink
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterceptionHook {
    pub listener_actor_id: String,
    pub hook_type: InterceptionType,
    pub perception_skill_rating: i64,
    pub stealth_or_encryption_threshold: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterceptionVerdict {
    pub intercepted: bool,
    pub listener_id: String,
    pub captured_content: Option<String>,
    pub explanation: String,
}

pub struct DeterministicInterceptionEngine;

impl DeterministicInterceptionEngine {
    /// Determines whether a private message is intercepted by an eavesdropper or hacker
    pub fn evaluate_interception(
        hook: &InterceptionHook,
        message_content: &str,
    ) -> InterceptionVerdict {
        let success = hook.perception_skill_rating >= hook.stealth_or_encryption_threshold;

        if success {
            InterceptionVerdict {
                intercepted: true,
                listener_id: hook.listener_actor_id.clone(),
                captured_content: Some(message_content.to_string()),
                explanation: format!(
                    "Interception réussie par `{}` (Score {} vs Seuil {}).",
                    hook.listener_actor_id, hook.perception_skill_rating, hook.stealth_or_encryption_threshold
                ),
            }
        } else {
            InterceptionVerdict {
                intercepted: false,
                listener_id: hook.listener_actor_id.clone(),
                captured_content: None,
                explanation: format!(
                    "Échec de l'interception par `{}` (Score {} < Seuil {}).",
                    hook.listener_actor_id, hook.perception_skill_rating, hook.stealth_or_encryption_threshold
                ),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eavesdrop_success() {
        let hook = InterceptionHook {
            listener_actor_id: "rogue_in_shadows".to_string(),
            hook_type: InterceptionType::EavesdropWhisper,
            perception_skill_rating: 14,
            stealth_or_encryption_threshold: 12,
        };

        let verdict = DeterministicInterceptionEngine::evaluate_interception(
            &hook,
            "Rendez-vous minuit derrière le vieux chêne.",
        );

        assert!(verdict.intercepted);
        assert_eq!(
            verdict.captured_content,
            Some("Rendez-vous minuit derrière le vieux chêne.".to_string())
        );
    }

    #[test]
    fn test_matrix_snoop_failure() {
        let hook = InterceptionHook {
            listener_actor_id: "deck_script_kiddie".to_string(),
            hook_type: InterceptionType::MatrixSnoop,
            perception_skill_rating: 8,
            stealth_or_encryption_threshold: 15,
        };

        let verdict = DeterministicInterceptionEngine::evaluate_interception(
            &hook,
            "Transfert de 50 000 ¥ sur compte secret.",
        );

        assert!(!verdict.intercepted);
        assert!(verdict.captured_content.is_none());
    }
}
