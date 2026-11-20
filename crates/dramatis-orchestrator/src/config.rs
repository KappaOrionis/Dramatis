use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use dramatis_core::TheaterManifest;
use dramatis_gateway::ModelProfile;

use crate::error::OrchestratorError;

/// Canonical identifiers for the 7 specialized harness agents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AgentId {
    #[serde(rename = "dramatis.archivist")]
    Archivist,
    #[serde(rename = "dramatis.scribe")]
    Scribe,
    #[serde(rename = "dramatis.arbiter")]
    Arbiter,
    #[serde(rename = "dramatis.steward")]
    Steward,
    #[serde(rename = "dramatis.playwright")]
    Playwright,
    #[serde(rename = "dramatis.director")]
    Director,
    #[serde(rename = "dramatis.actor")]
    Actor,
    #[serde(rename = "dramatis.ingester")]
    Ingester,
}

impl AgentId {
    /// Returns the full dotted identifier (`dramatis.<agent>`).
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentId::Archivist => "dramatis.archivist",
            AgentId::Scribe => "dramatis.scribe",
            AgentId::Arbiter => "dramatis.arbiter",
            AgentId::Steward => "dramatis.steward",
            AgentId::Playwright => "dramatis.playwright",
            AgentId::Director => "dramatis.director",
            AgentId::Actor => "dramatis.actor",
            AgentId::Ingester => "dramatis.ingester",
        }
    }

    /// Returns the short roster key used in routing tables and filenames.
    pub fn short_key(&self) -> &'static str {
        match self {
            AgentId::Archivist => "archivist",
            AgentId::Scribe => "scribe",
            AgentId::Arbiter => "arbiter",
            AgentId::Steward => "steward",
            AgentId::Playwright => "playwright",
            AgentId::Director => "director",
            AgentId::Actor => "actor",
            AgentId::Ingester => "ingester",
        }
    }

    /// Returns the corresponding workflow code (`WF-01`..`WF-08`).
    pub fn workflow_id(&self) -> &'static str {
        match self {
            AgentId::Archivist => "WF-01",
            AgentId::Scribe => "WF-02",
            AgentId::Arbiter => "WF-03",
            AgentId::Steward => "WF-04",
            AgentId::Playwright => "WF-05",
            AgentId::Director => "WF-06",
            AgentId::Actor => "WF-07",
            AgentId::Ingester => "WF-08",
        }
    }

    /// Lists all 8 harness agents in canonical workflow order.
    pub fn all() -> [AgentId; 8] {
        [
            AgentId::Archivist,
            AgentId::Scribe,
            AgentId::Arbiter,
            AgentId::Steward,
            AgentId::Playwright,
            AgentId::Director,
            AgentId::Actor,
            AgentId::Ingester,
        ]
    }

    /// Parses either `dramatis.archivist`, `archivist`, or `WF-01` into an `AgentId`.
    pub fn parse(raw: &str) -> Result<Self, OrchestratorError> {
        let normalized = raw.trim().to_ascii_lowercase();
        match normalized.as_str() {
            "dramatis.archivist" | "archivist" | "wf-01" | "wf01" => Ok(AgentId::Archivist),
            "dramatis.scribe" | "scribe" | "wf-02" | "wf02" => Ok(AgentId::Scribe),
            "dramatis.arbiter" | "arbiter" | "wf-03" | "wf03" => Ok(AgentId::Arbiter),
            "dramatis.steward" | "steward" | "wf-04" | "wf04" => Ok(AgentId::Steward),
            "dramatis.playwright" | "playwright" | "wf-05" | "wf05" => Ok(AgentId::Playwright),
            "dramatis.director" | "director" | "wf-06" | "wf06" => Ok(AgentId::Director),
            "dramatis.actor" | "actor" | "wf-07" | "wf07" => Ok(AgentId::Actor),
            "dramatis.ingester" | "ingester" | "wf-08" | "wf08" => Ok(AgentId::Ingester),
            _ => Err(OrchestratorError::UnknownAgent(raw.to_string())),
        }
    }

    /// Parses a workflow code (`WF-01`..`WF-07` or agent name) into its owning `AgentId`.
    pub fn parse_workflow(raw: &str) -> Result<Self, OrchestratorError> {
        Self::parse(raw).map_err(|_| OrchestratorError::UnknownWorkflow(raw.to_string()))
    }
}

/// Output grammar enforcement mode for LLM decoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StructuredOutputMode {
    None,
    #[default]
    JsonSchema,
    Gbnf,
}

/// Grammar constraint settings attached to a model configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct StructuredOutputConfig {
    pub mode: StructuredOutputMode,
    pub schema_ref: Option<String>,
}

impl Default for StructuredOutputConfig {
    fn default() -> Self {
        Self {
            mode: StructuredOutputMode::JsonSchema,
            schema_ref: None,
        }
    }
}

/// Response language enforcement policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum LanguagePolicy {
    #[default]
    MatchUserQuery,
    ForceFr,
    ForceEn,
}

/// Privacy enforcement policy for outgoing LLM calls.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PrivacyOverride {
    #[default]
    InheritTheater,
    StrictLocal,
    Hybrid,
}

/// Strictness profile for Gates G1-G3.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ValidationProfile {
    #[default]
    StrictCanon,
    Standard,
    Permissive,
}

/// Gate G4 Human-in-the-Loop (HITL) execution mode for mutating workflows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum HitlMode {
    Auto,
    #[default]
    ApprovalRequired,
}

/// Global endpoint & credential settings for a single LLM provider.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct ProviderEndpointConfig {
    pub base_url: String,
    pub api_key: Option<String>,
}

