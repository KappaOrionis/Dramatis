use reqwest::Client;
use serde_json::json;
use thiserror::Error;

use crate::budgeter::ContextBudgeter;
use crate::types::{ChatMessage, ModelProfile};

#[derive(Error, Debug)]
pub enum GatewayError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Local privacy violation: cannot make external call under strict local mode")]
    PrivacyViolation,
    #[error("API error ({status}): {body}")]
    Api { status: u16, body: String },
}

pub struct SouffleurClient {
    client: Client,
    strict_local: bool,
}

impl SouffleurClient {
    pub fn new(strict_local: bool) -> Self {
        Self {
            client: Client::builder().build().unwrap_or_default(),
            strict_local,
        }
    }

    pub async fn complete_chat(
        &self,
        profile: &ModelProfile,
        messages: &[ChatMessage],
        json_schema: Option<serde_json::Value>,
    ) -> Result<String, GatewayError> {
        if self.strict_local && !profile.is_local {
            return Err(GatewayError::PrivacyViolation);
        }

        let budgeter = ContextBudgeter::new(profile.context_window, profile.max_tokens);
        let pruned_messages = budgeter.prune_messages(messages);

        let url = format!("{}/chat/completions", profile.base_url.trim_end_matches('/'));

        let mut body = json!({
            "model": profile.model_name,
            "messages": pruned_messages,
            "max_tokens": profile.max_tokens,
            "temperature": profile.temperature,
            "stream": false
        });

        if let Some(schema) = json_schema {
            body["response_format"] = json!({
                "type": "json_object",
                "schema": schema
            });
        }

        let mut req = self.client.post(&url).json(&body);
        if let Some(key) = &profile.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(GatewayError::Api {
                status: status.as_u16(),
                body,
            });
        }

        let res_json: serde_json::Value = res.json().await?;
        let content = res_json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        Ok(content)
    }
}
