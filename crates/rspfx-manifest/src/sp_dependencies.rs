use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct SpDependency {
    pub id: String,
    pub version: String,
    pub manifest_path: String,
}

fn find_dist_manifest(pkg_dir: &Path) -> Option<PathBuf> {
    let dist_dir = pkg_dir.join("dist");
    let entries = std::fs::read_dir(&dist_dir).ok()?;
    let mut manifests: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.file_name().and_then(|n| n.to_str()).map_or(false, |n| n.ends_with(".manifest.json") && !n.starts_with('.')))
        .collect();
    manifests.sort();
    manifests.into_iter().next()
}

pub fn find_sp_dependencies(project_root: &Path) -> HashMap<String, SpDependency> {
    let mut deps = HashMap::new();
    let microsoft_dir = project_root.join("node_modules/@microsoft");
    let entries = match std::fs::read_dir(&microsoft_dir) {
        Ok(e) => e,
        Err(_) => return deps,
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let ft = match entry.file_type() { Ok(f) => f, Err(_) => continue };
        if (!ft.is_dir() && !ft.is_symlink()) || entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let pkg_dir = entry.path();
        let pkg_json_path = pkg_dir.join("package.json");
        let pkg_name = std::fs::read_to_string(&pkg_json_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
            .and_then(|v| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .filter(|n| n.starts_with("@microsoft/"))
            .unwrap_or_else(|| format!("@microsoft/{}", entry.file_name().to_string_lossy()));
        if let Some(manifest_path) = find_dist_manifest(&pkg_dir) {
            if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let (Some(id), Some(ver)) = (val.get("id").and_then(|v| v.as_str()), val.get("version").and_then(|v| v.as_str())) {
                        deps.insert(pkg_name, SpDependency { id: id.to_string(), version: ver.to_string(), manifest_path: manifest_path.to_string_lossy().to_string() });
                    }
                }
            }
        }
    }
    deps
}

pub fn glob_manifests_version() -> &'static str {
    "1.0"
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_without_node_modules() {
        let deps = find_sp_dependencies(Path::new("/tmp/nonexistent-dir-xyz"));
        assert!(deps.is_empty());
    }
}