/// Workspace-wide LLM provider settings shared across all 7 agents and all theaters.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GlobalProvidersConfig {
    pub local_lmstudio: ProviderEndpointConfig,
    pub gemini: ProviderEndpointConfig,
    pub openrouter: ProviderEndpointConfig,
}

impl Default for GlobalProvidersConfig {
    fn default() -> Self {
        Self {
            local_lmstudio: ProviderEndpointConfig {
                base_url: "http://127.0.0.1:1234/v1".to_string(),
                api_key: None,
            },
            gemini: ProviderEndpointConfig {
                base_url: "https://generativelanguage.googleapis.com/v1beta/openai".to_string(),
                api_key: None,
            },
            openrouter: ProviderEndpointConfig {
                base_url: "https://openrouter.ai/api/v1".to_string(),
                api_key: None,
            },
        }
    }
}

/// Model provider & sampling configuration for an agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ModelConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model_id: String,
    pub fallback_model_id: String,
    pub temperature: f32,
    pub max_tokens: usize,
    pub context_window: usize,
    pub structured_output: StructuredOutputConfig,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            provider: "local_lmstudio".to_string(),
            base_url: "http://127.0.0.1:1234/v1".to_string(),
            api_key: None,
            model_id: "mistral-small-3.2-24b-instruct-2506".to_string(),
            fallback_model_id: "mistral-small-3.2-24b-instruct-2506".to_string(),
            temperature: 0.2,
            max_tokens: 1024,
            context_window: 8192,
            structured_output: StructuredOutputConfig::default(),
        }
    }
}

impl ModelConfig {
    /// Returns true if the configured provider / endpoint targets local inference.
    pub fn is_local(&self) -> bool {
        let prov = self.provider.to_ascii_lowercase();
        if matches!(
            prov.as_str(),
            "local_lmstudio" | "ollama" | "llamacpp" | "local"
        ) {
            return true;
        }
        let lower_url = self.base_url.to_ascii_lowercase();
        lower_url.contains("127.0.0.1") || lower_url.contains("localhost")
    }

    /// Applies workspace-wide provider endpoint and API key defaults for the selected provider,
    /// overriding stale per-agent keys left over from a previous provider selection.
    pub fn apply_global_provider_defaults(&mut self, globals: &GlobalProvidersConfig) {
        let prov = self.provider.trim().to_ascii_lowercase();
        let entry = match prov.as_str() {
            "local_lmstudio" | "local" => &globals.local_lmstudio,
            "gemini" => &globals.gemini,
            "openrouter" => &globals.openrouter,
            _ => return,
        };
        if !entry.base_url.trim().is_empty() {
            self.base_url = entry.base_url.trim().to_string();
        }
        if matches!(prov.as_str(), "local_lmstudio" | "local") {
            self.api_key = None;
            return;
        }
        if let Some(global_key) = entry
            .api_key
            .as_ref()
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
        {
            self.api_key = Some(global_key);
        }
    }

    /// Converts this agent model configuration into a `dramatis_gateway::ModelProfile`.
    pub fn to_model_profile(&self, resolved_model: Option<String>) -> ModelProfile {
        let prov = self.provider.trim().to_ascii_lowercase();
        let raw_url = self.base_url.trim().trim_end_matches('/');

        let normalized_base_url = match prov.as_str() {
            "gemini" => {
                if raw_url.is_empty() {
                    "https://generativelanguage.googleapis.com/v1beta/openai".to_string()
                } else if raw_url.ends_with("/v1beta") {
                    format!("{}/openai", raw_url)
                } else {
                    raw_url.to_string()
                }
            }
            "openrouter" => {
                if raw_url.is_empty() {
                    "https://openrouter.ai/api/v1".to_string()
                } else {
                    raw_url.to_string()
                }
            }
            _ => {
                if raw_url.is_empty() {
                    "http://127.0.0.1:1234/v1".to_string()
                } else {
                    raw_url.to_string()
                }
            }
        };

        let resolved_api_key = self
            .api_key
            .as_ref()
            .map(|k| k.trim().to_string())
            .filter(|k| !k.is_empty())
            .or_else(|| match prov.as_str() {
                "gemini" => std::env::var("GEMINI_API_KEY").ok(),
                "openrouter" => std::env::var("OPENROUTER_API_KEY").ok(),
                _ => None,
            });

        ModelProfile {
            model_name: resolved_model.unwrap_or_else(|| self.model_id.clone()),
            base_url: normalized_base_url,
            api_key: resolved_api_key,
            max_tokens: self.max_tokens,
            context_window: self.context_window,
            temperature: self.temperature,
            is_local: self.is_local(),
        }
    }

    /// Resolves `fallback_model_id` against local LM Studio when primary is cloud and the fallback
    /// model identifier does not belong to a cloud vendor prefix.
    pub fn to_fallback_model_profile(&self, local_base_url: Option<&str>) -> ModelProfile {
        let fallback_name = self.fallback_model_id.trim();
        let lower = fallback_name.to_ascii_lowercase();
        let is_cloud_vendor_model = lower.starts_with("gemini-")
            || lower.starts_with("models/gemini")
            || lower.starts_with("claude-")
            || lower.starts_with("gpt-")
            || lower.starts_with("o1-")
            || lower.starts_with("o3-")
            || lower.starts_with("deepseek/")
            || lower.starts_with("anthropic/")
            || lower.starts_with("openai/")
            || lower.starts_with("google/")
            || lower.starts_with("meta-llama/")
            || lower.starts_with("mistralai/");

        if !self.is_local() && !fallback_name.is_empty() && !is_cloud_vendor_model {
            let base_url = local_base_url
                .map(|u| u.trim().trim_end_matches('/'))
                .filter(|u| !u.is_empty())
                .unwrap_or("http://127.0.0.1:1234/v1")
                .to_string();
            return ModelProfile {
                model_name: fallback_name.to_string(),
                base_url,
                api_key: None,
                max_tokens: self.max_tokens,
                context_window: self.context_window,
                temperature: self.temperature,
                is_local: true,
            };
        }

        self.to_model_profile(Some(fallback_name.to_string()))
    }
}

