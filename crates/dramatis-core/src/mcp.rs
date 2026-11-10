use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpToolSpec {
    pub agent_id: &'static str,
    pub tool_name: &'static str,
    pub description: &'static str,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
}

pub struct McpRegistry;

impl McpRegistry {
    pub fn list_all_tools() -> Vec<McpToolSpec> {
        vec![
            // 1. L'Archiviste (dramatis.archivist)
            McpToolSpec {
                agent_id: "dramatis.archivist",
                tool_name: "hybrid_search_lore",
                description: "Recherche hybride RRF (Vecteurs + BM25 Tantivy + Graphe) filtrée par ACL avec citations strictes.",
                input_schema: json!({
                    "type": "object",
                    "required": ["query", "role"],
                    "properties": {
                        "query": { "type": "string" },
                        "role": { "type": "string", "enum": ["gm", "player", "spectator"] },
                        "actor_id": { "type": "string" },
                        "top_k": { "type": "integer", "default": 5 }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["citations", "silence_declared"],
                    "properties": {
                        "citations": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["source", "excerpt", "score"],
                                "properties": {
                                    "source": { "type": "string" },
                                    "page": { "type": "integer" },
                                    "excerpt": { "type": "string" },
                                    "score": { "type": "number" }
                                }
                            }
                        },
                        "silence_declared": { "type": "boolean" }
                    }
                }),
            },

            // 2. Le Scribe (dramatis.scribe)
            McpToolSpec {
                agent_id: "dramatis.scribe",
                tool_name: "resolve_and_patch_wiki",
                description: "Résout une entité anti-doublon, applique l'Auto-Wikilinker Aho-Corasick et met à jour le Wiki sans toucher aux sections LOCKED_BY_USER.",
                input_schema: json!({
                    "type": "object",
                    "required": ["entity_title", "category", "markdown_delta"],
                    "properties": {
                        "entity_title": { "type": "string" },
                        "category": { "type": "string", "enum": ["histoire", "lieux", "pnj", "bestiaire", "factions", "objets", "concepts"] },
                        "aliases": { "type": "array", "items": { "type": "string" } },
                        "markdown_delta": { "type": "string" }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["action_taken", "canonical_path", "links_injected"],
                    "properties": {
                        "action_taken": { "type": "string", "enum": ["merged", "created", "queued_for_review"] },
                        "canonical_path": { "type": "string" },
                        "links_injected": { "type": "integer" }
                    }
                }),
            },

            // 3. Le Légiste (dramatis.arbiter)
            McpToolSpec {
                agent_id: "dramatis.arbiter",
                tool_name: "evaluate_mechanical_intent",
                description: "Évalue de manière 100% déterministe une intention d'action via la sandbox Rhai, les tables SQLite et le moteur de dés.",
                input_schema: json!({
                    "type": "object",
                    "required": ["actor_id", "intent_type", "formula_or_roll"],
                    "properties": {
                        "actor_id": { "type": "string" },
                        "intent_type": { "type": "string" },
                        "formula_or_roll": { "type": "string" },
                        "zone_modifiers": { "type": "array", "items": { "type": "integer" } }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["verdict", "total_score", "is_critical", "audit_trace"],
                    "properties": {
                        "verdict": { "type": "string", "enum": ["critical_success", "success", "failure", "botch_or_glitch"] },
                        "total_score": { "type": "integer" },
                        "is_critical": { "type": "boolean" },
                        "audit_trace": { "type": "string" }
                    }
                }),
            },

            // 4. L'Intendant (dramatis.steward)
            McpToolSpec {
                agent_id: "dramatis.steward",
                tool_name: "mutate_persona_state",
                description: "Applique une mutation validée (dégâts, Essence, XP, Vis, création de sort/artefact) sur persona.json et régénère persona.md.",
                input_schema: json!({
                    "type": "object",
                    "required": ["persona_id", "mutation_type"],
                    "properties": {
                        "persona_id": { "type": "string" },
                        "mutation_type": { "type": "string", "enum": ["apply_damage", "spend_xp", "update_essence", "craft_item"] },
                        "monitor_name": { "type": "string" },
                        "amount": { "type": "number" }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["updated", "active_penalty", "markdown_synced"],
                    "properties": {
                        "updated": { "type": "boolean" },
                        "active_penalty": { "type": "integer" },
                        "markdown_synced": { "type": "boolean" }
                    }
                }),
            },

            // 5. Le Dramaturge (dramatis.playwright)
            McpToolSpec {
                agent_id: "dramatis.playwright",
                tool_name: "advance_scene_clock",
                description: "Met à jour une horloge scénaristique (ex: Alerte Corpo) et déclenche les noeuds d'événements liés dans campaign_manifest.json.",
                input_schema: json!({
                    "type": "object",
                    "required": ["clock_id", "delta_segments"],
                    "properties": {
                        "clock_id": { "type": "string" },
                        "delta_segments": { "type": "integer" }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["current_value", "max_segments", "triggered_event"],
                    "properties": {
                        "current_value": { "type": "integer" },
                        "max_segments": { "type": "integer" },
                        "triggered_event": { "type": "string" }
                    }
                }),
            },

            // 6. Le Metteur en Scène (dramatis.director)
            McpToolSpec {
                agent_id: "dramatis.director",
                tool_name: "frame_scene_narration",
                description: "Traduit littérairement le verdict du Légiste, met à jour l'ambiance audio Vox et publie dans le canal de Zone actif.",
                input_schema: json!({
                    "type": "object",
                    "required": ["zone_id", "verdict_ref", "narration_fr"],
                    "properties": {
                        "zone_id": { "type": "string" },
                        "verdict_ref": { "type": "string" },
                        "narration_fr": { "type": "string" },
                        "ambient_track": { "type": "string" }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["broadcasted", "channel"],
                    "properties": {
                        "broadcasted": { "type": "boolean" },
                        "channel": { "type": "string" }
                    }
                }),
            },

            // 7. L'Acteur Bot (dramatis.actor)
            McpToolSpec {
                agent_id: "dramatis.actor",
                tool_name: "declare_actor_turn",
                description: "Permet à un Bot PJ/PNJ d'exprimer une réplique RP et de soumettre une [Intention Mécanique] sous son filtre AgentContextView.",
                input_schema: json!({
                    "type": "object",
                    "required": ["actor_id", "channel", "dialogue_fr"],
                    "properties": {
                        "actor_id": { "type": "string" },
                        "channel": { "type": "string" },
                        "dialogue_fr": { "type": "string" },
                        "mechanical_intent": { "type": "string" }
                    }
                }),
                output_schema: json!({
                    "type": "object",
                    "required": ["accepted", "requires_arbiter"],
                    "properties": {
                        "accepted": { "type": "boolean" },
                        "requires_arbiter": { "type": "boolean" }
                    }
                }),
            },
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_registry_covers_all_7_agents() {
        let tools = McpRegistry::list_all_tools();
        assert_eq!(tools.len(), 7);
        let agents: Vec<&str> = tools.iter().map(|t| t.agent_id).collect();
        assert!(agents.contains(&"dramatis.archivist"));
        assert!(agents.contains(&"dramatis.scribe"));
        assert!(agents.contains(&"dramatis.arbiter"));
        assert!(agents.contains(&"dramatis.steward"));
        assert!(agents.contains(&"dramatis.playwright"));
        assert!(agents.contains(&"dramatis.director"));
        assert!(agents.contains(&"dramatis.actor"));
    }
}

