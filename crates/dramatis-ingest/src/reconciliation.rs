use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChangeType {
    Added,
    Modified,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDiff {
    pub field_name: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RowDiff {
    pub primary_key: String,
    pub change_type: ChangeType,
    pub field_diffs: Vec<FieldDiff>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableDiffReport {
    pub table_name: String,
    pub rows_added: usize,
    pub rows_modified: usize,
    pub rows_deleted: usize,
    pub impacted_characters: Vec<String>,
    pub detailed_diffs: Vec<RowDiff>,
}

pub struct ReconciliationDiffEngine;

impl ReconciliationDiffEngine {
    pub fn compute_table_diff(
        table_name: &str,
        primary_key_col: &str,
        old_rows: &[HashMap<String, String>],
        new_rows: &[HashMap<String, String>],
        character_dependencies: &HashMap<String, Vec<String>>, // row_pk -> [character_ids]
    ) -> TableDiffReport {
        let old_map: HashMap<&str, &HashMap<String, String>> = old_rows
            .iter()
            .filter_map(|r| r.get(primary_key_col).map(|pk| (pk.as_str(), r)))
            .collect();

        let new_map: HashMap<&str, &HashMap<String, String>> = new_rows
            .iter()
            .filter_map(|r| r.get(primary_key_col).map(|pk| (pk.as_str(), r)))
            .collect();

        let mut rows_added = 0;
        let mut rows_modified = 0;
        let mut rows_deleted = 0;
        let mut detailed_diffs = Vec::new();
        let mut impacted_set = std::collections::HashSet::new();

        // 1. Check for additions and modifications
        for (&pk, &new_row) in &new_map {
            if let Some(&old_row) = old_map.get(pk) {
                // Check if fields differ
                let mut field_diffs = Vec::new();
                for (k, new_val) in new_row {
                    let old_val = old_row.get(k);
                    if old_val != Some(new_val) {
                        field_diffs.push(FieldDiff {
                            field_name: k.clone(),
                            old_value: old_val.cloned(),
                            new_value: Some(new_val.clone()),
                        });
                    }
                }
                if !field_diffs.is_empty() {
                    rows_modified += 1;
                    if let Some(chars) = character_dependencies.get(pk) {
                        for c in chars {
                            impacted_set.insert(c.clone());
                        }
                    }
                    detailed_diffs.push(RowDiff {
                        primary_key: pk.to_string(),
                        change_type: ChangeType::Modified,
                        field_diffs,
                    });
                }
            } else {
                // Added
                rows_added += 1;
                let field_diffs = new_row
                    .iter()
                    .map(|(k, v)| FieldDiff {
                        field_name: k.clone(),
                        old_value: None,
                        new_value: Some(v.clone()),
                    })
                    .collect();
                detailed_diffs.push(RowDiff {
                    primary_key: pk.to_string(),
                    change_type: ChangeType::Added,
                    field_diffs,
                });
            }
        }

        // 2. Check for deletions
        for (&pk, &old_row) in &old_map {
            if !new_map.contains_key(pk) {
                rows_deleted += 1;
                if let Some(chars) = character_dependencies.get(pk) {
                    for c in chars {
                        impacted_set.insert(c.clone());
                    }
                }
                let field_diffs = old_row
                    .iter()
                    .map(|(k, v)| FieldDiff {
                        field_name: k.clone(),
                        old_value: Some(v.clone()),
                        new_value: None,
                    })
                    .collect();
                detailed_diffs.push(RowDiff {
                    primary_key: pk.to_string(),
                    change_type: ChangeType::Deleted,
                    field_diffs,
                });
            }
        }

        let mut impacted_characters: Vec<String> = impacted_set.into_iter().collect();
        impacted_characters.sort();

        TableDiffReport {
            table_name: table_name.to_string(),
            rows_added,
            rows_modified,
            rows_deleted,
            impacted_characters,
            detailed_diffs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconciliation_diff_detects_changes_and_impact() {
        let mut row1 = HashMap::new();
        row1.insert("id".to_string(), "spell_fireball".to_string());
        row1.insert("cost".to_string(), "5".to_string());

        let mut row2 = HashMap::new();
        row2.insert("id".to_string(), "spell_teleport".to_string());
        row2.insert("cost".to_string(), "10".to_string());

        let old_rows = vec![row1, row2];

        // Modified fireball cost 5 -> 7, deleted teleport, added shield
        let mut row1_mod = HashMap::new();
        row1_mod.insert("id".to_string(), "spell_fireball".to_string());
        row1_mod.insert("cost".to_string(), "7".to_string());

        let mut row3_new = HashMap::new();
        row3_new.insert("id".to_string(), "spell_shield".to_string());
        row3_new.insert("cost".to_string(), "3".to_string());

        let new_rows = vec![row1_mod, row3_new];

        let mut deps = HashMap::new();
        deps.insert("spell_fireball".to_string(), vec!["mage_flambeau".to_string()]);
        deps.insert("spell_teleport".to_string(), vec!["mage_mercurian".to_string()]);

        let report = ReconciliationDiffEngine::compute_table_diff(
            "spells",
            "id",
            &old_rows,
            &new_rows,
            &deps,
        );

        assert_eq!(report.rows_added, 1);
        assert_eq!(report.rows_modified, 1);
        assert_eq!(report.rows_deleted, 1);
        assert_eq!(report.impacted_characters, vec!["mage_flambeau", "mage_mercurian"]);
    }
}
