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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRoutingMatrix {
    pub archivist: ModelProfile,
    pub scribe: ModelProfile,
    pub arbiter: ModelProfile,
    pub steward: ModelProfile,
    pub playwright: ModelProfile,
    pub director: ModelProfile,
    pub actor: ModelProfile,
    pub vlm: Option<ModelProfile>,
    pub embeddings: Option<ModelProfile>,
}

impl Default for AgentRoutingMatrix {
    fn default() -> Self {
        let base_local = ModelProfile::default();
        Self {
            archivist: base_local.clone(),
            scribe: base_local.clone(),
            arbiter: base_local.clone(),
            steward: base_local.clone(),
            playwright: base_local.clone(),
            director: base_local.clone(),
            actor: base_local.clone(),
            vlm: None,
            embeddings: None,
        }
    }
}

