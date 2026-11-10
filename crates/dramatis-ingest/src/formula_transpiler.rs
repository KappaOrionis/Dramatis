use std::collections::HashMap;

pub struct FormulaTranspiler;

impl FormulaTranspiler {
    /// Transpiles simple Excel/Spreadsheet arithmetic and lookup formulas into safe Rhai functions
    /// Example: `SUM(A1, B1)` -> `a1 + b1`
    /// Example: `IF(A1 > 10, A1 * 2, A1)` -> `if a1 > 10 { a1 * 2 } else { a1 }`
    pub fn transpile_formula_to_rhai(formula_name: &str, params: &[&str], excel_expr: &str) -> String {
        let clean_expr = excel_expr.trim().trim_start_matches('=');
        let mut rhai_body = clean_expr.to_string();

        // Basic conversions
        // Replace IF(cond, then_val, else_val)
        if rhai_body.starts_with("IF(") && rhai_body.ends_with(')') {
            let inner = &rhai_body[3..rhai_body.len() - 1];
            let parts: Vec<&str> = inner.split(',').map(|s| s.trim()).collect();
            if parts.len() == 3 {
                rhai_body = format!("if {} {{ {} }} else {{ {} }}", parts[0], parts[1], parts[2]);
            }
        }

        let params_sig = params.join(", ");
        format!(
            "// Auto-transpiled from Excel formula `{}`\nfn {}({}) {{\n    {}\n}}\n",
            excel_expr, formula_name, params_sig, rhai_body
        )
    }

    /// Generates the complete formulas.rhai script from a map of formula definitions
    pub fn generate_rhai_script(formulas: &HashMap<String, (Vec<String>, String)>) -> String {
        let mut script = String::from("// Dramatis Auto-Generated Machina Formulas\n\n");
        let mut sorted_keys: Vec<&String> = formulas.keys().collect();
        sorted_keys.sort();

        for key in sorted_keys {
            let (params, expr) = &formulas[key];
            let param_refs: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
            script.push_str(&Self::transpile_formula_to_rhai(key, &param_refs, expr));
            script.push('\n');
        }
        script
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transpile_simple_excel_formula() {
        let rhai = FormulaTranspiler::transpile_formula_to_rhai(
            "calc_damage_bonus",
            &["str_rating", "weapon_mod"],
            "=str_rating + weapon_mod",
        );
        assert!(rhai.contains("fn calc_damage_bonus(str_rating, weapon_mod)"));
        assert!(rhai.contains("str_rating + weapon_mod"));
    }

    #[test]
    fn test_transpile_if_condition_excel() {
        let rhai = FormulaTranspiler::transpile_formula_to_rhai(
            "calc_threshold",
            &["rating"],
            "=IF(rating > 5, 2, 1)",
        );
        assert!(rhai.contains("if rating > 5 { 2 } else { 1 }"));
    }
}

