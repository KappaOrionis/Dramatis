use aho_corasick::{AhoCorasick, MatchKind};
use std::collections::HashMap;

pub struct AutoWikilinker {
    ac: AhoCorasick,
    // alias -> canonical title
    canonical_map: HashMap<String, String>,
}

impl AutoWikilinker {
    pub fn new(entries: HashMap<String, Vec<String>>) -> Self {
        let mut patterns = Vec::new();
        let mut canonical_map = HashMap::new();

        for (canonical, aliases) in entries {
            patterns.push(canonical.clone());
            canonical_map.insert(canonical.to_lowercase(), canonical.clone());

            for alias in aliases {
                patterns.push(alias.clone());
                canonical_map.insert(alias.to_lowercase(), canonical.clone());
            }
        }

        // Tri décroissant pour faire correspondre les mentions les plus longues en premier
        patterns.sort_by(|a, b| b.len().cmp(&a.len()));

        let ac = AhoCorasick::builder()
            .match_kind(MatchKind::LeftmostLongest)
            .build(&patterns)
            .expect("Failed to build Aho-Corasick automaton");

        Self {
            ac,
            canonical_map,
        }
    }

    pub fn link_text(&self, input: &str) -> String {
        let mut result = String::new();
        let mut last_idx = 0;

        for mat in self.ac.find_iter(input) {
            let start = mat.start();
            let end = mat.end();

            // Vérifier si la mention n'est pas déjà dans un lien [[...]]
            if self.is_inside_brackets(input, start) {
                continue;
            }

            result.push_str(&input[last_idx..start]);
            let matched_text = &input[start..end];
            let matched_lower = matched_text.to_lowercase();

            if let Some(canonical) = self.canonical_map.get(&matched_lower) {
                if canonical == matched_text {
                    result.push_str(&format!("[[{}]]", canonical));
                } else {
                    result.push_str(&format!("[[{}|{}]]", canonical, matched_text));
                }
            } else {
                result.push_str(matched_text);
            }

            last_idx = end;
        }

        result.push_str(&input[last_idx..]);
        result
    }

    fn is_inside_brackets(&self, text: &str, pos: usize) -> bool {
        let prefix = &text[..pos];
        let open_brackets = prefix.matches("[[").count();
        let close_brackets = prefix.matches("]]").count();
        open_brackets > close_brackets
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_autowikilinker() {
        let mut entries = HashMap::new();
        entries.insert("Alliance de Doissetep".to_string(), vec!["Doissetep".to_string()]);
        entries.insert("Lucius".to_string(), vec![]);

        let linker = AutoWikilinker::new(entries);
        let raw = "Lucius voyagea vers Doissetep pour rejoindre l'Alliance de Doissetep.";
        let linked = linker.link_text(raw);

        assert!(linked.contains("[[Lucius]]"));
        assert!(linked.contains("[[Alliance de Doissetep|Doissetep]]"));
        assert!(linked.contains("[[Alliance de Doissetep]]"));
    }
}
