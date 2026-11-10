pub struct NonDestructiveWikiPatcher;

impl NonDestructiveWikiPatcher {
    /// Met à jour ou insère une section sans jamais écraser les blocs protégés par <!-- LOCKED_BY_USER -->
    pub fn patch_markdown(original: &str, section_title: &str, new_content: &str) -> String {
        // 1. Vérifier si l'ensemble ou la section est verrouillé
        if original.contains("<!-- LOCKED_BY_USER -->") && original.contains(&format!("## {}", section_title)) {
            // Déterminer si le verrou est dans cette section spécifique
            let sections: Vec<&str> = original.split("\n## ").collect();
            let mut patched_sections = Vec::new();

            for (idx, sec) in sections.iter().enumerate() {
                if idx == 0 {
                    patched_sections.push(sec.to_string());
                    continue;
                }

                let lines: Vec<&str> = sec.splitn(2, '\n').collect();
                let current_title = lines[0].trim();
                let current_body = if lines.len() > 1 { lines[1] } else { "" };

                if current_title == section_title {
                    if current_body.contains("<!-- LOCKED_BY_USER -->") {
                        // Section verrouillée -> préserver intacte
                        patched_sections.push(format!("## {}", sec));
                    } else {
                        // Section non-verrouillée -> mise à jour
                        patched_sections.push(format!("## {}\n\n{}", section_title, new_content.trim()));
                    }
                } else {
                    patched_sections.push(format!("## {}", sec));
                }
            }

            return patched_sections.join("\n");
        }

        // Si la section existe déjà sans verrou
        let target_header = format!("## {}", section_title);
        if original.contains(&target_header) {
            let sections: Vec<&str> = original.split("\n## ").collect();
            let mut patched_sections = Vec::new();

            for (idx, sec) in sections.iter().enumerate() {
                if idx == 0 {
                    patched_sections.push(sec.to_string());
                    continue;
                }

                let lines: Vec<&str> = sec.splitn(2, '\n').collect();
                let current_title = lines[0].trim();

                if current_title == section_title {
                    patched_sections.push(format!("## {}\n\n{}", section_title, new_content.trim()));
                } else {
                    patched_sections.push(format!("## {}", sec));
                }
            }

            patched_sections.join("\n")
        } else {
            // Append d'une nouvelle section
            format!("{}\n\n## {}\n\n{}", original.trim_end(), section_title, new_content.trim())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patch_unlocked_section() {
        let original = "# Fiche Lieu\n\n## Histoire\n\nVieille histoire.\n\n## Description\n\nUn lieu sombre.";
        let patched = NonDestructiveWikiPatcher::patch_markdown(original, "Histoire", "Histoire enrichie par le Scribe.");
        assert!(patched.contains("Histoire enrichie par le Scribe."));
        assert!(!patched.contains("Vieille histoire."));
        assert!(patched.contains("Un lieu sombre."));
    }

    #[test]
    fn test_respect_locked_by_user() {
        let original = "# Fiche Lieu\n\n## Histoire\n<!-- LOCKED_BY_USER -->\nHistoire personnalisée par le MJ.\n\n## Description\n\nUn lieu sombre.";
        let patched = NonDestructiveWikiPatcher::patch_markdown(original, "Histoire", "Tentative d'écrasement par l'IA.");
        // Le texte du MJ doit être préservé
        assert!(patched.contains("Histoire personnalisée par le MJ."));
        assert!(!patched.contains("Tentative d'écrasement"));
    }
}
