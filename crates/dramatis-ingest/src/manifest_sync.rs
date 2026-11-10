use std::path::Path;
use rusqlite::{params, Connection};
use thiserror::Error;

use crate::hasher::{HasherError, SourceHasher};
use dramatis_core::TheaterDatabaseInitializer;

#[derive(Error, Debug)]
pub enum ManifestSyncError {
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Schema init error: {0}")]
    Schema(#[from] dramatis_core::database::SchemaInitError),
    #[error("Hasher error: {0}")]
    Hasher(#[from] HasherError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, PartialEq, Eq)]
pub enum SyncDecision {
    UpToDate,
    NeedsIngestion { old_hash: Option<String>, new_hash: String },
}

pub struct ManifestSyncManager;

impl ManifestSyncManager {
    /// Checks a file against manifest.sqlite (`sources` table) and determines whether re-ingestion is required.
    pub fn evaluate_file(
        manifest_db_path: &Path,
        file_path: &Path,
        source_id: &str,
    ) -> Result<SyncDecision, ManifestSyncError> {
        TheaterDatabaseInitializer::init_manifest_db(manifest_db_path)?;
        let current_hash = SourceHasher::compute_sha256(file_path)?;

        let conn = Connection::open(manifest_db_path)?;
        let mut stmt = conn.prepare("SELECT sha256_hash FROM sources WHERE source_id = ?1")?;
        let existing: Option<String> = stmt
            .query_row(params![source_id], |row| row.get(0))
            .ok();

        match existing {
            Some(old_hash) if old_hash == current_hash => Ok(SyncDecision::UpToDate),
            Some(old_hash) => Ok(SyncDecision::NeedsIngestion {
                old_hash: Some(old_hash),
                new_hash: current_hash,
            }),
            None => Ok(SyncDecision::NeedsIngestion {
                old_hash: None,
                new_hash: current_hash,
            }),
        }
    }

    /// Records or updates a source file in manifest.sqlite (`sources`) and purges old chunks (`chunks`) if updated.
    pub fn record_source_ingested(
        manifest_db_path: &Path,
        source_id: &str,
        file_path: &str,
        file_type: &str,
        sha256_hash: &str,
        page_count: Option<u32>,
    ) -> Result<(), ManifestSyncError> {
        TheaterDatabaseInitializer::init_manifest_db(manifest_db_path)?;
        let mut conn = Connection::open(manifest_db_path)?;
        let tx = conn.transaction()?;

        // Purge old chunks for this source if re-indexing
        tx.execute("DELETE FROM chunks WHERE source_id = ?1", params![source_id])?;

        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(source_id);

        tx.execute(
            r#"
            INSERT INTO sources (source_id, file_path, file_name, file_type, sha256_hash, page_count, ingested_at, status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s','now'), 'indexed')
            ON CONFLICT(source_id) DO UPDATE SET
                file_path = excluded.file_path,
                file_name = excluded.file_name,
                file_type = excluded.file_type,
                sha256_hash = excluded.sha256_hash,
                page_count = excluded.page_count,
                ingested_at = strftime('%s','now'),
                status = 'indexed'
            "#,
            params![source_id, file_path, file_name, file_type, sha256_hash, page_count],
        )?;

        tx.commit()?;
        Ok(())
    }

    /// Records an ingested chunk in manifest.sqlite (`chunks`)
    pub fn record_chunk(
        manifest_db_path: &Path,
        chunk_id: &str,
        source_id: &str,
        parent_section_id: Option<&str>,
        page_number: Option<u32>,
        chunk_text: &str,
        token_count: u32,
    ) -> Result<(), ManifestSyncError> {
        let conn = Connection::open(manifest_db_path)?;
        conn.execute(
            r#"
            INSERT INTO chunks (chunk_id, source_id, parent_section_id, page_number, content, token_count, indexed_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s','now'))
            ON CONFLICT(chunk_id) DO UPDATE SET
                content = excluded.content,
                token_count = excluded.token_count,
                indexed_at = strftime('%s','now')
            "#,
            params![chunk_id, source_id, parent_section_id, page_number, chunk_text, token_count],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_manifest_sync_idempotence_and_purge() {
        let temp = tempdir().unwrap();
        let manifest_db = temp.path().join("manifest.sqlite");
        TheaterDatabaseInitializer::init_manifest_db(&manifest_db).unwrap();

        let test_doc = temp.path().join("source.txt");
        std::fs::write(&test_doc, "Version 1 of lore document").unwrap();

        // 1. Initial check: should need ingestion
        let decision = ManifestSyncManager::evaluate_file(&manifest_db, &test_doc, "src_lore").unwrap();
        match decision {
            SyncDecision::NeedsIngestion { old_hash, new_hash } => {
                assert!(old_hash.is_none());
                ManifestSyncManager::record_source_ingested(
                    &manifest_db,
                    "src_lore",
                    test_doc.to_str().unwrap(),
                    "text",
                    &new_hash,
                    Some(1),
                ).unwrap();
                ManifestSyncManager::record_chunk(
                    &manifest_db,
                    "chunk_1",
                    "src_lore",
                    None,
                    Some(1),
                    "Version 1 content",
                    10,
                ).unwrap();
            }
            _ => panic!("Expected NeedsIngestion"),
        }

        // 2. Second check: should be up to date (idempotent)
        let decision2 = ManifestSyncManager::evaluate_file(&manifest_db, &test_doc, "src_lore").unwrap();
        assert_eq!(decision2, SyncDecision::UpToDate);

        // 3. Update file content
        std::fs::write(&test_doc, "Version 2 of lore document with changes").unwrap();
        let decision3 = ManifestSyncManager::evaluate_file(&manifest_db, &test_doc, "src_lore").unwrap();
        match decision3 {
            SyncDecision::NeedsIngestion { old_hash, new_hash } => {
                assert!(old_hash.is_some());
                assert_ne!(old_hash.unwrap(), new_hash);
                // Re-ingest
                ManifestSyncManager::record_source_ingested(
                    &manifest_db,
                    "src_lore",
                    test_doc.to_str().unwrap(),
                    "text",
                    &new_hash,
                    Some(1),
                ).unwrap();
            }
            _ => panic!("Expected NeedsIngestion upon file edit"),
        }

        // Verify that old chunk was purged
        let conn = Connection::open(&manifest_db).unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM chunks WHERE source_id = 'src_lore'", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }
}
