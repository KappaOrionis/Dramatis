use rhai::{Engine, Scope, AST};
use thiserror::Error;

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

        Self { engine }
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
}
