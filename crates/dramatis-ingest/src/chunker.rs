use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    pub chunk_id: String,
    pub parent_id: String,
    pub source_path: String,
    pub title: String,
    pub content: String,
    pub token_estimate: usize,
    pub breadcrumb: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParentSection {
    pub section_id: String,
    pub source_path: String,
    pub title: String,
    pub full_content: String,
    pub child_chunks: Vec<DocumentChunk>,
}

pub struct HierarchicalChunker {
    pub max_child_chars: usize,
}

impl Default for HierarchicalChunker {
    fn default() -> Self {
        Self {
            max_child_chars: 1200, // ~300-400 tokens
        }
    }
}

impl HierarchicalChunker {
    pub fn new(max_child_chars: usize) -> Self {
        Self { max_child_chars }
    }

    pub fn split_section(
        &self,
        section_id: &str,
        source_path: &str,
        title: &str,
        content: &str,
        breadcrumb: &[String],
    ) -> ParentSection {
        let mut chunks = Vec::new();
        let paragraphs: Vec<&str> = content.split("\n\n").collect();
        let mut current_buf = String::new();
        let mut chunk_idx = 1;

        for p in paragraphs {
            let trimmed = p.trim();
            if trimmed.is_empty() {
                continue;
            }

            if current_buf.len() + trimmed.len() > self.max_child_chars && !current_buf.is_empty() {
                let token_est = current_buf.len() / 4;
                chunks.push(DocumentChunk {
                    chunk_id: format!("{}_chunk_{}", section_id, chunk_idx),
                    parent_id: section_id.to_string(),
                    source_path: source_path.to_string(),
                    title: title.to_string(),
                    content: current_buf.trim().to_string(),
                    token_estimate: token_est,
                    breadcrumb: breadcrumb.to_vec(),
                });
                chunk_idx += 1;
                current_buf.clear();
            }

            if !current_buf.is_empty() {
                current_buf.push_str("\n\n");
            }
            current_buf.push_str(trimmed);
        }

        if !current_buf.is_empty() {
            let token_est = current_buf.len() / 4;
            chunks.push(DocumentChunk {
                chunk_id: format!("{}_chunk_{}", section_id, chunk_idx),
                parent_id: section_id.to_string(),
                source_path: source_path.to_string(),
                title: title.to_string(),
                content: current_buf.trim().to_string(),
                token_estimate: token_est,
                breadcrumb: breadcrumb.to_vec(),
            });
        }

        ParentSection {
            section_id: section_id.to_string(),
            source_path: source_path.to_string(),
            title: title.to_string(),
            full_content: content.to_string(),
            child_chunks: chunks,
        }
    }
}

