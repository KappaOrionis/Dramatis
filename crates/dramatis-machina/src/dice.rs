use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiceRollResult {
    pub expression: String,
    pub rolls: Vec<u32>,
    pub total: i64,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShadowrunPoolResult {
    pub pool_size: usize,
    pub rolls: Vec<u32>,
    pub hits: usize,
    pub ones: usize,
    pub is_glitch: bool,
    pub is_critical_glitch: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArsMagicaStressResult {
    pub initial_roll: u32,
    pub multiplier: u32,
    pub intermediate_rolls: Vec<u32>,
    pub final_die_value: u32,
    pub is_botch_check: bool,
    pub botch_dice: usize,
    pub botch_zeros: usize,
    pub is_botch: bool,
}

pub struct DiceEngine;

impl DiceEngine {
    pub fn roll_standard(count: usize, sides: u32, modifier: i64) -> DiceRollResult {
        let mut rng = rand::thread_rng();
        let mut rolls = Vec::with_capacity(count);
        let mut sum: i64 = 0;

        for _ in 0..count {
            let r = rng.gen_range(1..=sides);
            rolls.push(r);
            sum += r as i64;
        }

        let total = sum + modifier;
        let details = format!("{}d{} ({:?}) + ({}) = {}", count, sides, rolls, modifier, total);

        DiceRollResult {
            expression: format!("{}d{}{:+}", count, sides, modifier),
            rolls,
            total,
            details,
        }
    }

    pub fn roll_shadowrun(pool_size: usize) -> ShadowrunPoolResult {
        let mut rng = rand::thread_rng();
        let mut rolls = Vec::with_capacity(pool_size);
        let mut hits = 0;
        let mut ones = 0;

        for _ in 0..pool_size {
            let r = rng.gen_range(1..=6);
            if r >= 5 {
                hits += 1;
            }
            if r == 1 {
                ones += 1;
            }
            rolls.push(r);
        }

        let is_glitch = ones > (pool_size / 2);
        let is_critical_glitch = is_glitch && (hits == 0);

        ShadowrunPoolResult {
            pool_size,
            rolls,
            hits,
            ones,
            is_glitch,
            is_critical_glitch,
        }
    }

    pub fn roll_ars_magica_stress(botch_dice: usize) -> ArsMagicaStressResult {
        let mut rng = rand::thread_rng();
        let initial = rng.gen_range(0..=9);

        if initial == 0 {
            let mut zeros = 0;
            for _ in 0..botch_dice {
                if rng.gen_range(0..=9) == 0 {
                    zeros += 1;
                }
            }
            return ArsMagicaStressResult {
                initial_roll: 0,
                multiplier: 1,
                intermediate_rolls: vec![0],
                final_die_value: 0,
                is_botch_check: true,
                botch_dice,
                botch_zeros: zeros,
                is_botch: zeros > 0,
            };
        }

        if initial == 1 {
            let mut multiplier = 2;
            let mut inter = vec![1];
            loop {
                let next = rng.gen_range(1..=10);
                inter.push(next);
                if next == 1 {
                    multiplier *= 2;
                } else {
                    let final_val = next * multiplier;
                    return ArsMagicaStressResult {
                        initial_roll: 1,
                        multiplier,
                        intermediate_rolls: inter,
                        final_die_value: final_val,
                        is_botch_check: false,
                        botch_dice: 0,
                        botch_zeros: 0,
                        is_botch: false,
                    };
                }
            }
        }

        ArsMagicaStressResult {
            initial_roll: initial,
            multiplier: 1,
            intermediate_rolls: vec![initial],
            final_die_value: initial,
            is_botch_check: false,
            botch_dice: 0,
            botch_zeros: 0,
            is_botch: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_dice() {
        let res = DiceEngine::roll_standard(3, 6, 2);
        assert_eq!(res.rolls.len(), 3);
        assert!(res.total >= 5 && res.total <= 20);
    }

    #[test]
    fn test_shadowrun_pool() {
        let res = DiceEngine::roll_shadowrun(12);
        assert_eq!(res.rolls.len(), 12);
        assert_eq!(res.pool_size, 12);
        for &r in &res.rolls {
            assert!(r >= 1 && r <= 6);
        }
    }

    #[test]
    fn test_ars_magica_stress() {
        let res = DiceEngine::roll_ars_magica_stress(2);
        if res.is_botch_check {
            assert_eq!(res.initial_roll, 0);
            assert_eq!(res.botch_dice, 2);
        } else {
            assert!(res.final_die_value >= 1);
        }
    }
}
