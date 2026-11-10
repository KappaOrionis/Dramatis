use std::path::{Path, PathBuf};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::rrf::{ReciprocalRankFusion, ScoredDocument};
use crate::tantivy_search::{TantivyError, TantivySearchEngine};

#[derive(Error, Debug)]
pub enum HybridError {
    #[error("Tantivy search error: {0}")]
    Tantivy(#[from] TantivyError),
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResult {
    pub doc_id: String,
    pub title: String,
    pub rrf_score: f64,
    pub source_path: String,
    pub excerpt: String,
    pub page: Option<u32>,
    pub graph_neighbors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorEmbeddingRecord {
    pub doc_id: String,
    pub title: String,
    pub text: String,
    pub source_path: String,
    pub page: Option<u32>,
    pub embedding: Vec<f32>,
}

pub struct HybridSearchEngine {
    tantivy: TantivySearchEngine,
    knowledge_db_path: PathBuf,
    vector_store_path: PathBuf,
    vectors: Vec<VectorEmbeddingRecord>,
}

impl HybridSearchEngine {
    pub fn open_or_create(index_dir: &Path, theater_root: &Path) -> Result<Self, HybridError> {
        let tantivy_dir = index_dir.join("tantivy");
        let tantivy = TantivySearchEngine::open_or_create(&tantivy_dir)?;

        let knowledge_db_path = theater_root.join("knowledge_graph.sqlite");
        let vector_store_path = index_dir.join("vectors").join("embeddings.json");

        if let Some(parent) = vector_store_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let vectors = if vector_store_path.exists() {
            let data = std::fs::read_to_string(&vector_store_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };

        Ok(Self {
            tantivy,
            knowledge_db_path,
            vector_store_path,
            vectors,
        })
    }

    pub fn index_document(
        &mut self,
        doc_id: &str,
        title: &str,
        body: &str,
        source_path: &str,
        page: Option<u32>,
        embedding: Option<Vec<f32>>,
    ) -> Result<(), HybridError> {
        // 1. Tantivy Lexical Indexing
        self.tantivy.index_document(doc_id, title, body, source_path, page)?;

        // 2. Vector Embedding Indexing (if provided)
        if let Some(emb) = embedding {
            self.vectors.retain(|v| v.doc_id != doc_id);
            self.vectors.push(VectorEmbeddingRecord {
                doc_id: doc_id.to_string(),
                title: title.to_string(),
                text: body.chars().take(400).collect(),
                source_path: source_path.to_string(),
                page,
                embedding: emb,
            });
            let serialized = serde_json::to_string_pretty(&self.vectors)?;
            std::fs::write(&self.vector_store_path, serialized)?;
        }

        Ok(())
    }

    pub fn search_hybrid(
        &self,
        query: &str,
        query_vector: Option<&[f32]>,
        limit: usize,
    ) -> Result<Vec<HybridSearchResult>, HybridError> {
        // 1. Tantivy Lexical Search
        let tantivy_hits = self.tantivy.search(query, limit * 2)?;

        // 2. Dense Vector Cosine Similarity Search
        let dense_hits: Vec<ScoredDocument> = if let Some(q_vec) = query_vector {
            let mut vector_scores: Vec<(usize, f64)> = self
                .vectors
                .iter()
                .enumerate()
                .map(|(idx, rec)| {
                    let sim = cosine_similarity(q_vec, &rec.embedding);
                    (idx, sim as f64)
                })
                .collect();

            vector_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

            vector_scores
                .into_iter()
                .take(limit * 2)
                .map(|(idx, score)| {
                    let rec = &self.vectors[idx];
                    ScoredDocument {
                        id: rec.doc_id.clone(),
                        title: rec.title.clone(),
                        content: rec.text.clone(),
                        source_path: rec.source_path.clone(),
                        page: rec.page,
                        score,
                    }
                })
                .collect()
        } else {
            Vec::new()
        };

        // 3. Knowledge Graph Context Expansion
        let graph_hits = self.find_graph_relevant_nodes(query, limit)?;

        // 4. Combine via Reciprocal Rank Fusion (k = 60.0)
        let fused_docs = ReciprocalRankFusion::fuse(dense_hits, tantivy_hits, graph_hits, 60.0);

        // 5. Enrich top results with graph relations
        let mut results = Vec::new();
        for doc in fused_docs.into_iter().take(limit) {
            let neighbors = self.get_graph_neighbors(&doc.id).unwrap_or_default();
            results.push(HybridSearchResult {
                doc_id: doc.id,
                title: doc.title,
                rrf_score: doc.score,
                source_path: doc.source_path,
                excerpt: doc.content,
                page: doc.page,
                graph_neighbors: neighbors,
            });
        }

        Ok(results)
    }

    fn find_graph_relevant_nodes(&self, query: &str, limit: usize) -> Result<Vec<ScoredDocument>, HybridError> {
        if !self.knowledge_db_path.exists() {
            return Ok(Vec::new());
        }

        let conn = Connection::open(&self.knowledge_db_path)?;
        let mut stmt = conn.prepare(
            "SELECT entity_id, label, properties FROM kg_nodes WHERE label LIKE ?1 OR canonical_name LIKE ?1 LIMIT ?2",
        )?;

        let pattern = format!("%{}%", query);
        let rows = stmt.query_map([&pattern, &limit.to_string()], |row| {
            let id: String = row.get(0)?;
            let label: String = row.get(1)?;
            let props: String = row.get(2)?;
            Ok((id, label, props))
        })?;

        let mut ranked = Vec::new();
        for row in rows.flatten() {
            ranked.push(ScoredDocument {
                id: row.0,
                title: row.1,
                content: row.2,
                source_path: "knowledge_graph.sqlite".to_string(),
                page: None,
                score: 1.0,
            });
        }

        Ok(ranked)
    }

    fn get_graph_neighbors(&self, entity_id: &str) -> Result<Vec<String>, HybridError> {
        if !self.knowledge_db_path.exists() {
            return Ok(Vec::new());
        }

        let conn = Connection::open(&self.knowledge_db_path)?;
        let mut stmt = conn.prepare(
            "SELECT target_id, relation_type FROM kg_edges WHERE source_id = ?1 LIMIT 10",
        )?;

        let rows = stmt.query_map([entity_id], |row| {
            let target: String = row.get(0)?;
            let rel: String = row.get(1)?;
            Ok(format!("{}: {}", rel, target))
        })?;

        let mut neighbors = Vec::new();
        for r in rows.flatten() {
            neighbors.push(r);
        }

        Ok(neighbors)
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }

    if norm_a <= 0.0 || norm_b <= 0.0 {
        0.0
    } else {
        dot / (norm_a.sqrt() * norm_b.sqrt())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_hybrid_search_end_to_end() {
        let temp = tempdir().unwrap();
        let theater_root = temp.path().join(".dramatis");
        let index_dir = theater_root.join("04_index");
        std::fs::create_dir_all(&index_dir).unwrap();

        // Create dummy SQLite KG
        let kg_path = theater_root.join("knowledge_graph.sqlite");
        let conn = Connection::open(&kg_path).unwrap();
        conn.execute(
            "CREATE TABLE kg_nodes (entity_id TEXT PRIMARY KEY, canonical_name TEXT, label TEXT, category TEXT, properties TEXT)",
            [],
        ).unwrap();
        conn.execute(
            "CREATE TABLE kg_edges (edge_id TEXT PRIMARY KEY, source_id TEXT, target_id TEXT, relation_type TEXT, weight REAL, bidirectional INTEGER)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO kg_nodes VALUES ('covenant_doissetep', 'Doissetep', 'Doissetep Hermetic Covenant', 'location', '{}')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO kg_edges VALUES ('e1', 'covenant_doissetep', 'magus_tremere', 'allied_with', 1.0, 0)",
            [],
        ).unwrap();

        let mut engine = HybridSearchEngine::open_or_create(&index_dir, &theater_root).unwrap();

        // Index 2 documents with embeddings
        engine.index_document(
            "covenant_doissetep",
            "Doissetep Covenant",
            "Doissetep is a famous Hermetic Covenant perched high in the Pyrenees.",
            "/01_wiki/locations/doissetep.md",
            Some(42),
            Some(vec![1.0, 0.0, 0.0]),
        ).unwrap();

        engine.index_document(
            "seattle_matrix",
            "Seattle Grid Matrix",
            "The Seattle grid is buzzing with Renraku IC and deckers.",
            "/01_wiki/lore/seattle.md",
            None,
            Some(vec![0.0, 1.0, 0.0]),
        ).unwrap();

        // Query with query vector pointing to Doissetep
        let results = engine.search_hybrid("Pyrenees Hermetic", Some(&[0.9, 0.1, 0.0]), 5).unwrap();

        assert!(!results.is_empty());
        assert_eq!(results[0].doc_id, "covenant_doissetep");
        assert_eq!(results[0].title, "Doissetep Covenant");
        assert_eq!(results[0].page, Some(42));
        assert!(results[0].graph_neighbors.contains(&"allied_with: magus_tremere".to_string()));
    }
}
