use regex::Regex;
use walkdir::WalkDir;

pub fn glob_to_regexp(pattern: &str) -> String {
    let mut source = String::from("^");
    let chars: Vec<char> = pattern.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '*' {
            if i + 1 < chars.len() && chars[i + 1] == '*' {
                i += 1;
                if i + 1 < chars.len() && chars[i + 1] == '/' {
                    i += 1;
                    source.push_str("(?:.*/)?");
                } else {
                    source.push_str(".*");
                }
            } else {
                source.push_str("[^/]*");
            }
        } else if c == '?' {
            source.push_str("[^/]");
        } else if ".+^${}()|[]\\".contains(c) {
            source.push('\\');
            source.push(c);
        } else {
            source.push(c);
        }
        i += 1;
    }
    source.push('$');
    source
}

pub fn glob_files(dir: &std::path::Path, patterns: &[String]) -> Vec<String> {
    let regexes: Vec<Regex> = patterns
        .iter()
        .map(|p| Regex::new(&glob_to_regexp(p)).unwrap())
        .collect();
    let mut matches = Vec::new();
    for entry in WalkDir::new(dir).follow_links(false).sort_by_file_name() {
        let Ok(entry) = entry else { continue };
        if entry.file_type().is_symlink() {
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let Ok(rel) = entry.path().strip_prefix(dir) else { continue };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if regexes.iter().any(|re| re.is_match(&rel_str)) {
            matches.push(rel_str);
        }
    }
    matches.sort();
    matches
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn regexp_builds() {
        assert_eq!(glob_to_regexp("*.js"), "^[^/]*\\.js$");
        assert_eq!(glob_to_regexp("**/*.js"), "^(?:.*/)?[^/]*\\.js$");
        assert_eq!(glob_to_regexp("a?b"), "^a[^/]b$");
        assert_eq!(glob_to_regexp("**/"), "^(?:.*/)?$");
    }
    #[test]
    fn regex_matches() {
        let re = Regex::new(&glob_to_regexp("*.js")).unwrap();
        assert!(re.is_match("foo.js"));
        assert!(!re.is_match("a/b.js"));
        let re2 = Regex::new(&glob_to_regexp("**/*.js")).unwrap();
        assert!(re2.is_match("a/b.js"));
        assert!(re2.is_match("b.js"));
        let re3 = Regex::new(&glob_to_regexp("**/*.resx")).unwrap();
        assert!(re3.is_match("loc/en-us.resx"));
    }
}
