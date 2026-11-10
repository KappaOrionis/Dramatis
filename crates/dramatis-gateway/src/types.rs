use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProfile {
    pub model_name: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub max_tokens: usize,
    pub context_window: usize,
    pub temperature: f32,
    pub is_local: bool,
}

impl Default for ModelProfile {
    fn default() -> Self {
        Self {
            model_name: "default-local-model".to_string(),
            base_url: "http://localhost:1234/v1".to_string(),
            api_key: None,
            max_tokens: 1024,
            context_window: 8192,
            temperature: 0.7,
            is_local: true,
        }
    }
}

