pub mod channels;
pub mod fog;
pub mod interception;
pub mod manifest;
pub mod resolution_gate;
pub mod topology;

pub use channels::{ChannelType, StageChannelRouter, StageMessage};
pub use fog::{AgentContextView, RealityPlane};
pub use interception::{DeterministicInterceptionEngine, InterceptionHook, InterceptionType, InterceptionVerdict};
pub use manifest::{CampaignManifest, PlayError, PlayOverlayManager, SceneClock, SceneNode, WorldStateDelta};
pub use resolution_gate::{GmOverrideCommand, MechanicalIntention, MechanicalResolution, StageResolutionGate, TablePlayMode};
pub use topology::{SceneTopology, TacticalTag, TacticalZone, ZoneId};
