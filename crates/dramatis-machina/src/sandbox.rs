use std::path::Path;
use rhai::{Engine, Scope, AST};
use rusqlite::Connection;
use thiserror::Error;

use crate::advanced_dice::AdvancedDiceParser;

#[derive(Error, Debug)]
pub enum SandboxError {
    #[error("Rhai compilation error: {0}")]
    Compile(#[from] rhai::ParseError),
    #[error("Rhai execution error: {0}")]
    Eval(#[from] Box<rhai::EvalAltResult>),
}

pub struct RhaiSandbox {
    engine: Engine,
}

impl Default for RhaiSandbox {
    fn default() -> Self {
        Self::new()
    }
}

impl RhaiSandbox {
    pub fn new() -> Self {
        let mut engine = Engine::new();
        engine.set_max_expr_depths(64, 32);
        engine.set_max_operations(100_000);

        // Register native deterministic dice roller (`MAC-03`)
        engine.register_fn("roll", |expr: &str| -> i64 {
            AdvancedDiceParser::parse_and_roll(expr)
                .map(|r| r.total)
                .unwrap_or(0)
        });

        Self { engine }
    }

    /// Creates a RhaiSandbox bound to a specific Theater's `02_machina/tables.sqlite`
    /// Exposes `sql_lookup(table, target_col, key_col, key_val) -> String` and `sql_lookup_int(...) -> i64` (`MAC-03`)
    pub fn with_sqlite_tables<P: AsRef<Path>>(tables_db_path: P) -> Self {
        let mut sandbox = Self::new();
        let db_path = tables_db_path.as_ref().to_path_buf();
        let db_path_int = db_path.clone();

        sandbox.engine.register_fn(
            "sql_lookup",
            move |table: &str, target_col: &str, key_col: &str, key_val: &str| -> String {
                if !db_path.exists() {
                    return String::new();
                }
                // Sanitize identifiers (alphanumeric + underscore only)
                let clean_table: String = table.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();
                let clean_target: String = target_col.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();
                let clean_key: String = key_col.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();

                if let Ok(conn) = Connection::open(&db_path) {
                    let sql = format!(
                        "SELECT \"{}\" FROM \"{}\" WHERE LOWER(\"{}\") = LOWER(?1) LIMIT 1",
                        clean_target, clean_table, clean_key
                    );
                    if let Ok(mut stmt) = conn.prepare(&sql) {
                        if let Ok(val) = stmt.query_row([key_val], |r| r.get::<_, String>(0)) {
                            return val;
                        }
                    }
                }
                String::new()
            },
        );

        sandbox.engine.register_fn(
            "sql_lookup_int",
            move |table: &str, target_col: &str, key_col: &str, key_val: &str| -> i64 {
                if !db_path_int.exists() {
                    return 0;
                }
                let clean_table: String = table.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();
                let clean_target: String = target_col.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();
                let clean_key: String = key_col.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect();

                if let Ok(conn) = Connection::open(&db_path_int) {
                    let sql = format!(
                        "SELECT \"{}\" FROM \"{}\" WHERE LOWER(\"{}\") = LOWER(?1) LIMIT 1",
                        clean_target, clean_table, clean_key
                    );
                    if let Ok(mut stmt) = conn.prepare(&sql) {
                        if let Ok(val_str) = stmt.query_row([key_val], |r| r.get::<_, String>(0)) {
                            return val_str.trim().parse::<i64>().unwrap_or(0);
                        }
                    }
                }
                0
            },
        );

        sandbox
    }

    pub fn compile_script(&self, script: &str) -> Result<AST, SandboxError> {
        let ast = self.engine.compile(script)?;
        Ok(ast)
    }

    pub fn evaluate_formula<T: Clone + Send + Sync + 'static>(
        &self,
        script: &str,
        mut scope: Scope,
    ) -> Result<T, SandboxError> {
        let result = self.engine.eval_with_scope::<T>(&mut scope, script)?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_rhai_simple_formula() {
        let sandbox = RhaiSandbox::new();
        let mut scope = Scope::new();
        scope.set_value("stamina", 2_i64);
        scope.set_value("technique", 5_i64);
        scope.set_value("form", 7_i64);

        let formula = "stamina + technique + form";
        let res: i64 = sandbox.evaluate_formula(formula, scope).expect("Evaluation failed");
        assert_eq!(res, 14);
    }

    #[test]
    fn test_rhai_native_roll_and_sqlite_lookup() {
        let temp = tempdir().unwrap();
        let db_path = temp.path().join("tables.sqlite");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "CREATE TABLE weapons (name TEXT, damage TEXT, ar TEXT)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO weapons VALUES ('Ares Predator VI', '3', '10')",
            [],
        ).unwrap();

        let sandbox = RhaiSandbox::with_sqlite_tables(&db_path);
        let scope = Scope::new();

        let script = r#"
            let base_dmg = sql_lookup_int("weapons", "damage", "name", "Ares Predator VI");
            let dice_bonus = roll("1d1+1");
            base_dmg + dice_bonus
        "#;

        let total: i64 = sandbox.evaluate_formula(script, scope).unwrap();
        assert_eq!(total, 5); // 3 + (1 + 1)
    }
}
