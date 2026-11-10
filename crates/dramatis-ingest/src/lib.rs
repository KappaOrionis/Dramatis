pub mod chunker;
pub mod excel;
pub mod formula_transpiler;
pub mod hasher;
pub mod manifest_sync;
pub mod media;
pub mod parser;
pub mod reconciliation;
pub mod table_proxy;

pub use chunker::{DocumentChunk, HierarchicalChunker, ParentSection};
pub use excel::{ExcelIngestError, ExcelIngestionReport, ExcelTableIngester};
pub use formula_transpiler::FormulaTranspiler;
pub use hasher::{HasherError, SourceHasher};
pub use manifest_sync::{ManifestSyncError, ManifestSyncManager, SyncDecision};
pub use media::{AudioTrackEntry, ImageAssetManifest, MediaIngestError, MultimodalIngester, SoundboardCatalog};
pub use parser::{ExtractedTable, MarkdownDocParser, SectionNode, TableType};
pub use reconciliation::{ChangeType, FieldDiff, ReconciliationDiffEngine, RowDiff, TableDiffReport};
pub use table_proxy::{TableColumnSummary, TableProxyCard, TableProxyGenerator};
