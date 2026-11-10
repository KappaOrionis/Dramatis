use std::path::Path;
use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::Connection;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ExcelIngestError {
    #[error("Calamine error: {0}")]
    Calamine(#[from] calamine::Error),
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Sheet not found: {0}")]
    SheetNotFound(String),
}

pub struct ExcelTableIngester;

impl ExcelTableIngester {
    pub fn ingest_workbook_to_sqlite<P: AsRef<Path>>(
        excel_path: P,
        sqlite_conn: &mut Connection,
        table_prefix: Option<&str>,
    ) -> Result<Vec<String>, ExcelIngestError> {
        let mut workbook = open_workbook_auto(excel_path)?;
        let sheet_names = workbook.sheet_names().to_vec();
        let mut created_tables = Vec::new();

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

                let tx = sqlite_conn.transaction()?;
                {
                    let mut stmt = tx.prepare(&insert_sql)?;
                    for row in rows_iter {
                        let values: Vec<String> = (0..col_names.len())
                            .map(|idx| match row.get(idx) {
                                Some(Data::Int(i)) => i.to_string(),
                                Some(Data::Float(f)) => f.to_string(),
                                Some(Data::String(s)) => s.clone(),
                                Some(Data::Bool(b)) => b.to_string(),
                                _ => "".to_string(),
                            })
                            .collect();

                        let params_refs: Vec<&dyn rusqlite::ToSql> = values
                            .iter()
                            .map(|v| v as &dyn rusqlite::ToSql)
                            .collect();
                        stmt.execute(params_refs.as_slice())?;
                    }
                }
                tx.commit()?;
                created_tables.push(table_name);
            }
        }

        Ok(created_tables)
    }
}
