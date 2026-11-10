use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeHookDefinition {
    pub hook_id: String,
    pub trigger_event: String, // "round", "season", "year"
    pub rhai_script: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChronosConfig {
    pub calendar_type: String,
    pub current_timestamp_seconds: i64,
    pub current_season: Option<String>,
    pub current_year: Option<i32>,
    pub round_duration_seconds: u32,
    #[serde(default)]
    pub time_hooks: Vec<TimeHookDefinition>,
}

impl Default for ChronosConfig {
    fn default() -> Self {
        Self {
            calendar_type: "standard".to_string(),
            current_timestamp_seconds: 0,
            current_season: Some("Spring".to_string()),
            current_year: Some(1220),
            round_duration_seconds: 3,
            time_hooks: Vec::new(),
        }
    }
}

impl ChronosConfig {
    pub fn advance_seconds(&mut self, seconds: i64) {
        self.current_timestamp_seconds += seconds;
    }

    pub fn advance_rounds(&mut self, rounds: u32) {
        self.advance_seconds((rounds * self.round_duration_seconds) as i64);
    }

    /// Advances the Hermetic / Campaign season (`Spring` -> `Summer` -> `Autumn` -> `Winter` -> `Spring` + 1 year) (`MAC-06`)
    pub fn advance_season(&mut self) -> (String, i32) {
        let next_season = match self.current_season.as_deref() {
            Some("Spring") => "Summer",
            Some("Summer") => "Autumn",
            Some("Autumn") => "Winter",
            Some("Winter") => {
                self.current_year = Some(self.current_year.unwrap_or(1220) + 1);
                "Spring"
            }
            _ => "Spring",
        };
        self.current_season = Some(next_season.to_string());
        self.advance_seconds(90 * 86_400); // ~90 days
        (next_season.to_string(), self.current_year.unwrap_or(1220))
    }
}
