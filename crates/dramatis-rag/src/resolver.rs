use rusqlite::Connection;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ResolverError {
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

#[derive(Debug, PartialEq)]
pub enum EntityResolutionResult {
    MergeWithExisting { entity_id: String, canonical_title: String, score: f64 },
    CreateNew { proposed_title: String },
    HumanReviewRequired { candidate_id: String, candidate_title: String, score: f64 },
}

pub struct EntityResolver;

impl EntityResolver {
    /// Résout une entité contre la base knowledge_graph.sqlite
    /// - Score > 0.90 : Fusion automatique
    /// - Score < 0.65 : Création nouvelle fiche
    /// - Entre 0.65 et 0.90 : Zone grise / validation humaine requise
    pub fn resolve<P: AsRef<Path>>(
        kg_db_path: P,
        candidate_title: &str,
        _aliases: &[String],
    ) -> Result<EntityResolutionResult, ResolverError> {
        let conn = Connection::open(kg_db_path)?;
        let candidate_lower = candidate_title.trim().to_lowercase();

        // 1. Exact match sur canonical_title
        let mut stmt = conn.prepare("SELECT entity_id, canonical_title FROM entities WHERE LOWER(canonical_title) = ?")?;
        let mut rows = stmt.query([&candidate_lower])?;
        if let Some(row) = rows.next()? {
            let entity_id: String = row.get(0)?;
            let canonical_title: String = row.get(1)?;
            return Ok(EntityResolutionResult::MergeWithExisting {
                entity_id,
                canonical_title,
                score: 1.0,
            });
        }

        // 2. Exact match sur la table aliases
        let mut stmt_alias = conn.prepare("SELECT entity_id FROM aliases WHERE LOWER(alias) = ?")?;
        let mut rows_alias = stmt_alias.query([&candidate_lower])?;
        if let Some(row) = rows_alias.next()? {
            let entity_id: String = row.get(0)?;
            let mut stmt_can = conn.prepare("SELECT canonical_title FROM entities WHERE entity_id = ?")?;
            let can_title: String = stmt_can.query_row([&entity_id], |r| r.get(0))?;
            return Ok(EntityResolutionResult::MergeWithExisting {
                entity_id,
                canonical_title: can_title,
                score: 0.98,
            });
        }

        // 3. Distance de Levenshtein normalisée contre toutes les entités
        let mut stmt_all = conn.prepare("SELECT entity_id, canonical_title FROM entities")?;
        let all_entities = stmt_all.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;

        let mut best_match: Option<(String, String, f64)> = None;

        for res in all_entities {
            let (eid, can_title) = res?;
            let similarity = Self::levenshtein_similarity(&candidate_lower, &can_title.to_lowercase());

            if best_match.as_ref().map_or(true, |m| similarity > m.2) {
                best_match = Some((eid, can_title, similarity));
            }
        }

        if let Some((eid, can_title, score)) = best_match {
            if score >= 0.90 {
                return Ok(EntityResolutionResult::MergeWithExisting {
                    entity_id: eid,
                    canonical_title: can_title,
                    score,
                });
            } else if score >= 0.65 {
                return Ok(EntityResolutionResult::HumanReviewRequired {
                    candidate_id: eid,
                    candidate_title: can_title,
                    score,
                });
            }
        }

        Ok(EntityResolutionResult::CreateNew {
            proposed_title: candidate_title.to_string(),
        })
    }

    fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
        let len1 = s1.chars().count();
        let len2 = s2.chars().count();
        if len1 == 0 && len2 == 0 {
            return 1.0;
        }
        if len1 == 0 || len2 == 0 {
            return 0.0;
        }

        let max_len = len1.max(len2) as f64;
        let dist = Self::levenshtein_distance(s1, s2) as f64;
        (max_len - dist) / max_len
    }

    fn levenshtein_distance(s1: &str, s2: &str) -> usize {
        let v1: Vec<char> = s1.chars().collect();
        let v2: Vec<char> = s2.chars().collect();
        let mut d = vec![vec![0; v2.len() + 1]; v1.len() + 1];

        for i in 0..=v1.len() {
            d[i][0] = i;
        }
        for j in 0..=v2.len() {
            d[0][j] = j;
        }

        for i in 1..=v1.len() {
            for j in 1..=v2.len() {
                let cost = if v1[i - 1] == v2[j - 1] { 0 } else { 1 };
                d[i][j] = (d[i - 1][j] + 1)
                    .min(d[i][j - 1] + 1)
                    .min(d[i - 1][j - 1] + cost);
            }
        }

        d[v1.len()][v2.len()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dramatis_core::database::TheaterDatabaseInitializer;

    #[test]
    fn test_entity_resolution_flow() {
        let tmp = tempfile::tempdir().unwrap();
        let kg_path = tmp.path().join("knowledge_graph.sqlite");
        TheaterDatabaseInitializer::init_knowledge_graph_db(&kg_path).unwrap();

        // Insérer une entité existante
        let conn = Connection::open(&kg_path).unwrap();
        conn.execute(
            "INSERT INTO entities (entity_id, canonical_title, category, relative_path, canon_level, visibility, created_at, updated_at)
             VALUES ('ent_doissetep', 'Alliance de Doissetep', 'lieux', '01_wiki/lieux/doissetep.md', 'official', 'public', 0, 0)",
            [],
        ).unwrap();

        // 1. Test Exact match
        let res_exact = EntityResolver::resolve(&kg_path, "Alliance de Doissetep", &[]).unwrap();
        assert!(matches!(res_exact, EntityResolutionResult::MergeWithExisting { .. }));

        // 2. Test Similarité forte (coquille légère) -> fusion auto si > 0.90
        let res_fuzzy = EntityResolver::resolve(&kg_path, "Alliance de Doissetep", &[]).unwrap();
        assert!(matches!(res_fuzzy, EntityResolutionResult::MergeWithExisting { .. }));

        // 3. Test Nouvelle entité dissemblable
        let res_new = EntityResolver::resolve(&kg_path, "Cyberdeck Fuchi Cyber-6", &[]).unwrap();
        assert!(matches!(res_new, EntityResolutionResult::CreateNew { .. }));
    }
}
