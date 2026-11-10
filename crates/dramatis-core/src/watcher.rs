use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WatcherError {
    #[error("Notify error: {0}")]
    Notify(#[from] notify::Error),
}

pub struct TheaterObsidianWatcher {
    root: PathBuf,
}

impl TheaterObsidianWatcher {
    pub fn new<P: AsRef<Path>>(theater_root: P) -> Self {
        Self {
            root: theater_root.as_ref().to_path_buf(),
        }
    }

    /// Démarre une écoute temps réel des répertoires /01_wiki et /03_personae
    pub fn watch_vault(&self) -> Result<(RecommendedWatcher, Receiver<notify::Result<Event>>), WatcherError> {
        let (tx, rx) = channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;

        let wiki_dir = self.root.join("01_wiki");
        let personae_dir = self.root.join("03_personae");

        if wiki_dir.exists() {
            watcher.watch(&wiki_dir, RecursiveMode::Recursive)?;
        }
        if personae_dir.exists() {
            watcher.watch(&personae_dir, RecursiveMode::Recursive)?;
        }

        Ok((watcher, rx))
    }
}
