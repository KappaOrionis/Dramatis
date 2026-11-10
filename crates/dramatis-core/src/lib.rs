pub mod acl;
pub mod chronos;
pub mod database;
pub mod epistemic;
pub mod mcp;
pub mod persona;
pub mod snapshot;
pub mod theater;
pub mod watcher;

pub use acl::{CanonLevel, Role, Visibility};
pub use chronos::ChronosConfig;
pub use database::TheaterDatabaseInitializer;
pub use epistemic::EpistemicFilter;
pub use mcp::{McpRegistry, McpToolSpec};
pub use persona::{AbilityScore, HealthMonitor, PersonaState};
pub use snapshot::{SnapshotError, TheaterSnapshotManager};
pub use theater::{TheaterError, TheaterManifest, TheaterWorkspace};
pub use watcher::{TheaterObsidianWatcher, WatcherError};
