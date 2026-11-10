use std::path::Path;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MediaIngestError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Image rejected by visual noise gate (width={width}, height={height} < 120px)")]
    VisualNoiseGate { width: u32, height: u32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAssetManifest {
    pub asset_id: String,
    pub original_file: String,
    pub webp_path: String,
    pub width: u32,
    pub height: u32,
    pub perceptual_hash: String,
    pub vlm_caption: String,
    pub extracted_zones: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrackEntry {
    pub track_id: String,
    pub title: String,
    pub file_path: String,
    pub category: String, // "music_loop", "ambient_loop", "sfx"
    pub tags: Vec<String>, // e.g. ["combat", "matrix", "rain", "hermetic_lab"]
    pub intensity: u8,     // 1 to 5
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SoundboardCatalog {
    pub tracks: Vec<AudioTrackEntry>,
}

pub struct MultimodalIngester;

impl MultimodalIngester {
    /// Evaluates an image asset against the Visual Noise Gate (< 120px rejected),
    /// computes a deterministic perceptual hash signature, and generates its companion metadata (`ING-07`).
    pub fn process_image_asset(
        asset_id: &str,
        original_file: &str,
        width: u32,
        height: u32,
        raw_bytes: &[u8],
        vlm_caption: &str,
        extracted_zones: Vec<String>,
    ) -> Result<ImageAssetManifest, MediaIngestError> {
        if width < 120 || height < 120 {
            return Err(MediaIngestError::VisualNoiseGate { width, height });
        }

        // Compute deterministic perceptual/content signature
        let mut hasher = Sha256::new();
        hasher.update(raw_bytes);
        let full_hash = hex::encode(hasher.finalize());
        let p_hash = full_hash.chars().take(16).collect::<String>();

        let webp_path = format!("/00_sources/extracted_assets/{}.webp", asset_id);

        Ok(ImageAssetManifest {
            asset_id: asset_id.to_string(),
            original_file: original_file.to_string(),
            webp_path,
            width,
            height,
            perceptual_hash: p_hash,
            vlm_caption: vlm_caption.to_string(),
            extracted_zones,
        })
    }

    pub fn load_or_create_soundboard(path: &Path) -> Result<SoundboardCatalog, MediaIngestError> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let catalog: SoundboardCatalog = serde_json::from_str(&content)?;
            Ok(catalog)
        } else {
            Ok(SoundboardCatalog::default())
        }
    }

    pub fn save_soundboard(path: &Path, catalog: &SoundboardCatalog) -> Result<(), MediaIngestError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(catalog)?;
        std::fs::write(path, serialized)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visual_noise_gate_rejects_small_icons() {
        let res = MultimodalIngester::process_image_asset(
            "icon_01",
            "border_ornament.png",
            64,
            64,
            b"dummy_bytes",
            "Ornamental border",
            vec![],
        );
        assert!(matches!(res, Err(MediaIngestError::VisualNoiseGate { .. })));
    }

    #[test]
    fn test_valid_tactical_map_extraction() {
        let res = MultimodalIngester::process_image_asset(
            "map_val_negra",
            "val_negra_keep.png",
            1024,
            768,
            b"map_binary_payload",
            "Plan du Covenant de Val Negra avec cour, tour des mages et sanctuaire.",
            vec!["zone_cour".to_string(), "zone_tour_mages".to_string(), "zone_sanctuaire".to_string()],
        ).unwrap();

        assert_eq!(res.webp_path, "/00_sources/extracted_assets/map_val_negra.webp");
        assert_eq!(res.extracted_zones.len(), 3);
        assert_eq!(res.perceptual_hash.len(), 16);
    }
}
