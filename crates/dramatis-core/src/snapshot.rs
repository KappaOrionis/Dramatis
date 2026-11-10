use std::path::{Path, PathBuf};
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SnapshotError {
    #[error("Git execution error: {0}")]
    Git(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct TheaterSnapshotManager {
    root: PathBuf,
}

impl TheaterSnapshotManager {
    pub fn new<P: AsRef<Path>>(theater_root: P) -> Self {
        Self {
            root: theater_root.as_ref().to_path_buf(),
        }
    }

    pub fn ensure_git_initialized(&self) -> Result<(), SnapshotError> {
        if !self.root.join(".git").exists() {
            let _ = Command::new("git")
                .arg("-C")
                .arg(&self.root)
                .arg("init")
                .output();
            let _ = Command::new("git")
                .arg("-C")
                .arg(&self.root)
                .args(["config", "user.email", "dramatis@local.theater"])
                .output();
            let _ = Command::new("git")
                .arg("-C")
                .arg(&self.root)
                .args(["config", "user.name", "Dramatis Engine"])
                .output();
        }
        Ok(())
    }

    /// Crée un instantané Git local pour le Théâtre
    pub fn create_snapshot(&self, message: &str) -> Result<String, SnapshotError> {
        self.ensure_git_initialized()?;

        let status = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["add", "."])
            .status()
            .map_err(|e| SnapshotError::Git(format!("git add failed: {}", e)))?;

        if !status.success() {
            return Err(SnapshotError::Git("Failed to stage theater files".to_string()));
        }

        let output = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["commit", "-m", message])
            .output()
            .map_err(|e| SnapshotError::Git(format!("git commit failed: {}", e)))?;

        let out_str = String::from_utf8_lossy(&output.stdout).to_string();
        if !output.status.success() && !out_str.contains("nothing to commit") {
            return Err(SnapshotError::Git(out_str));
        }

        let rev_out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["rev-parse", "--short", "HEAD"])
            .output()
            .map_err(|e| SnapshotError::Git(format!("git rev-parse failed: {}", e)))?;

        Ok(String::from_utf8_lossy(&rev_out.stdout).trim().to_string())
    }

    /// Liste l'historique des snapshots du Théâtre
    pub fn list_snapshots(&self, limit: usize) -> Result<Vec<(String, String)>, SnapshotError> {
        if !self.root.join(".git").exists() {
            return Ok(Vec::new());
        }

        let output = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["log", &format!("-n{}", limit), "--oneline"])
            .output()
            .map_err(|e| SnapshotError::Git(format!("git log failed: {}", e)))?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut list = Vec::new();

        for line in stdout.lines() {
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            if parts.len() == 2 {
                list.push((parts[0].to_string(), parts[1].to_string()));
            }
        }

        Ok(list)
    }

    /// Restaure le Théâtre à un snapshot spécifique
    pub fn rollback_to(&self, commit_hash: &str) -> Result<(), SnapshotError> {
        let status = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["checkout", commit_hash, "--", "."])
            .status()
            .map_err(|e| SnapshotError::Git(format!("git checkout failed: {}", e)))?;

        if !status.success() {
            return Err(SnapshotError::Git(format!("Rollback to {} failed", commit_hash)));
        }

        Ok(())
    }
}
