use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub source_file: String,
    pub page_number: Option<u32>,
    pub line_number: Option<usize>,
    pub snippet: String,
}

impl Citation {
    pub fn new(source_file: &str, page_number: Option<u32>, snippet: &str) -> Self {
        Self {
            source_file: source_file.to_string(),
            page_number,
            line_number: None,
            snippet: snippet.to_string(),
        }
    }

    pub fn with_line(source_file: &str, page_number: Option<u32>, line_number: Option<usize>, snippet: &str) -> Self {
        Self {
            source_file: source_file.to_string(),
            page_number,
            line_number,
            snippet: snippet.to_string(),
        }
    }

    pub fn format_citation(&self) -> String {
        match (self.page_number, self.line_number) {
            (Some(p), Some(l)) => format!("[{}, p. {}, l. {}]", self.source_file, p, l),
            (Some(p), None) => format!("[{}, p. {}]", self.source_file, p),
            (None, Some(l)) => format!("[{}, l. {}]", self.source_file, l),
            (None, None) => format!("[{}]", self.source_file),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivistVerdict {
    pub query: String,
    pub found_facts: bool,
    pub answer: String,
    pub citations: Vec<Citation>,
    pub documentary_silence: bool,
}

pub struct ArchivistAgent;

impl ArchivistAgent {
    pub fn answer_query(
        query: &str,
        citations: Vec<Citation>,
        answer_text: Option<&str>,
    ) -> ArchivistVerdict {
        if citations.is_empty() {
            // Document silence declaration (WIK-02 requirement)
            ArchivistVerdict {
                query: query.to_string(),
                found_facts: false,
                answer: format!(
                    "Silence documentaire avéré : aucune source canonique ou note de wiki n'atteste d'information pour la requête '{}'. Aucun fait ne sera inventé.",
                    query
                ),
                citations: Vec::new(),
                documentary_silence: true,
            }
        } else {
            let formatted_citations: Vec<String> = citations.iter().map(|c| c.format_citation()).collect();
            let citations_suffix = formatted_citations.join(", ");
            let base_answer = answer_text.unwrap_or("Information validée par les archives de campagne.");
            let full_answer = format!("{} (Sources: {})", base_answer, citations_suffix);

            ArchivistVerdict {
                query: query.to_string(),
                found_facts: true,
                answer: full_answer,
                citations,
                documentary_silence: false,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_archivist_documentary_silence() {
        let verdict = ArchivistAgent::answer_query("Origine du dragon inconnu", Vec::new(), None);
        assert!(!verdict.found_facts);
        assert!(verdict.documentary_silence);
        assert!(verdict.answer.contains("Silence documentaire avéré"));
    }

    #[test]
    fn test_archivist_with_citations() {
        let citations = vec![
            Citation::new("Ars_Magica_5th_Ed.pdf", Some(42), "Aura Divine et Faerique"),
            Citation::new("/01_wiki/locations/doissetep.md", None, "Fondation du Covenant"),
        ];

        let verdict = ArchivistAgent::answer_query(
            "Règles d'Aura à Doissetep",
            citations,
            Some("L'aura magique locale est de niveau 5."),
        );

        assert!(verdict.found_facts);
        assert!(!verdict.documentary_silence);
        assert!(verdict.answer.contains("[Ars_Magica_5th_Ed.pdf, p. 42]"));
        assert!(verdict.answer.contains("[/01_wiki/locations/doissetep.md]"));
    }
}

