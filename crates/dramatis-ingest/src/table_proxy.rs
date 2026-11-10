use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableColumnSummary {
    pub name: String,
    pub col_type: String,
    pub sample_values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableProxyCard {
    pub table_name: String,
    pub total_rows: usize,
    pub columns: Vec<TableColumnSummary>,
    pub sample_records_json: Vec<serde_json::Value>,
    pub ddl_schema: String,
    pub description_markdown: String,
}

pub struct TableProxyGenerator;

impl TableProxyGenerator {
    pub fn generate_proxy_card(
        table_name: &str,
        columns: &[(&str, &str)], // (col_name, col_type)
        rows: &[Vec<serde_json::Value>],
    ) -> TableProxyCard {
        let mut ddl = format!("CREATE TABLE {} (\n", table_name);
        let mut col_summaries = Vec::new();

        for (idx, (name, col_type)) in columns.iter().enumerate() {
            let comma = if idx + 1 < columns.len() { "," } else { "" };
            ddl.push_str(&format!("  {} {}{}\n", name, col_type, comma));

            let samples: Vec<String> = rows
                .iter()
                .filter_map(|r| r.get(idx))
                .take(3)
                .map(|v| match v {
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .collect();

            col_summaries.push(TableColumnSummary {
                name: name.to_string(),
                col_type: col_type.to_string(),
                sample_values: samples,
            });
        }
        ddl.push_str(");");

        let sample_json_records: Vec<serde_json::Value> = rows
            .iter()
            .take(3)
            .map(|r| {
                let mut map = serde_json::Map::new();
                for (idx, (name, _)) in columns.iter().enumerate() {
                    if let Some(val) = r.get(idx) {
                        map.insert(name.to_string(), val.clone());
                    }
                }
                serde_json::Value::Object(map)
            })
            .collect();

        let mut md = format!(
            "# Table Proxy : `{}`\n\n**Total Lignes** : {}\n\n### Colonnes\n\n",
            table_name,
            rows.len()
        );
        for col in &col_summaries {
            md.push_str(&format!(
                "- **{}** (`{}`) — Exemples : `{}`\n",
                col.name,
                col.col_type,
                col.sample_values.join("`, `")
            ));
        }
        md.push_str(&format!("\n### DDL SQL\n```sql\n{}\n```\n", ddl));

        TableProxyCard {
            table_name: table_name.to_string(),
            total_rows: rows.len(),
            columns: col_summaries,
            sample_records_json: sample_json_records,
            ddl_schema: ddl,
            description_markdown: md,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_proxy_generation() {
        let cols = vec![
            ("weapon_id", "TEXT"),
            ("damage_rating", "INTEGER"),
            ("concealability", "INTEGER"),
        ];
        let rows = vec![
            vec![
                serde_json::Value::String("ares_predator_vi".to_string()),
                serde_json::Value::Number(3.into()),
                serde_json::Value::Number((-2).into()),
            ],
            vec![
                serde_json::Value::String("colt_america".to_string()),
                serde_json::Value::Number(2.into()),
                serde_json::Value::Number(0.into()),
            ],
        ];

        let proxy = TableProxyGenerator::generate_proxy_card("weapons_catalog", &cols, &rows);
        assert_eq!(proxy.table_name, "weapons_catalog");
        assert_eq!(proxy.total_rows, 2);
        assert_eq!(proxy.columns.len(), 3);
        assert!(proxy.ddl_schema.contains("CREATE TABLE weapons_catalog"));
        assert!(proxy.description_markdown.contains("Table Proxy : `weapons_catalog`"));
        assert!(proxy.description_markdown.contains("ares_predator_vi"));
    }
}
