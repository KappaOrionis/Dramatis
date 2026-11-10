use rand::Rng;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ExpressionError {
    #[error("Invalid dice expression syntax: {0}")]
    InvalidSyntax(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum KeepDropMode {
    KeepHighest(usize),
    KeepLowest(usize),
    DropHighest(usize),
    DropLowest(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDiceRoll {
    pub count: usize,
    pub sides: usize,
    pub modifier: i64,
    pub keep_drop: Option<KeepDropMode>,
    pub target_threshold: Option<(String, i64)>, // e.g. ("<=", 45) or (">=", 15)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedRollResult {
    pub expression: String,
    pub all_rolls: Vec<i64>,
    pub kept_rolls: Vec<i64>,
    pub modifier: i64,
    pub total: i64,
    pub is_success: Option<bool>,
}

pub struct AdvancedDiceParser;

impl AdvancedDiceParser {
    /// Parses expressions such as:
    /// - `4d6kh3` (keep highest 3)
    /// - `2d20kl1` (keep lowest 1)
    /// - `1d100<=45` (target threshold test)
    /// - `3d8+5`
    pub fn parse_and_roll(expr: &str) -> Result<AdvancedRollResult, ExpressionError> {
        let clean = expr.trim().to_lowercase().replace(' ', "");

        // 1. Check for threshold: e.g. <=45 or >=15
        let (base_expr, threshold) = if let Some(idx) = clean.find("<=") {
            let (left, right) = clean.split_at(idx);
            let val: i64 = right[2..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (left, Some(("<=".to_string(), val)))
        } else if let Some(idx) = clean.find(">=") {
            let (left, right) = clean.split_at(idx);
            let val: i64 = right[2..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (left, Some((">=".to_string(), val)))
        } else {
            (clean.as_str(), None)
        };

        // 2. Check for modifier (+N or -N)
        let (dice_part, modifier) = if let Some(idx) = base_expr.rfind('+') {
            let (l, r) = base_expr.split_at(idx);
            let mod_val: i64 = r[1..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (l, mod_val)
        } else if let Some(idx) = base_expr.rfind('-') {
            let (l, r) = base_expr.split_at(idx);
            let mod_val: i64 = r[1..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (l, -mod_val)
        } else {
            (base_expr, 0)
        };

        // 3. Check for Keep/Drop: kh, kl, dh, dl
        let (d_spec, keep_drop) = if let Some(idx) = dice_part.find("kh") {
            let (l, r) = dice_part.split_at(idx);
            let k: usize = r[2..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (l, Some(KeepDropMode::KeepHighest(k)))
        } else if let Some(idx) = dice_part.find("kl") {
            let (l, r) = dice_part.split_at(idx);
            let k: usize = r[2..].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
            (l, Some(KeepDropMode::KeepLowest(k)))
        } else {
            (dice_part, None)
        };

        // 4. Parse count & sides: "4d6"
        let parts: Vec<&str> = d_spec.split('d').collect();
        if parts.len() != 2 {
            return Err(ExpressionError::InvalidSyntax(expr.to_string()));
        }

        let count: usize = if parts[0].is_empty() {
            1
        } else {
            parts[0].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?
        };

        let sides: usize = parts[1].parse().map_err(|_| ExpressionError::InvalidSyntax(expr.to_string()))?;
        if sides == 0 || count == 0 {
            return Err(ExpressionError::InvalidSyntax("Dice count and sides must be > 0".to_string()));
        }

        // Execute rolls
        let mut rng = rand::thread_rng();
        let all_rolls: Vec<i64> = (0..count).map(|_| rng.gen_range(1..=sides) as i64).collect();

        let mut sorted = all_rolls.clone();
        sorted.sort();

        let kept_rolls: Vec<i64> = match keep_drop {
            Some(KeepDropMode::KeepHighest(k)) => {
                let take_k = k.min(sorted.len());
                sorted.iter().rev().take(take_k).cloned().collect()
            }
            Some(KeepDropMode::KeepLowest(k)) => {
                let take_k = k.min(sorted.len());
                sorted.iter().take(take_k).cloned().collect()
            }
            _ => all_rolls.clone(),
        };

        let sum_kept: i64 = kept_rolls.iter().sum();
        let total = sum_kept + modifier;

        let is_success = threshold.map(|(op, limit)| {
            if op == "<=" {
                total <= limit
            } else if op == ">=" {
                total >= limit
            } else {
                false
            }
        });

        Ok(AdvancedRollResult {
            expression: expr.to_string(),
            all_rolls,
            kept_rolls,
            modifier,
            total,
            is_success,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keep_highest_roll() {
        let res = AdvancedDiceParser::parse_and_roll("4d6kh3+2").unwrap();
        assert_eq!(res.all_rolls.len(), 4);
        assert_eq!(res.kept_rolls.len(), 3);
        assert_eq!(res.modifier, 2);
        let sum_k: i64 = res.kept_rolls.iter().sum();
        assert_eq!(res.total, sum_k + 2);
    }

    #[test]
    fn test_keep_lowest_roll() {
        let res = AdvancedDiceParser::parse_and_roll("2d20kl1").unwrap();
        assert_eq!(res.all_rolls.len(), 2);
        assert_eq!(res.kept_rolls.len(), 1);
        let min_val = res.all_rolls.iter().min().unwrap();
        assert_eq!(res.kept_rolls[0], *min_val);
    }

    #[test]
    fn test_threshold_comparison() {
        let res = AdvancedDiceParser::parse_and_roll("1d100<=50").unwrap();
        assert_eq!(res.all_rolls.len(), 1);
        assert!(res.is_success.is_some());
        if res.total <= 50 {
            assert_eq!(res.is_success, Some(true));
        } else {
            assert_eq!(res.is_success, Some(false));
        }
    }
}
