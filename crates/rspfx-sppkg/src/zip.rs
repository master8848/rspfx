use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::path::Path;
use regex::Regex;

pub struct ValidationResult {
    pub ok: bool,
    pub errors: Vec<String>,
}

pub fn validate_sppkg(path: &Path) -> ValidationResult {
    let mut errors = Vec::new();
    let data = match std::fs::read(path) {
        Ok(d) => d,
        Err(e) => return ValidationResult { ok: false, errors: vec![e.to_string()] },
    };
    let reader = Cursor::new(data);
    let mut archive = match zip::ZipArchive::new(reader) {
        Ok(a) => a,
        Err(e) => return ValidationResult { ok: false, errors: vec![e.to_string()] },
    };
    let mut names = HashSet::new();
    for i in 0..archive.len() {
        if let Ok(f) = archive.by_index(i) {
            names.insert(f.name().to_string());
        }
    }
    for required in ["[Content_Types].xml", "_rels/.rels", "AppManifest.xml"] {
        if !names.contains(required) {
            errors.push(format!("Missing required entry '{required}'"));
        }
    }
    let feature_re = Regex::new(r"^feature_[0-9a-fA-F-]+\.xml$").unwrap();
    if !names.iter().any(|n| feature_re.is_match(n)) {
        errors.push("Missing required feature manifest entry (feature_<id>.xml)".to_string());
    }
    let elem_re = Regex::new(r"(?:^|/)(?:WebPart|Extension|AdaptiveCardExtension|Library)_[0-9a-fA-F-]+\.xml$").unwrap();
    if !names.iter().any(|n| elem_re.is_match(n)) {
        errors.push("Missing required component element manifest entry (<featureId>/<ComponentType>_<componentId>.xml)".to_string());
    }
    ValidationResult { ok: errors.is_empty(), errors }
}

pub fn build_package(entries: Vec<(String, Vec<u8>)>, level: u8) -> Result<Vec<u8>, String> {
    let mut seen = HashSet::new();
    for (name, _) in &entries {
        if !seen.insert(name.clone()) {
            return Err(format!("Duplicate zip entry name '{name}' — the .sppkg would be corrupt."));
        }
        if name.contains("..") || name.starts_with('/') {
            return Err(format!("Invalid zip path '{name}'"));
        }
    }
    let mut sorted = entries;
    sorted.sort_by(|a, b| a.0.cmp(&b.0));
    let buf = Vec::new();
    let cursor = Cursor::new(buf);
    let mut writer = zip::ZipWriter::new(cursor);
    let options: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
        .compression_method(if level == 0 { zip::CompressionMethod::Stored } else { zip::CompressionMethod::Deflated })
        .compression_level(Some(level as i64));
    for (name, data) in sorted {
        writer.start_file(name, options.clone()).map_err(|e| e.to_string())?;
        use std::io::Write;
        writer.write_all(&data).map_err(|e| e.to_string())?;
    }
    let cursor = writer.finish().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

pub fn read_zip_entries(path: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    let reader = Cursor::new(data);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        out.push((file.name().to_string(), buf));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn duplicate_detected() {
        let e = build_package(vec![("a.txt".to_string(), vec![1]), ("a.txt".to_string(), vec![2])], 9);
        assert!(e.is_err());
    }
    #[test]
    fn roundtrip() {
        let data = build_package(vec![("b.txt".to_string(), b"hello".to_vec()), ("a.txt".to_string(), b"world".to_vec())], 6).unwrap();
        let cursor = Cursor::new(data);
        let mut archive = zip::ZipArchive::new(cursor).unwrap();
        let mut names: Vec<String> = (0..archive.len()).map(|i| archive.by_index(i).unwrap().name().to_string()).collect();
        names.sort();
        assert_eq!(names, vec!["a.txt", "b.txt"]);
    }
}
