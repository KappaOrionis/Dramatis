use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChronosConfig {
    pub calendar_type: String,
    pub current_timestamp_seconds: i64,
    pub current_season: Option<String>,
    pub current_year: Option<i32>,
    pub round_duration_seconds: u32,
}

impl Default for ChronosConfig {
    fn default() -> Self {
        Self {
            calendar_type: "standard".to_string(),
            current_timestamp_seconds: 0,
            current_season: None,
            current_year: Some(1),
            round_duration_seconds: 3,
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
}

