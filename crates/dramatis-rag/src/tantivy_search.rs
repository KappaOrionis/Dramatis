use std::path::Path;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy};
use thiserror::Error;

use crate::rrf::ScoredDocument;

#[derive(Error, Debug)]
pub enum TantivyError {
    #[error("Tantivy error: {0}")]
    Tantivy(#[from] tantivy::TantivyError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Query parse error: {0}")]
    Query(#[from] tantivy::query::QueryParserError),
}

pub struct TantivySearchEngine {
    index: Index,
    reader: IndexReader,
    field_id: Field,
    field_title: Field,
    field_content: Field,
    field_source: Field,
    field_page: Field,
}

impl TantivySearchEngine {
    pub fn open_or_create<P: AsRef<Path>>(index_dir: P) -> Result<Self, TantivyError> {
        let dir_path = index_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&dir_path)?;

        let mut schema_builder = Schema::builder();
        let field_id = schema_builder.add_text_field("id", STRING | STORED);
        let field_title = schema_builder.add_text_field("title", TEXT | STORED);
        let field_content = schema_builder.add_text_field("content", TEXT | STORED);
        let field_source = schema_builder.add_text_field("source_path", STRING | STORED);
        let field_page = schema_builder.add_u64_field("page", INDEXED | STORED);
        let schema = schema_builder.build();

        let index = if dir_path.join("meta.json").exists() {
            Index::open_in_dir(&dir_path)?
        } else {
            Index::create_in_dir(&dir_path, schema.clone())?
        };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        Ok(Self {
            index,
            reader,
            field_id,
            field_title,
            field_content,
            field_source,
            field_page,
        })
    }

    pub fn index_document(
        &self,
        id: &str,
        title: &str,
        content: &str,
        source_path: &str,
        page: Option<u32>,
    ) -> Result<(), TantivyError> {
        let mut writer: IndexWriter = self.index.writer(50_000_000)?; // 50MB buffer
        let term = tantivy::Term::from_field_text(self.field_id, id);
        writer.delete_term(term);

        let mut doc = tantivy::TantivyDocument::default();
        doc.add_text(self.field_id, id);
        doc.add_text(self.field_title, title);
        doc.add_text(self.field_content, content);
        doc.add_text(self.field_source, source_path);
        if let Some(p) = page {
            doc.add_u64(self.field_page, p as u64);
        }

        writer.add_document(doc)?;
        writer.commit()?;
        Ok(())
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<ScoredDocument>, TantivyError> {
        let _ = self.reader.reload();
        let searcher = self.reader.searcher();
        let query_parser = QueryParser::for_index(&self.index, vec![self.field_title, self.field_content]);
        
        let query = match query_parser.parse_query(query_str) {
            Ok(q) => q,
            Err(_) => return Ok(Vec::new()),
        };

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;
        let mut results = Vec::new();

        for (score, doc_address) in top_docs {
            let retrieved_doc: tantivy::TantivyDocument = searcher.doc(doc_address)?;
            
            let id = retrieved_doc
                .get_first(self.field_id)
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();
            let title = retrieved_doc
                .get_first(self.field_title)
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();
            let content = retrieved_doc
                .get_first(self.field_content)
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();
            let source_path = retrieved_doc
                .get_first(self.field_source)
                .and_then(|f| f.as_str())
                .unwrap_or("")
                .to_string();
            let page = retrieved_doc
                .get_first(self.field_page)
                .and_then(|f| f.as_u64())
                .map(|p| p as u32);

            results.push(ScoredDocument {
                id,
                title,
                content,
                source_path,
                page,
                score: score as f64,
            });
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tantivy_index_and_search() {
        let tmp = tempfile::tempdir().unwrap();
        let engine = TantivySearchEngine::open_or_create(tmp.path()).unwrap();

        engine
            .index_document(
                "chunk_1",
                "Alliance de Doissetep",
                "L'Alliance de Doissetep est un puissant Covenant hermétique situé dans les Pyrénées.",
                "01_wiki/lieux/doissetep.md",
                Some(14),
            )
            .unwrap();

        let results = engine.search("Doissetep", 5).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "chunk_1");
        assert!(results[0].score > 0.0);
    }
}