/// Customizable prompt template and directive overrides.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PromptsConfig {
    pub system_template: String,
    pub language_policy: LanguagePolicy,
    pub custom_instructions: String,
}

impl Default for PromptsConfig {
    fn default() -> Self {
        Self {
            system_template: String::new(),
            language_policy: LanguagePolicy::MatchUserQuery,
            custom_instructions: String::new(),
        }
    }
}

impl PromptsConfig {
    /// Renders `system_template` by substituting `{{key}}` placeholders and appending `custom_instructions`.
    pub fn render_system_prompt(&self, vars: &HashMap<String, String>) -> String {
        let mut rendered = self.system_template.clone();
        for (k, v) in vars {
            let needle = format!("{{{{{}}}}}", k);
            rendered = rendered.replace(&needle, v);
        }
        if !self.custom_instructions.trim().is_empty() {
            rendered.push_str("\n\nInstructions personnalisées du Maître de Jeu :\n");
            rendered.push_str(self.custom_instructions.trim());
        }
        rendered
    }
}

/// Scoped MCP tool allowlist / denylist.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ToolsConfig {
    pub allowed: Vec<String>,
    pub denied: Vec<String>,
}

/// Safety, privacy, timeout and validation guardrails for an agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GuardrailsConfig {
    pub privacy_mode: PrivacyOverride,
    pub max_tool_calls: usize,
    pub timeout_ms: u64,
    pub validation_profile: ValidationProfile,
    pub hitl_mode: HitlMode,
}

impl Default for GuardrailsConfig {
    fn default() -> Self {
        Self {
            privacy_mode: PrivacyOverride::InheritTheater,
            max_tool_calls: 6,
            timeout_ms: 45_000,
            validation_profile: ValidationProfile::StrictCanon,
            hitl_mode: HitlMode::Auto,
        }
    }
}

/// Full declarative manifest for one of the 7 harness agents.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AgentConfig {
    pub id: String,
    pub workflow_id: String,
    pub display_name: String,
    pub pole: String,
    pub role_description: String,
    pub write_scope: String,
    pub version: String,
    pub enabled: bool,
    pub model: ModelConfig,
    pub prompts: PromptsConfig,
    pub tools: ToolsConfig,
    pub guardrails: GuardrailsConfig,
    pub workflow_params: serde_json::Map<String, serde_json::Value>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            id: "dramatis.archivist".to_string(),
            workflow_id: "WF-01".to_string(),
            display_name: "L'Archiviste".to_string(),
            pole: "Régie".to_string(),
            role_description: String::new(),
            write_scope: "Lecture seule".to_string(),
            version: "2.1".to_string(),
            enabled: true,
            model: ModelConfig::default(),
            prompts: PromptsConfig::default(),
            tools: ToolsConfig::default(),
            guardrails: GuardrailsConfig::default(),
            workflow_params: serde_json::Map::new(),
        }
    }
}

impl AgentConfig {
    /// Checks whether the given theater privacy setting and agent guardrail allow outbound cloud calls.
    pub fn effective_strict_local(&self, theater_privacy: Option<&str>) -> bool {
        match self.guardrails.privacy_mode {
            PrivacyOverride::StrictLocal => true,
            PrivacyOverride::Hybrid => false,
            PrivacyOverride::InheritTheater => {
                theater_privacy.unwrap_or("strict_local") == "strict_local"
            }
        }
    }
}

/// Configuration for a single step inside a workflow pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WorkflowStepConfig {
    pub step_id: String,
    pub name: String,
    pub enabled: bool,
    pub params: serde_json::Value,
}

impl Default for WorkflowStepConfig {
    fn default() -> Self {
        Self {
            step_id: String::new(),
            name: String::new(),
            enabled: true,
            params: json!({}),
        }
    }
}

/// Declarative workflow graph manifest (`WF-01`..`WF-07`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WorkflowConfig {
    pub workflow_id: String,
    pub agent_id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub steps: Vec<WorkflowStepConfig>,
    pub hitl_mode: Option<HitlMode>,
    pub max_retries: usize,
}

impl Default for WorkflowConfig {
    fn default() -> Self {
        Self {
            workflow_id: "WF-01".to_string(),
            agent_id: "dramatis.archivist".to_string(),
            name: "Recherche Canonique".to_string(),
            description: String::new(),
            enabled: true,
            steps: Vec::new(),
            hitl_mode: None,
            max_retries: 2,
        }
    }
}

impl WorkflowConfig {
    /// Checks whether a specific step ID is currently enabled in this workflow.
    pub fn is_step_enabled(&self, step_id: &str) -> bool {
        self.steps
            .iter()
            .find(|s| s.step_id == step_id)
            .map(|s| s.enabled)
            .unwrap_or(true)
    }
}

/// API-friendly resolved agent payload including YAML serialization and override status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedAgentInfo {
    pub config: AgentConfig,
    pub has_theater_override: bool,
    pub config_path: String,
    pub yaml: String,
}

/// API-friendly resolved workflow payload including override status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedWorkflowInfo {
    pub config: WorkflowConfig,
    pub has_theater_override: bool,
    pub config_path: String,
}

