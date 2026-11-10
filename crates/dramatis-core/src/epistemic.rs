use crate::acl::Role;
use regex::Regex;

pub struct EpistemicFilter;

impl EpistemicFilter {
    /// Filtre le contenu Markdown selon le rôle du lecteur.
    /// Expurge les blocs secrets `:::secret [...]` pour les non-MJ et les joueurs non autorisés.
    pub fn sanitize_markdown(content: &str, role: Role, current_actor_id: Option<&str>) -> String {
        if role == Role::Gm {
            return content.to_string();
        }

        // 1. Détecter les blocs :::secret [actors: id1, id2] ... :::
        let re_targeted = Regex::new(r"(?s):::secret\s*\[actors:\s*([^\]]+)\]\s*(.*?):::").unwrap();
        let intermediate = re_targeted.replace_all(content, |caps: &regex::Captures| {
            let allowed_actors = &caps[1];
            let secret_body = &caps[2];

            if let Some(actor_id) = current_actor_id {
                let is_allowed = allowed_actors
                    .split(',')
                    .map(|s| s.trim())
                    .any(|a| a == actor_id);

                if is_allowed {
                    return secret_body.trim().to_string();
                }
            }
            "".to_string()
        });

        // 2. Détecter les blocs secrets génériques :::secret ... ::: (GM only)
        let re_generic = Regex::new(r"(?s):::secret\s*(.*?):::").unwrap();
        let cleaned = re_generic.replace_all(&intermediate, "");

        cleaned.trim().to_string()
    }

    /// Génère un Handout HTML autonome imprimable en PDF pour les joueurs
    pub fn render_handout_html(title: &str, markdown_content: &str, role: Role, actor_id: Option<&str>) -> String {
        let clean_md = Self::sanitize_markdown(markdown_content, role, actor_id);
        
        format!(
            r#"<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Dossier de Briefing : {}</title>
    <style>
        body {{
            font-family: 'EB Garamond', Georgia, serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #1a1a1a;
            line-height: 1.6;
            background: #fff;
        }}
        h1, h2, h3 {{ font-family: 'Cinzel', serif; color: #222; border-bottom: 1px solid #ccc; padding-bottom: 6px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .meta {{ font-size: 0.85rem; color: #666; font-style: italic; }}
        @media print {{
            body {{ margin: 0; padding: 15mm; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{}</h1>
        <div class="meta">Dossier de Briefing Dramatis — Accès : {:?}</div>
    </div>
    <div class="content">
        <pre style="white-space: pre-wrap; font-family: inherit;">{}</pre>
    </div>
</body>
</html>"#,
            title, title, role, clean_md
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_epistemic_secret_redaction() {
        let raw = "Lore public.\n:::secret\nPlan machiavélique du Boss.\n:::\nFin du rapport.";
        
        let player_view = EpistemicFilter::sanitize_markdown(raw, Role::Player, Some("kenshi"));
        assert!(player_view.contains("Lore public."));
        assert!(!player_view.contains("Plan machiavélique"));
        assert!(player_view.contains("Fin du rapport."));

        let gm_view = EpistemicFilter::sanitize_markdown(raw, Role::Gm, None);
        assert!(gm_view.contains("Plan machiavélique"));
    }

    #[test]
    fn test_targeted_secrets() {
        let raw = "Mission.\n:::secret [actors: kenshi, lucius]\nCode secret de la grille: 4780\n:::\nSuite.";
        
        let kenshi_view = EpistemicFilter::sanitize_markdown(raw, Role::Player, Some("kenshi"));
        assert!(kenshi_view.contains("Code secret de la grille: 4780"));

        let bob_view = EpistemicFilter::sanitize_markdown(raw, Role::Player, Some("bob"));
        assert!(!bob_view.contains("Code secret de la grille: 4780"));
    }
}
