use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TableType {
    CatalogSql,
    DiceTable { min_roll: i64, max_roll: i64 },
    Statblock,
    MicroTable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub table_type: TableType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionNode {
    pub heading_level: u32,
    pub title: String,
    pub content: String,
    pub breadcrumb: Vec<String>,
    pub tables: Vec<ExtractedTable>,
}

pub struct MarkdownDocParser;

impl MarkdownDocParser {
    pub fn parse(markdown_text: &str) -> Vec<SectionNode> {
        let mut options = pulldown_cmark::Options::empty();
        options.insert(pulldown_cmark::Options::ENABLE_TABLES);
        options.insert(pulldown_cmark::Options::ENABLE_YAML_STYLE_METADATA_BLOCKS);
        let parser = Parser::new_ext(markdown_text, options);
        let mut sections: Vec<SectionNode> = Vec::new();

        let mut current_level = 0;
        let mut current_title = String::new();
        let mut current_content = String::new();
        let mut breadcrumb_stack: Vec<(u32, String)> = Vec::new();
        let mut current_tables: Vec<ExtractedTable> = Vec::new();

        let mut in_heading = false;
        let mut in_table = false;
        let mut in_table_head = false;
        let mut current_table_headers = Vec::new();
        let mut current_table_rows = Vec::new();
        let mut current_row = Vec::new();
        let mut current_cell_text = String::new();

        for event in parser {
            match event {
                Event::Start(Tag::Heading { level, .. }) => {
                    // Flush existing section if it has content or title
                    if !current_title.is_empty() || !current_content.trim().is_empty() {
                        let bcrumb: Vec<String> = breadcrumb_stack.iter().map(|(_, t)| t.clone()).collect();
                        sections.push(SectionNode {
                            heading_level: current_level,
                            title: current_title.clone(),
                            content: current_content.trim().to_string(),
                            breadcrumb: bcrumb,
                            tables: std::mem::take(&mut current_tables),
                        });
                        current_content.clear();
                    }

                    let lvl = level as u32;
                    current_level = lvl;
                    in_heading = true;
                    current_title.clear();
                }
                Event::End(TagEnd::Heading(_)) => {
                    in_heading = false;
                    // Maintain breadcrumb stack
                    breadcrumb_stack.retain(|(lvl, _)| *lvl < current_level);
                    breadcrumb_stack.push((current_level, current_title.clone()));
                }
                Event::Start(Tag::Table(_)) => {
                    in_table = true;
                    current_table_headers.clear();
                    current_table_rows.clear();
                }
                Event::End(TagEnd::Table) => {
                    in_table = false;
                    let t_type = classify_table(&current_table_headers, &current_table_rows);
                    current_tables.push(ExtractedTable {
                        headers: current_table_headers.clone(),
                        rows: current_table_rows.clone(),
                        table_type: t_type,
                    });
                }
                Event::Start(Tag::TableHead) => {
                    in_table_head = true;
                }
                Event::End(TagEnd::TableHead) => {
                    in_table_head = false;
                    current_table_headers = current_row.clone();
                    current_row.clear();
                }
                Event::Start(Tag::TableRow) => {
                    current_row.clear();
                }
                Event::End(TagEnd::TableRow) => {
                    if in_table_head {
                        current_table_headers = current_row.clone();
                    } else if in_table && !current_row.is_empty() {
                        current_table_rows.push(current_row.clone());
                    }
                    current_row.clear();
                }
                Event::Start(Tag::TableCell) => {
                    current_cell_text.clear();
                }
                Event::End(TagEnd::TableCell) => {
                    current_row.push(current_cell_text.trim().to_string());
                    current_cell_text.clear();
                }
                Event::Text(txt) => {
                    if in_heading {
                        current_title.push_str(&txt);
                    } else if in_table {
                        current_cell_text.push_str(&txt);
                    } else {
                        current_content.push_str(&txt);
                    }
                }
                _ => {}
            }
        }

        // Flush final section
        if !current_title.is_empty() || !current_content.trim().is_empty() || !current_tables.is_empty() {
            let bcrumb: Vec<String> = breadcrumb_stack.iter().map(|(_, t)| t.clone()).collect();
            sections.push(SectionNode {
                heading_level: current_level,
                title: current_title,
                content: current_content.trim().to_string(),
                breadcrumb: bcrumb,
                tables: current_tables,
            });
        }

        sections
    }
}

fn classify_table(headers: &[String], rows: &[Vec<String>]) -> TableType {
    if headers.is_empty() {
        return TableType::MicroTable;
    }

    let first_hdr = headers[0].to_lowercase();
    if first_hdr.contains("roll") || first_hdr.contains("dé") || first_hdr.contains("1d") || first_hdr.contains("2d") {
        return TableType::DiceTable { min_roll: 1, max_roll: rows.len() as i64 };
    }

    let joined_headers = headers.join(" ").to_lowercase();
    if joined_headers.contains("str") || joined_headers.contains("dex") || joined_headers.contains("bod") || joined_headers.contains("armor") {
        return TableType::Statblock;
    }

    if rows.len() > 3 {
        TableType::CatalogSql
    } else {
        TableType::MicroTable
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_markdown_parser_extracts_hierarchy_and_tables() {
        let md = r#"
# Chapitre 1 : Grimoire
Introduction générale de la magie.

## Sorts Hermétiques
Les formules de base.

| Roll | Effet Magique | Coût |
| :--- | :--- | :--- |
| 1-3 | Étincelle | 1 Vis |
| 4-6 | Flamme Vive | 2 Vis |
| 7-10 | Boule de Feu | 4 Vis |

## Caractéristiques d'un Élémentaire
| STR | DEX | BOD | Armor |
| :--- | :--- | :--- | :--- |
| 15 | 12 | 14 | 3 |
"#;

        let sections = MarkdownDocParser::parse(md);
        assert_eq!(sections.len(), 3);

        assert_eq!(sections[0].title, "Chapitre 1 : Grimoire");
        assert_eq!(sections[1].title, "Sorts Hermétiques");
        assert_eq!(sections[1].breadcrumb, vec!["Chapitre 1 : Grimoire", "Sorts Hermétiques"]);
        assert_eq!(sections[1].tables.len(), 1);
        match sections[1].tables[0].table_type {
            TableType::DiceTable { min_roll, max_roll } => {
                assert_eq!(min_roll, 1);
                assert_eq!(max_roll, 3);
            }
            _ => panic!("Expected DiceTable"),
        }

        assert_eq!(sections[2].title, "Caractéristiques d'un Élémentaire");
        assert_eq!(sections[2].tables[0].table_type, TableType::Statblock);
    }
}