/// Deep-merges `overlay` onto `base`. Objects merge recursively by key; primitives and arrays replace.
pub fn merge_json_values(base: &mut serde_json::Value, overlay: &serde_json::Value) {
    match (base, overlay) {
        (serde_json::Value::Object(base_map), serde_json::Value::Object(overlay_map)) => {
            for (k, v) in overlay_map {
                match base_map.get_mut(k) {
                    Some(existing) => merge_json_values(existing, v),
                    None => {
                        base_map.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        (base_slot, overlay_val) => {
            *base_slot = overlay_val.clone();
        }
    }
}

/// Resolves and persists hierarchical agent & workflow configurations per Theater.
pub struct ConfigRegistry;

impl ConfigRegistry {
    /// Returns the path to the workspace-wide `.dramatis_providers.yaml` file.
    pub fn global_providers_path(workspaces_root: &Path) -> PathBuf {
        workspaces_root.join(".dramatis_providers.yaml")
    }

    /// Loads global LLM provider settings (LM Studio, Gemini, OpenRouter), falling back to defaults.
    pub fn load_global_providers(workspaces_root: &Path) -> GlobalProvidersConfig {
        let path = Self::global_providers_path(workspaces_root);
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(parsed) = serde_yaml::from_str::<GlobalProvidersConfig>(&content) {
                return parsed;
            }
        }
        GlobalProvidersConfig::default()
    }

    /// Persists global LLM provider settings to `.dramatis_providers.yaml`.
    pub fn save_global_providers(
        workspaces_root: &Path,
        cfg: &GlobalProvidersConfig,
    ) -> Result<GlobalProvidersConfig, OrchestratorError> {
        std::fs::create_dir_all(workspaces_root)?;
        let yaml = serde_yaml::to_string(cfg)?;
        std::fs::write(Self::global_providers_path(workspaces_root), yaml)?;
        Ok(cfg.clone())
    }

    /// Ensures `00_config/{agents,workflows,evals}` exist inside the given theater root.
    pub fn ensure_config_dirs(theater_root: &Path) -> Result<(), OrchestratorError> {
        std::fs::create_dir_all(Self::agents_dir(theater_root))?;
        std::fs::create_dir_all(Self::workflows_dir(theater_root))?;
        std::fs::create_dir_all(Self::evals_dir(theater_root))?;
        Ok(())
    }

    pub fn agents_dir(theater_root: &Path) -> PathBuf {
        theater_root.join("00_config").join("agents")
    }

    pub fn workflows_dir(theater_root: &Path) -> PathBuf {
        theater_root.join("00_config").join("workflows")
    }

    pub fn evals_dir(theater_root: &Path) -> PathBuf {
        theater_root.join("00_config").join("evals")
    }

    pub fn agent_config_path(theater_root: &Path, agent: AgentId) -> PathBuf {
        Self::agents_dir(theater_root).join(format!("{}.yaml", agent.short_key()))
    }

    pub fn workflow_config_path(theater_root: &Path, agent: AgentId) -> PathBuf {
        Self::workflows_dir(theater_root).join(format!("{}.yaml", agent.workflow_id()))
    }

    /// Resolves an `AgentConfig` across the 4 hierarchy levels:
    /// Built-in Defaults -> System Preset -> Theater YAML (and `theater.yaml` routing) -> Runtime Override.
    pub fn resolve_agent(
        theater_root: &Path,
        manifest: Option<&TheaterManifest>,
        agent: AgentId,
        runtime_override: Option<&serde_json::Value>,
    ) -> Result<ResolvedAgentInfo, OrchestratorError> {
        let mut merged = serde_json::to_value(Self::builtin_agent_default(agent))?;

        // Level 1: System preset overlay
        if let Some(m) = manifest {
            if let Some(preset_overlay) = Self::system_preset_agent_overlay(&m.system_id, agent) {
                merge_json_values(&mut merged, &preset_overlay);
            }
            // Compatibility with legacy `theater.yaml` agent_routing map
            if let Some(routing) = &m.agent_routing {
                if let Some(model_name) = routing.get(agent.short_key()) {
                    if !model_name.trim().is_empty() {
                        merge_json_values(
                            &mut merged,
                            &json!({ "model": { "model_id": model_name } }),
                        );
                    }
                }
            }
        }

        // Level 2: Theater custom YAML
        let yaml_path = Self::agent_config_path(theater_root, agent);
        let has_override = yaml_path.exists();
        if has_override {
            let content = std::fs::read_to_string(&yaml_path)?;
            if !content.trim().is_empty() {
                let yaml_val: serde_json::Value = serde_yaml::from_str(&content)?;
                merge_json_values(&mut merged, &yaml_val);
            }
        }

        // Level 3: Session / runtime override
        if let Some(rt) = runtime_override {
            merge_json_values(&mut merged, rt);
        }

        let mut config: AgentConfig = serde_json::from_value(merged)?;
        if let Some(workspaces_root) = theater_root.parent() {
            let globals = Self::load_global_providers(workspaces_root);
            config.model.apply_global_provider_defaults(&globals);
        }
        let yaml = serde_yaml::to_string(&config)?;
        let rel_path = format!("00_config/agents/{}.yaml", agent.short_key());

        Ok(ResolvedAgentInfo {
            config,
            has_theater_override: has_override,
            config_path: rel_path,
            yaml,
        })
    }

    /// Lists all 7 resolved agents for a theater.
    pub fn list_agents(
        theater_root: &Path,
        manifest: Option<&TheaterManifest>,
    ) -> Result<Vec<ResolvedAgentInfo>, OrchestratorError> {
        let mut list = Vec::with_capacity(7);
        for agent in AgentId::all() {
            list.push(Self::resolve_agent(theater_root, manifest, agent, None)?);
        }
        Ok(list)
    }

    /// Saves a customized `AgentConfig` to `<theater>/00_config/agents/<short_key>.yaml`
    /// and synchronizes `agent_routing` in `theater.yaml` if present.
    pub fn save_agent_config(
        theater_root: &Path,
        agent: AgentId,
        mut config: AgentConfig,
    ) -> Result<ResolvedAgentInfo, OrchestratorError> {
        Self::ensure_config_dirs(theater_root)?;
        config.id = agent.as_str().to_string();
        config.workflow_id = agent.workflow_id().to_string();

        if config.model.model_id.trim().is_empty() {
            return Err(OrchestratorError::InvalidConfig(
                "model.model_id must not be empty".to_string(),
            ));
        }

        let path = Self::agent_config_path(theater_root, agent);
        let yaml = serde_yaml::to_string(&config)?;
        std::fs::write(&path, &yaml)?;

        // Sync model choice into theater.yaml agent_routing for backward compatibility
        let theater_yaml_path = theater_root.join("theater.yaml");
        if theater_yaml_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&theater_yaml_path) {
                if let Ok(mut manifest) = serde_yaml::from_str::<TheaterManifest>(&raw) {
                    let routing = manifest.agent_routing.get_or_insert_with(HashMap::new);
                    routing.insert(agent.short_key().to_string(), config.model.model_id.clone());
                    if let Ok(updated) = serde_yaml::to_string(&manifest) {
                        let _ = std::fs::write(&theater_yaml_path, updated);
                    }
                }
            }
        }

        Ok(ResolvedAgentInfo {
            config,
            has_theater_override: true,
            config_path: format!("00_config/agents/{}.yaml", agent.short_key()),
            yaml,
        })
    }

    /// Removes the custom theater YAML override for an agent so it falls back cleanly to defaults.
    pub fn reset_agent_config(
        theater_root: &Path,
        manifest: Option<&TheaterManifest>,
        agent: AgentId,
    ) -> Result<ResolvedAgentInfo, OrchestratorError> {
        let path = Self::agent_config_path(theater_root, agent);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Self::resolve_agent(theater_root, manifest, agent, None)
    }

    /// Validates and imports a raw YAML string for a specific agent.
    pub fn import_agent_yaml(
        theater_root: &Path,
        agent: AgentId,
        raw_yaml: &str,
    ) -> Result<ResolvedAgentInfo, OrchestratorError> {
        let partial: serde_json::Value = serde_yaml::from_str(raw_yaml)?;
        let mut base = serde_json::to_value(Self::builtin_agent_default(agent))?;
        merge_json_values(&mut base, &partial);
        let config: AgentConfig = serde_json::from_value(base)?;
        Self::save_agent_config(theater_root, agent, config)
    }

    /// Resolves a `WorkflowConfig` across defaults, system preset, theater YAML, and runtime override.
    pub fn resolve_workflow(
        theater_root: &Path,
        agent: AgentId,
        runtime_override: Option<&serde_json::Value>,
    ) -> Result<ResolvedWorkflowInfo, OrchestratorError> {
        let mut merged = serde_json::to_value(Self::builtin_workflow_default(agent))?;

        let yaml_path = Self::workflow_config_path(theater_root, agent);
        let has_override = yaml_path.exists();
        if has_override {
            let content = std::fs::read_to_string(&yaml_path)?;
            if !content.trim().is_empty() {
                let yaml_val: serde_json::Value = serde_yaml::from_str(&content)?;
                merge_json_values(&mut merged, &yaml_val);
            }
        }

        if let Some(rt) = runtime_override {
            merge_json_values(&mut merged, rt);
        }

        let config: WorkflowConfig = serde_json::from_value(merged)?;
        Ok(ResolvedWorkflowInfo {
            config,
            has_theater_override: has_override,
            config_path: format!("00_config/workflows/{}.yaml", agent.workflow_id()),
        })
    }

    /// Lists all 7 resolved workflow graphs for a theater.
    pub fn list_workflows(
        theater_root: &Path,
    ) -> Result<Vec<ResolvedWorkflowInfo>, OrchestratorError> {
        let mut list = Vec::with_capacity(7);
        for agent in AgentId::all() {
            list.push(Self::resolve_workflow(theater_root, agent, None)?);
        }
        Ok(list)
    }

    /// Persists a customized workflow graph manifest into `00_config/workflows/<workflow_id>.yaml`.
    pub fn save_workflow_config(
        theater_root: &Path,
        agent: AgentId,
        mut config: WorkflowConfig,
    ) -> Result<ResolvedWorkflowInfo, OrchestratorError> {
        Self::ensure_config_dirs(theater_root)?;
        config.workflow_id = agent.workflow_id().to_string();
        config.agent_id = agent.as_str().to_string();

        let path = Self::workflow_config_path(theater_root, agent);
        let yaml = serde_yaml::to_string(&config)?;
        std::fs::write(&path, yaml)?;

        Ok(ResolvedWorkflowInfo {
            config,
            has_theater_override: true,
            config_path: format!("00_config/workflows/{}.yaml", agent.workflow_id()),
        })
    }

    /// Deletes the theater workflow YAML override so defaults apply again.
    pub fn reset_workflow_config(
        theater_root: &Path,
        agent: AgentId,
    ) -> Result<ResolvedWorkflowInfo, OrchestratorError> {
        let path = Self::workflow_config_path(theater_root, agent);
        if path.exists() {
            std::fs::remove_file(&path)?;
        }
        Self::resolve_workflow(theater_root, agent, None)
    }

    fn system_preset_agent_overlay(system_id: &str, agent: AgentId) -> Option<serde_json::Value> {
        let lower = system_id.to_ascii_lowercase();
        if lower.contains("ars") || lower.contains("magica") {
            match agent {
                AgentId::Steward => Some(json!({
                    "workflow_params": { "creation_rules_profile": "ars_magica_5e" }
                })),
                AgentId::Arbiter => Some(json!({
                    "workflow_params": { "default_roll_mode": "ars_magica" }
                })),
                _ => None,
            }
        } else if lower.contains("shadowrun") {
            match agent {
                AgentId::Steward => Some(json!({
                    "workflow_params": { "creation_rules_profile": "priorities_A_E" }
                })),
                AgentId::Arbiter => Some(json!({
                    "workflow_params": { "default_roll_mode": "shadowrun" }
                })),
                _ => None,
            }
        } else {
            None
        }
    }

    /// Built-in default manifest for each of the 7 harness agents (Level 0).
    pub fn builtin_agent_default(agent: AgentId) -> AgentConfig {
        match agent {
            AgentId::Archivist => {
                let mut params = serde_json::Map::new();
                params.insert("top_k_chunks".to_string(), json!(4));
                params.insert("silence_threshold".to_string(), json!(1));
                params.insert("rrf_weight_bm25".to_string(), json!(0.5));
                params.insert("rrf_weight_vector".to_string(), json!(0.3));
                params.insert("rrf_weight_graph".to_string(), json!(0.2));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "L'Archiviste".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Chercheur Documentaire Canonique (Recherche Hybride + Graphe)".to_string(),
                    write_scope: "Lecture seule (aucune écriture sur l'univers)".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.15,
                        max_tokens: 1024,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/archivist_verdict.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es L'Archiviste de l'univers {{theater_name}} ({{system_preset}}). Tu réponds STRICTEMENT dans la langue de la question posée ({{language}}) en t'appuyant uniquement sur les extraits canoniques fournis. Cite tes sources avec précision et déclare un silence documentaire si l'information n'est pas attestée.".to_string(),
                        language_policy: LanguagePolicy::MatchUserQuery,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "rag.hybrid_search".to_string(),
                            "rag.section_scanner".to_string(),
                            "graph.query_entities".to_string(),
                        ],
                        denied: vec!["fs.write".to_string(), "machina.mutate_state".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 6,
                        timeout_ms: 45_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::Auto,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Scribe => {
                let mut params = serde_json::Map::new();
                params.insert("dedup_threshold".to_string(), json!(0.90));
                params.insert("auto_wikilink".to_string(), json!(true));
                params.insert("chronicle_tone".to_string(), json!("encyclopedique"));
                params.insert("respect_locked_sections".to_string(), json!(true));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "Le Scribe".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Chroniqueur, Résolveur d'Entités & Auto-Wikilinker".to_string(),
                    write_scope: "/01_wiki/**/*.md, /04_index/knowledge_graph.sqlite".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.2,
                        max_tokens: 1536,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/scribe_proposal.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es Le Scribe de {{theater_name}} ({{system_preset}}). Synthétise les faits en notes Markdown structurées sans jamais altérer les blocs <!-- LOCKED_BY_USER -->.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "rag.entity_resolver".to_string(),
                            "rag.autowikilink".to_string(),
                            "wiki.non_destructive_patch".to_string(),
                        ],
                        denied: vec!["machina.roll".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 6,
                        timeout_ms: 45_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::ApprovalRequired,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Arbiter => {
                let mut params = serde_json::Map::new();
                params.insert("physical_dice_mode".to_string(), json!("off"));
                params.insert("run_monte_carlo".to_string(), json!(false));
                params.insert("monte_carlo_iterations".to_string(), json!(10000));
                params.insert("strict_raw".to_string(), json!(true));
                params.insert("default_roll_mode".to_string(), json!("expression"));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "Le Légiste".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Arbitre Mécanique Déterministe (Rhai + SQLite + Dés)".to_string(),
                    write_scope: "Sandbox Rhai (aucune narration directe)".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.0,
                        max_tokens: 768,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/arbiter_verdict.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es Le Légiste de {{theater_name}} ({{system_preset}}). Convertis les intentions en structures mécaniques strictes. Les mathématiques sont exclusivement exécutées par dramatis-machina.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "machina.dice_engine".to_string(),
                            "machina.rhai_sandbox".to_string(),
                            "machina.sqlite_tables".to_string(),
                            "machina.monte_carlo".to_string(),
                        ],
                        denied: vec!["llm.invent_dice_result".to_string(), "wiki.write".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 4,
                        timeout_ms: 15_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::Auto,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Steward => {
                let mut params = serde_json::Map::new();
                params.insert("creation_rules_profile".to_string(), json!("auto"));
                params.insert("allow_house_rules".to_string(), json!(false));
                params.insert("auto_recalculate_derived_stats".to_string(), json!(true));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "L'Intendant".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Gestionnaire de Personnages, Alliances, Essence & Artisanat".to_string(),
                    write_scope: "/03_personae/*.json, /03_personae/*.md".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.1,
                        max_tokens: 1024,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/steward_audit.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es L'Intendant de {{theater_name}} ({{system_preset}}). Valide chaque création et mutation de personnage avec une précision comptable exacte.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "core.creation_engine".to_string(),
                            "core.artificer_engine".to_string(),
                            "core.persona_store".to_string(),
                        ],
                        denied: vec!["stage.broadcast_public".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 5,
                        timeout_ms: 30_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::ApprovalRequired,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Playwright => {
                let mut params = serde_json::Map::new();
                params.insert("pacing_profile".to_string(), json!("investigation"));
                params.insert("lethality_target".to_string(), json!(15));
                params.insert("clue_redundancy".to_string(), json!(3));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "Le Dramaturge".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Architecte Nodal d'Aventures, Horloges & Équilibrage Tactique".to_string(),
                    write_scope: "/05_plays/*/campaign_manifest.json".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.4,
                        max_tokens: 1536,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/playwright_manifest.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es Le Dramaturge de {{theater_name}} ({{system_preset}}). Conçois des graphes de scènes connexes, des horloges équilibrées et garantis la règle des 3 indices.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "stage.campaign_manifest".to_string(),
                            "machina.monte_carlo".to_string(),
                        ],
                        denied: vec!["persona.mutate".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 6,
                        timeout_ms: 45_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::ApprovalRequired,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Director => {
                let mut params = serde_json::Map::new();
                params.insert("narrative_style".to_string(), json!("sensoriel_sombre"));
                params.insert("max_response_paragraphs".to_string(), json!(3));
                params.insert("tts_enabled".to_string(), json!(false));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "Le Metteur en Scène".to_string(),
                    pole: "Scène".to_string(),
                    role_description: "Narrateur MJ, Cadrage Sensoriel & Mixeur Audio Vox".to_string(),
                    write_scope: "/05_plays/*/session_logs.jsonl".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.65,
                        max_tokens: 1024,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/director_scene.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es Le Metteur en Scène de {{theater_name}} ({{system_preset}}). Traduis fidèlement les verdicts mécaniques du Légiste en narration sensorielle sans jamais divulguer les secrets MJ.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "stage.session_logger".to_string(),
                            "stage.vox_audio".to_string(),
                            "stage.channel_router".to_string(),
                        ],
                        denied: vec!["machina.override_dice".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 4,
                        timeout_ms: 45_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::Auto,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Actor => {
                let mut params = serde_json::Map::new();
                params.insert("autonomy_level".to_string(), json!("reactive"));
                params.insert("verbosity".to_string(), json!("concis"));
                params.insert("emit_mechanical_intent".to_string(), json!(true));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "L'Acteur Bot".to_string(),
                    pole: "Scène".to_string(),
                    role_description: "Incarnation PJ/PNJ sous Brouillard de Guerre Tri-Dimensionnel".to_string(),
                    write_scope: "Mémoire épisodique personnelle & canal de Zone".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.7,
                        max_tokens: 512,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/actor_turn.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es un personnage de {{theater_name}} ({{system_preset}}). Tu ne perçois que ce que ton AgentContextView t'autorise (zone, plan de réalité, secrets connus). Formule tes intentions mécaniques sans jamais lancer les dés toi-même.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "stage.agent_context_view".to_string(),
                            "stage.declare_intent".to_string(),
                        ],
                        denied: vec!["core.gm_secrets".to_string(), "machina.roll".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::InheritTheater,
                        max_tool_calls: 3,
                        timeout_ms: 30_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::Auto,
                    },
                    workflow_params: params,
                }
            }
            AgentId::Ingester => {
                let mut params = serde_json::Map::new();
                params.insert("max_chunk_chars".to_string(), json!(1200));
                params.insert("enable_sha256_dedup".to_string(), json!(true));
                params.insert("auto_transpile_excel_rhai".to_string(), json!(true));

                AgentConfig {
                    id: agent.as_str().to_string(),
                    workflow_id: agent.workflow_id().to_string(),
                    display_name: "L'Ingesteur".to_string(),
                    pole: "Régie".to_string(),
                    role_description: "Pipeline déterministe d'ingestion multi-format (PDF, Markdown, Excel, Médias)".to_string(),
                    write_scope: "/00_sources & /04_index".to_string(),
                    version: "2.1".to_string(),
                    enabled: true,
                    model: ModelConfig {
                        temperature: 0.0,
                        max_tokens: 512,
                        structured_output: StructuredOutputConfig {
                            mode: StructuredOutputMode::JsonSchema,
                            schema_ref: Some("schemas/ingest_report.v1.json".to_string()),
                        },
                        ..ModelConfig::default()
                    },
                    prompts: PromptsConfig {
                        system_template: "Tu es L'Ingesteur déterministe de {{theater_name}}. Tu extrais et indexes chaque type de document sans altérer les sources originales.".to_string(),
                        language_policy: LanguagePolicy::ForceFr,
                        custom_instructions: String::new(),
                    },
                    tools: ToolsConfig {
                        allowed: vec![
                            "ingest.pdf".to_string(),
                            "ingest.markdown".to_string(),
                            "ingest.excel".to_string(),
                            "ingest.media".to_string(),
                            "ingest.sha256".to_string(),
                        ],
                        denied: vec!["core.gm_secrets".to_string()],
                    },
                    guardrails: GuardrailsConfig {
                        privacy_mode: PrivacyOverride::StrictLocal,
                        max_tool_calls: 4,
                        timeout_ms: 30_000,
                        validation_profile: ValidationProfile::StrictCanon,
                        hitl_mode: HitlMode::Auto,
                    },
                    workflow_params: params,
                }
            }
        }
    }

    /// Built-in default step graph for each workflow (`WF-01`..`WF-07`).
    pub fn builtin_workflow_default(agent: AgentId) -> WorkflowConfig {
        let step = |id: &str, name: &str| WorkflowStepConfig {
            step_id: id.to_string(),
            name: name.to_string(),
            enabled: true,
            params: json!({}),
        };

        match agent {
            AgentId::Archivist => WorkflowConfig {
                workflow_id: "WF-01".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Recherche Canonique (Archiviste)".to_string(),
                description: "Analyse linguistique, recherche hybride RRF, garde de silence documentaire, synthèse sourcée et vérification des citations.".to_string(),
                enabled: true,
                steps: vec![
                    step("query_analysis", "Analyse de requête & expansion bilingue"),
                    step("hybrid_retrieval", "Récupération hybride (Tantivy + Graphe + Scanner)"),
                    step("relevance_gate", "Seuil de pertinence & silence documentaire"),
                    step("grounded_synthesis", "Synthèse LLM contrainte par sources"),
                    step("citation_verifier", "Vérification de provenance des citations"),
                ],
                hitl_mode: Some(HitlMode::Auto),
                max_retries: 2,
            },
            AgentId::Scribe => WorkflowConfig {
                workflow_id: "WF-02".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Chronique & Résolution Wiki (Scribe)".to_string(),
                description: "Extraction d'entités, résolution anti-doublon, vérification des verrous utilisateur, auto-wikilinking et proposition de diff.".to_string(),
                enabled: true,
                steps: vec![
                    step("extract_candidates", "Extraction des entités & relations"),
                    step("entity_resolution", "Résolution anti-doublon (knowledge_graph)"),
                    step("lock_check", "Contrôle des verrous <!-- LOCKED_BY_USER -->"),
                    step("auto_wikilink", "Injection Aho-Corasick [[WikiLinks]]"),
                    step("diff_proposal", "Préparation du patch & diff unifié"),
                ],
                hitl_mode: Some(HitlMode::ApprovalRequired),
                max_retries: 1,
            },
            AgentId::Arbiter => WorkflowConfig {
                workflow_id: "WF-03".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Arbitrage Mécanique (Légiste)".to_string(),
                description: "Parsing d'intention, consultation tables.sqlite, exécution sandbox Rhai/dés, simulation Monte-Carlo et verdict immuable.".to_string(),
                enabled: true,
                steps: vec![
                    step("intent_parsing", "Normalisation de l'intention mécanique"),
                    step("rule_lookup", "Consultation des tables mécaniques SQLite"),
                    step("machina_execution", "Exécution déterministe (Dés / Rhai)"),
                    step("monte_carlo_check", "Simulation statistique Monte-Carlo"),
                    step("verdict_formatting", "Formatage du MechanicalResolution"),
                ],
                hitl_mode: Some(HitlMode::Auto),
                max_retries: 1,
            },
            AgentId::Steward => WorkflowConfig {
                workflow_id: "WF-04".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Intendance Personnages & Alliances".to_string(),
                description: "Chargement fiche personnage, génération de mutation, audit mathématique exact (Essence/XP/Blessures) et synchro JSON+MD.".to_string(),
                enabled: true,
                steps: vec![
                    step("load_sheet", "Chargement / initialisation de fiche"),
                    step("proposal_generation", "Calcul de la mutation proposée"),
                    step("deterministic_audit", "Audit mathématique & règles de création"),
                    step("sheet_sync", "Préparation synchro JSON & Markdown"),
                ],
                hitl_mode: Some(HitlMode::ApprovalRequired),
                max_retries: 1,
            },
            AgentId::Playwright => WorkflowConfig {
                workflow_id: "WF-05".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Conception Nodale & Horloges (Dramaturge)".to_string(),
                description: "Lecture état du monde, édition graphe de scènes & horloges, équilibrage Monte-Carlo et validation topologique.".to_string(),
                enabled: true,
                steps: vec![
                    step("world_state_read", "Lecture du manifeste de campagne"),
                    step("node_graph_draft", "Édition des nœuds & horloges de scène"),
                    step("encounter_balancing", "Calibrage de létalité (Monte-Carlo)"),
                    step("manifest_validation", "Vérification de connexité du graphe"),
                ],
                hitl_mode: Some(HitlMode::ApprovalRequired),
                max_retries: 1,
            },
            AgentId::Director => WorkflowConfig {
                workflow_id: "WF-06".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Mise en Scène & Narration Live".to_string(),
                description: "Assemblage contexte de scène, rédaction sensorielle fidèle au verdict, extraction cues audio Vox et contrôle anti-fuite.".to_string(),
                enabled: true,
                steps: vec![
                    step("context_assembly", "Assemblage scène & verdict du Légiste"),
                    step("sensory_drafting", "Rédaction narrative sensorielle"),
                    step("audio_cue_extraction", "Émission d'ambiance audio Vox"),
                    step("leak_check", "Contrôle anti-fuite secrets MJ"),
                ],
                hitl_mode: Some(HitlMode::Auto),
                max_retries: 1,
            },
            AgentId::Actor => WorkflowConfig {
                workflow_id: "WF-07".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Incarnation Acteur Sous Brouillard".to_string(),
                description: "Filtrage AgentContextView (Cognitif/Spatial/Planaire), rappel épisodique, réplique RP et émission d'intention vers Légiste.".to_string(),
                enabled: true,
                steps: vec![
                    step("fog_filter", "Filtrage tri-dimensionnel AgentContextView"),
                    step("episodic_recall", "Lecture mémoire & fiche personnage"),
                    step("in_character_reaction", "Génération réplique & intention"),
                    step("handoff_to_arbiter", "Routage vers WF-03 si intention mécanique"),
                ],
                hitl_mode: Some(HitlMode::Auto),
                max_retries: 1,
            },
            AgentId::Ingester => WorkflowConfig {
                workflow_id: "WF-08".to_string(),
                agent_id: agent.as_str().to_string(),
                name: "Ingestion & Indexation Multi-Format".to_string(),
                description: "Routage par type de document (.pdf, .md/.txt, .xlsx, images/audio), déduplication SHA-256 et extraction déterministe.".to_string(),
                enabled: true,
                steps: vec![
                    step("format_detection", "Détection du format & routage"),
                    step("sha256_dedup", "Contrôle d'empreinte SHA-256"),
                    step("typed_extraction", "Extraction & découpage spécialisé"),
                    step("index_registration", "Enregistrement dans l'index du Théâtre"),
                ],
                hitl_mode: Some(HitlMode::Auto),
                max_retries: 1,
            },
        }
    }
}
