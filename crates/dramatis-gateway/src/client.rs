use reqwest::Client;
use serde_json::{json, Value};
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
    #[error("Schema validation failed: missing required field '{0}'")]
    SchemaValidation(String),
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
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            strict_local,
        }
    }

    pub async fn complete_chat(
        &self,
        profile: &ModelProfile,
        messages: &[ChatMessage],
        json_schema: Option<Value>,
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
            "keep_alive": "15m",
            "stream": false
        });

        if let Some(schema) = &json_schema {
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

        let res_json: Value = res.json().await?;
        let content = res_json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        if let Some(schema) = &json_schema {
            Self::validate_json_against_schema(&content, schema)?;
        }

        Ok(content)
    }

    /// Executes a chat completion with automatic fallback to a secondary local profile (`LLM-05`)
    pub async fn complete_with_fallback(
        &self,
        primary: &ModelProfile,
        fallback_local: &ModelProfile,
        messages: &[ChatMessage],
        json_schema: Option<Value>,
    ) -> Result<String, GatewayError> {
        match self.complete_chat(primary, messages, json_schema.clone()).await {
            Ok(resp) => Ok(resp),
            Err(GatewayError::PrivacyViolation) => {
                // If strict_local blocked primary cloud profile, immediately use local fallback
                self.complete_chat(fallback_local, messages, json_schema).await
            }
            Err(_) => {
                // Network or API failure on primary -> fallback to local model
                self.complete_chat(fallback_local, messages, json_schema).await
            }
        }
    }

    /// Validates that a JSON string is valid JSON and contains all `required` top-level keys from the schema (`LLM-04`)
    pub fn validate_json_against_schema(raw_json: &str, schema: &Value) -> Result<Value, GatewayError> {
        let parsed: Value = serde_json::from_str(raw_json)?;
        if let Some(required_arr) = schema.get("required").and_then(|r| r.as_array()) {
            for req_key in required_arr {
                if let Some(k) = req_key.as_str() {
                    if parsed.get(k).is_none() {
                        return Err(GatewayError::SchemaValidation(k.to_string()));
                    }
                }
            }
        }
        Ok(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_schema_validation_enforces_required_fields() {
        let schema = json!({
            "type": "object",
            "required": ["verdict", "citations"]
        });

        let valid_payload = r#"{"verdict": "Aura de niveau 5", "citations": ["Ars.pdf, p. 42"]}"#;
        assert!(SouffleurClient::validate_json_against_schema(valid_payload, &schema).is_ok());

        let invalid_payload = r#"{"verdict": "Aura de niveau 5"}"#;
        let err = SouffleurClient::validate_json_against_schema(invalid_payload, &schema);
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn test_strict_local_blocks_cloud_profile() {
        let client = SouffleurClient::new(true);
        let cloud_profile = ModelProfile {
            model_name: "gpt-4o".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: Some("sk-test".to_string()),
            max_tokens: 512,
            context_window: 8192,
            temperature: 0.2,
            is_local: false,
        };

        let res = client.complete_chat(&cloud_profile, &[], None).await;
        assert!(matches!(res, Err(GatewayError::PrivacyViolation)));
    }
}
