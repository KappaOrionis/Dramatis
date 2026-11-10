use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoredDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source_path: String,
    pub page: Option<u32>,
    pub score: f64,
}

pub struct ReciprocalRankFusion;

impl ReciprocalRankFusion {
    pub fn fuse(
        dense_results: Vec<ScoredDocument>,
        lexical_results: Vec<ScoredDocument>,
        graph_results: Vec<ScoredDocument>,
        k: f64,
    ) -> Vec<ScoredDocument> {
        let mut rrf_scores: HashMap<String, f64> = HashMap::new();
        let mut doc_map: HashMap<String, ScoredDocument> = HashMap::new();

        let lists = [dense_results, lexical_results, graph_results];

        for list in lists {
            for (rank, doc) in list.into_iter().enumerate() {
                let doc_id = doc.id.clone();
                let score_delta = 1.0 / (k + (rank as f64) + 1.0);
                *rrf_scores.entry(doc_id.clone()).or_insert(0.0) += score_delta;
                doc_map.entry(doc_id).or_insert(doc);
            }
        }

        let mut final_results: Vec<ScoredDocument> = rrf_scores
            .into_iter()
            .filter_map(|(id, score)| {
                let mut doc = doc_map.remove(&id)?;
                doc.score = score;
                Some(doc)
            })
            .collect();

        final_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        final_results
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rrf_scoring() {
        let dense = vec![
            ScoredDocument {
                id: "doc1".to_string(),
                title: "Doc 1".to_string(),
                content: "Content 1".to_string(),
                source_path: "p1".to_string(),
                page: Some(1),
                score: 0.9,
            },
            ScoredDocument {
                id: "doc2".to_string(),
                title: "Doc 2".to_string(),
                content: "Content 2".to_string(),
                source_path: "p2".to_string(),
                page: Some(2),
                score: 0.8,
            },
        ];

        let lexical = vec![
            ScoredDocument {
                id: "doc2".to_string(),
                title: "Doc 2".to_string(),
                content: "Content 2".to_string(),
                source_path: "p2".to_string(),
                page: Some(2),
                score: 10.5,
            },
        ];

        let fused = ReciprocalRankFusion::fuse(dense, lexical, vec![], 60.0);
        assert_eq!(fused.len(), 2);
        // doc2 apparaît dans 2 listes -> meilleur score RRF combiné
        assert_eq!(fused[0].id, "doc2");
    }
}
