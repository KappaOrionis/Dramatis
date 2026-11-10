use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use sha2::{Digest, Sha256};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HasherError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct SourceHasher;

impl SourceHasher {
    pub fn compute_sha256<P: AsRef<Path>>(path: P) -> Result<String, HasherError> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut hasher = Sha256::new();
        let mut buffer = [0; 8192];

        loop {
            let count = reader.read(&mut buffer)?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }

        let hash_bytes = hasher.finalize();
        Ok(hex::encode(hash_bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_compute_sha256() {
        let mut tmp_file = tempfile::NamedTempFile::new().unwrap();
        write!(tmp_file, "Dramatis Lore Testing Content").unwrap();
        let hash = SourceHasher::compute_sha256(tmp_file.path()).unwrap();
        assert_eq!(hash.len(), 64);
    }
}

