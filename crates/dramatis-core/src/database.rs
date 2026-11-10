use rusqlite::Connection;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SchemaInitError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct TheaterDatabaseInitializer;

impl TheaterDatabaseInitializer {
    /// Initialise manifest.sqlite (Index et suivi SHA-256)
    pub fn init_manifest_db<P: AsRef<Path>>(db_path: P) -> Result<(), SchemaInitError> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS sources (
                source_id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                sha256_hash TEXT NOT NULL,
                ingested_at INTEGER NOT NULL,
                status TEXT NOT NULL -- 'pending', 'indexed', 'error'
            );

            CREATE TABLE IF NOT EXISTS chunks (
                chunk_id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                parent_section_id TEXT NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                token_count INTEGER NOT NULL,
                breadcrumb TEXT,
                indexed_at INTEGER NOT NULL,
                FOREIGN KEY (source_id) REFERENCES sources(source_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
            CREATE INDEX IF NOT EXISTS idx_sources_hash ON sources(sha256_hash);
            "#
        )?;
        Ok(())
    }

    /// Initialise knowledge_graph.sqlite (Graphe relationnel Lore, Wiki et Entités)
    pub fn init_knowledge_graph_db<P: AsRef<Path>>(db_path: P) -> Result<(), SchemaInitError> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS entities (
                entity_id TEXT PRIMARY KEY,
                canonical_title TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL, -- 'histoire', 'lieux', 'pnj', 'bestiaire', 'factions', 'objets', 'concepts'
                relative_path TEXT NOT NULL,
                canon_level TEXT NOT NULL, -- 'official', 'homebrew', 'campaign_fact', 'campaign_rumor'
                visibility TEXT NOT NULL, -- 'public', 'gm_only', 'discovered_by:...'
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id TEXT NOT NULL,
                alias TEXT NOT NULL,
                FOREIGN KEY (entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_entity_id TEXT NOT NULL,
                target_entity_id TEXT NOT NULL,
                relation_type TEXT NOT NULL, -- 'allied_with', 'located_in', 'member_of', 'opposes', etc.
                weight REAL DEFAULT 1.0,
                FOREIGN KEY (source_entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE,
                FOREIGN KEY (target_entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_aliases_alias ON aliases(alias);
            CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_entity_id);
            CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_entity_id);
            "#
        )?;
        Ok(())
    }

    /// Initialise tables.sqlite (Catalogues de données mécaniques de jeu)
    pub fn init_machina_tables_db<P: AsRef<Path>>(db_path: P) -> Result<(), SchemaInitError> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS table_metadata (
                table_name TEXT PRIMARY KEY,
                description TEXT,
                source_file TEXT,
                row_count INTEGER DEFAULT 0,
                last_updated INTEGER NOT NULL
            );
            "#
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initialize_all_databases() {
        let tmp = tempfile::tempdir().unwrap();
        let manifest_path = tmp.path().join("manifest.sqlite");
        let kg_path = tmp.path().join("knowledge_graph.sqlite");
        let tables_path = tmp.path().join("tables.sqlite");

        assert!(TheaterDatabaseInitializer::init_manifest_db(&manifest_path).is_ok());
        assert!(TheaterDatabaseInitializer::init_knowledge_graph_db(&kg_path).is_ok());
        assert!(TheaterDatabaseInitializer::init_machina_tables_db(&tables_path).is_ok());

        assert!(manifest_path.exists());
        assert!(kg_path.exists());
        assert!(tables_path.exists());
    }
}
