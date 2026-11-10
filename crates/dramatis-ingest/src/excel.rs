use std::path::Path;
use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::formula_transpiler::FormulaTranspiler;
use crate::table_proxy::{TableProxyCard, TableProxyGenerator};

#[derive(Error, Debug)]
pub enum ExcelIngestError {
    #[error("Calamine error: {0}")]
    Calamine(#[from] calamine::Error),
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Sheet not found: {0}")]
    SheetNotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExcelIngestionReport {
    pub created_tables: Vec<String>,
    pub proxy_cards: Vec<TableProxyCard>,
    pub transpiled_rhai_formulas: Vec<String>,
}

pub struct ExcelTableIngester;

impl ExcelTableIngester {
    pub fn ingest_workbook_to_sqlite<P: AsRef<Path>>(
        excel_path: P,
        sqlite_conn: &mut Connection,
        table_prefix: Option<&str>,
    ) -> Result<Vec<String>, ExcelIngestError> {
        let report = Self::ingest_workbook_full(excel_path, sqlite_conn, table_prefix, None)?;
        Ok(report.created_tables)
    }

    pub fn ingest_workbook_full<P: AsRef<Path>>(
        excel_path: P,
        sqlite_conn: &mut Connection,
        table_prefix: Option<&str>,
        formulas_rhai_out: Option<&Path>,
    ) -> Result<ExcelIngestionReport, ExcelIngestError> {
        let source_file_str = excel_path.as_ref().to_string_lossy().to_string();
        let mut workbook = open_workbook_auto(&excel_path)?;
        let sheet_names = workbook.sheet_names().to_vec();
        let mut created_tables = Vec::new();
        let mut proxy_cards = Vec::new();
        let mut transpiled_rhai_formulas = Vec::new();

        for sheet_name in sheet_names {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                if range.is_empty() {
                    continue;
                }

                let safe_sheet_name = sheet_name
                    .replace(' ', "_")
                    .replace('-', "_")
                    .to_lowercase();
                let table_name = if let Some(prefix) = table_prefix {
                    format!("{}_{}", prefix, safe_sheet_name)
                } else {
                    safe_sheet_name
                };

                let mut rows_iter = range.rows();
                let header_row = match rows_iter.next() {
                    Some(row) => row,
                    None => continue,
                };

                let mut col_names: Vec<String> = Vec::new();
                for (idx, cell) in header_row.iter().enumerate() {
                    let col_name = match cell {
                        Data::String(s) if !s.trim().is_empty() => {
                            s.trim().replace(' ', "_").replace('-', "_").to_lowercase()
                        }
                        _ => format!("col_{}", idx + 1),
                    };
                    col_names.push(col_name);
                }

                if col_names.is_empty() {
                    continue;
                }

                let create_cols = col_names
                    .iter()
                    .map(|name| format!("\"{}\" TEXT", name))
                    .collect::<Vec<_>>()
                    .join(", ");
                let create_sql = format!(
                    "CREATE TABLE IF NOT EXISTS \"{}\" (id INTEGER PRIMARY KEY AUTOINCREMENT, {});",
                    table_name, create_cols
                );
                sqlite_conn.execute(&create_sql, [])?;

                let placeholders = vec!["?"; col_names.len()].join(", ");
                let insert_sql = format!(
                    "INSERT INTO \"{}\" ({}) VALUES ({});",
                    table_name,
                    col_names.iter().map(|n| format!("\"{}\"", n)).collect::<Vec<_>>().join(", "),
                    placeholders
                );

                let mut json_rows: Vec<Vec<serde_json::Value>> = Vec::new();

                let tx = sqlite_conn.transaction()?;
                {
                    let mut stmt = tx.prepare(&insert_sql)?;
                    for row in rows_iter {
                        let mut json_row = Vec::new();
                        let values: Vec<String> = (0..col_names.len())
                            .map(|idx| match row.get(idx) {
                                Some(Data::Int(i)) => {
                                    json_row.push(serde_json::Value::Number((*i).into()));
                                    i.to_string()
                                }
                                Some(Data::Float(f)) => {
                                    if let Some(n) = serde_json::Number::from_f64(*f) {
                                        json_row.push(serde_json::Value::Number(n));
                                    } else {
                                        json_row.push(serde_json::Value::String(f.to_string()));
                                    }
                                    f.to_string()
                                }
                                Some(Data::String(s)) => {
                                    json_row.push(serde_json::Value::String(s.clone()));
                                    s.clone()
                                }
                                Some(Data::Bool(b)) => {
                                    json_row.push(serde_json::Value::Bool(*b));
                                    b.to_string()
                                }
                                _ => {
                                    json_row.push(serde_json::Value::String("".to_string()));
                                    "".to_string()
                                }
                            })
                            .collect();

                        json_rows.push(json_row);

                        let params_refs: Vec<&dyn rusqlite::ToSql> = values
                            .iter()
                            .map(|v| v as &dyn rusqlite::ToSql)
                            .collect();
                        stmt.execute(params_refs.as_slice())?;
                    }
                }
                tx.commit()?;

                // Generate TableProxyCard (ING-06)
                let col_defs: Vec<(&str, &str)> = col_names.iter().map(|c| (c.as_str(), "TEXT")).collect();
                let proxy = TableProxyGenerator::generate_proxy_card(&table_name, &col_defs, &json_rows);

                let _ = sqlite_conn.execute(
                    r#"
                    INSERT INTO table_metadata (table_name, description, source_file, ddl_schema, proxy_markdown, row_count, last_updated)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, strftime('%s','now'))
                    ON CONFLICT(table_name) DO UPDATE SET
                        ddl_schema = excluded.ddl_schema,
                        proxy_markdown = excluded.proxy_markdown,
                        row_count = excluded.row_count,
                        last_updated = strftime('%s','now')
                    "#,
                    params![
                        &table_name,
                        format!("Imported from sheet '{}'", sheet_name),
                        &source_file_str,
                        &proxy.ddl_schema,
                        &proxy.description_markdown,
                        proxy.total_rows as i64
                    ],
                );

                proxy_cards.push(proxy);
                created_tables.push(table_name.clone());

                // Extract Excel cell formulas (ING-05)
                if let Ok(formula_range) = workbook.worksheet_formula(&sheet_name) {
                    for (r_idx, f_row) in formula_range.rows().enumerate() {
                        for (c_idx, expr) in f_row.iter().enumerate() {
                            if !expr.trim().is_empty() {
                                let fn_name = format!("fn_{}_r{}_c{}", table_name, r_idx + 1, c_idx + 1);
                                let rhai_fn = FormulaTranspiler::transpile_formula_to_rhai(&fn_name, &["a1", "b1"], expr);
                                transpiled_rhai_formulas.push(rhai_fn);
                            }
                        }
                    }
                }
            }
        }

        if let Some(rhai_path) = formulas_rhai_out {
            if !transpiled_rhai_formulas.is_empty() {
                if let Some(parent) = rhai_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                let script = transpiled_rhai_formulas.join("\n");
                std::fs::write(rhai_path, script)?;
            }
        }

        Ok(ExcelIngestionReport {
            created_tables,
            proxy_cards,
            transpiled_rhai_formulas,
        })
    }
}
