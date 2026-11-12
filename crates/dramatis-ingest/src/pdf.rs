use std::path::Path;
use anyhow::{Context, Result};

pub struct PdfDocParser;

impl PdfDocParser {
    /// Extracts raw plain text from a PDF file using `pdf-extract`.
    pub fn extract_text<P: AsRef<Path>>(path: P) -> Result<String> {
        let p = path.as_ref();
        pdf_extract::extract_text(p)
            .with_context(|| format!("Failed to extract text from PDF: {}", p.display()))
    }

    /// Extracts raw text from an in-memory byte buffer of a PDF.
    pub fn extract_text_from_bytes(bytes: &[u8]) -> Result<String> {
        pdf_extract::extract_text_from_mem(bytes)
            .context("Failed to extract text from in-memory PDF bytes")
    }
}

