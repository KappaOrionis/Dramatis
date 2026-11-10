use crate::dice::DiceEngine;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonteCarloSummary {
    pub total_iterations: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub critical_count: usize,
    pub success_rate: f64,
    pub critical_rate: f64,
    pub average_score: f64,
    pub distribution: Vec<(i64, usize)>,
}

pub struct MonteCarloSimulator;

impl MonteCarloSimulator {
    pub fn simulate_standard_vs_threshold(
        dice_count: usize,
        dice_sides: u32,
        modifier: i64,
        threshold: i64,
        iterations: usize,
    ) -> MonteCarloSummary {
        let mut successes = 0;
        let mut failures = 0;
        let mut total_score: i64 = 0;
        let mut freq_map = std::collections::BTreeMap::<i64, usize>::new();

        for _ in 0..iterations {
            let roll = DiceEngine::roll_standard(dice_count, dice_sides, modifier);
            let score = roll.total;
            total_score += score;
            *freq_map.entry(score).or_insert(0) += 1;

            if score >= threshold {
                successes += 1;
            } else {
                failures += 1;
            }
        }

        let distribution = freq_map.into_iter().collect();

        MonteCarloSummary {
            total_iterations: iterations,
            success_count: successes,
            failure_count: failures,
            critical_count: 0,
            success_rate: (successes as f64) / (iterations as f64),
            critical_rate: 0.0,
            average_score: (total_score as f64) / (iterations as f64),
            distribution,
        }
    }

    pub fn simulate_shadowrun_hits(
        pool_size: usize,
        threshold_hits: usize,
        iterations: usize,
    ) -> MonteCarloSummary {
        let mut successes = 0;
        let mut failures = 0;
        let mut glitches = 0;
        let mut total_hits: usize = 0;
        let mut freq_map = std::collections::BTreeMap::<i64, usize>::new();

        for _ in 0..iterations {
            let res = DiceEngine::roll_shadowrun(pool_size);
            total_hits += res.hits;
            *freq_map.entry(res.hits as i64).or_insert(0) += 1;

            if res.is_glitch || res.is_critical_glitch {
                glitches += 1;
            }

            if res.hits >= threshold_hits {
                successes += 1;
            } else {
                failures += 1;
            }
        }

        let distribution = freq_map.into_iter().collect();

        MonteCarloSummary {
            total_iterations: iterations,
            success_count: successes,
            failure_count: failures,
            critical_count: glitches,
            success_rate: (successes as f64) / (iterations as f64),
            critical_rate: (glitches as f64) / (iterations as f64),
            average_score: (total_hits as f64) / (iterations as f64),
            distribution,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_monte_carlo_standard() {
        let summary = MonteCarloSimulator::simulate_standard_vs_threshold(1, 20, 0, 11, 1_000);
        assert_eq!(summary.total_iterations, 1_000);
        // Sur 1d20 >= 11, probabilité théorique = 50%
        assert!(summary.success_rate >= 0.40 && summary.success_rate <= 0.60);
    }

    #[test]
    fn test_monte_carlo_shadowrun() {
        let summary = MonteCarloSimulator::simulate_shadowrun_hits(12, 4, 1_000);
        assert_eq!(summary.total_iterations, 1_000);
        assert!(summary.average_score >= 3.0 && summary.average_score <= 5.0);
    }
}
