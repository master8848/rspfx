use std::collections::HashMap;

pub const XML_DECLARATION: &str = r#"<?xml version="1.0" encoding="utf-8"?>"#;

#[derive(Debug, Clone)]
pub struct XmlNode {
    pub name: String,
    pub attrs: Option<HashMap<String, String>>,
    pub children: Option<Vec<XmlChild>>,
    pub single_quoted_attrs: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub enum XmlChild {
    Node(XmlNode),
    Text(String),
}

pub fn escape_xml_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn escape_xml_attribute(value: &str) -> String {
    escape_xml_text(value)
}

pub fn serialize_xml(node: &XmlNode, pretty: bool, indent_level: usize) -> String {
    let single_quoted: std::collections::HashSet<&String> =
        node.single_quoted_attrs.as_ref().map_or_else(Default::default, |v| v.iter().collect());
    let attr_part = if let Some(attrs) = &node.attrs {
        let mut parts: Vec<String> = attrs
            .iter()
            .map(|(k, v)| {
                let ev = escape_xml_attribute(v);
                if single_quoted.contains(k) {
                    format!(" {k}='{ev}'")
                } else {
                    format!(" {k}=\"{ev}\"")
                }
            })
            .collect();
        parts.sort();
        parts.join("")
    } else {
        String::new()
    };
    let children = node.children.as_deref().unwrap_or(&[]);
    let indent = if pretty { "  ".repeat(indent_level) } else { String::new() };
    if children.is_empty() {
        return format!("{indent}<{}{attr_part}/>", node.name);
    }
    let all_text = children.iter().all(|c| matches!(c, XmlChild::Text(_)));
    if all_text {
        let text: String = children
            .iter()
            .map(|c| if let XmlChild::Text(t) = c { escape_xml_text(t) } else { String::new() })
            .collect();
        return format!("{indent}<{}{attr_part}>{text}</{}>", node.name, node.name);
    }
    if !pretty {
        let inline: String = children
            .iter()
            .map(|c| match c {
                XmlChild::Text(t) => escape_xml_text(t),
                XmlChild::Node(n) => serialize_xml(n, false, 0),
            })
            .collect();
        return format!("<{}{attr_part}>{inline}</{}>", node.name, node.name);
    }
    let inner: String = children
        .iter()
        .map(|c| match c {
            XmlChild::Text(t) => escape_xml_text(t),
            XmlChild::Node(n) => serialize_xml(n, true, indent_level + 1),
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("{indent}<{}{attr_part}>\n{inner}\n{indent}</{}>", node.name, node.name)
}

pub fn build_rels_xml(relationships: Vec<(String, String)>, pretty: bool) -> String {
    let children: Vec<XmlChild> = relationships
        .into_iter()
        .enumerate()
        .map(|(i, (ty, target))| {
            let mut attrs = HashMap::new();
            attrs.insert("Id".to_string(), format!("rId{}", i + 1));
            attrs.insert("Type".to_string(), ty);
            attrs.insert("Target".to_string(), target);
            XmlChild::Node(XmlNode { name: "Relationship".to_string(), attrs: Some(attrs), children: None, single_quoted_attrs: None })
        })
        .collect();
    let mut root_attrs = HashMap::new();
    root_attrs.insert("xmlns".to_string(), "http://schemas.openxmlformats.org/package/2006/relationships".to_string());
    let root = XmlNode { name: "Relationships".to_string(), attrs: Some(root_attrs), children: Some(children), single_quoted_attrs: None };
    format!("{XML_DECLARATION}\n{}", serialize_xml(&root, pretty, 0))
}

fn content_type_for_extension(ext: &str) -> &'static str {
    match ext {
        "js" => "application/javascript",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "css" => "text/css",
        "txt" => "application/octet-stream",
        "htm" | "html" => "text/html",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "eot" => "application/vnd.ms-fontobject",
        _ => "application/octet-stream",
    }
}

pub fn build_content_types_xml(extensions: Vec<String>, pretty: bool) -> String {
    let defaults: Vec<(&str, &str)> = vec![
        ("xml", "text/xml"), ("rels", "application/vnd.openxmlformats-package.relationships+xml"),
        ("webpart", "text/xml"), ("htm", "text/html"), ("html", "text/html"), ("aspx", "text/xml"),
        ("resx", "text/xml"), ("js", "application/javascript"), ("json", "application/json"),
        ("png", "image/png"), ("jpg", "image/jpeg"), ("bmp", "image/bmp"), ("gif", "image/gif"),
    ];
    let mut extra_set = std::collections::HashSet::new();
    for e in extensions.iter().map(|s| s.to_lowercase()) {
        if !defaults.iter().any(|(k, _)| *k == e) && e != "xml" && e != "rels" {
            extra_set.insert(e);
        }
    }
    let mut ordered = defaults;
    let mut extra: Vec<String> = extra_set.into_iter().collect();
    extra.sort();
    for ext in extra {
        let ct = content_type_for_extension(&ext);
        ordered.push((Box::leak(ext.into_boxed_str()) as &str, ct));
    }
    let children: Vec<XmlChild> = ordered.into_iter().map(|(ext, ct)| {
        let mut attrs = HashMap::new();
        attrs.insert("Extension".to_string(), ext.to_string());
        attrs.insert("ContentType".to_string(), ct.to_string());
        XmlChild::Node(XmlNode { name: "Default".to_string(), attrs: Some(attrs), children: None, single_quoted_attrs: None })
    }).collect();
    let mut root_attrs = HashMap::new();
    root_attrs.insert("xmlns".to_string(), "http://schemas.openxmlformats.org/package/2006/content-types".to_string());
    let root = XmlNode { name: "Types".to_string(), attrs: Some(root_attrs), children: Some(children), single_quoted_attrs: None };
    format!("{XML_DECLARATION}\n{}", serialize_xml(&root, pretty, 0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn serialize_simple() {
        let node = XmlNode { name: "a".to_string(), attrs: None, children: Some(vec![XmlChild::Text("hello & <world>".to_string())]), single_quoted_attrs: None };
        assert_eq!(serialize_xml(&node, false, 0), "<a>hello &amp; &lt;world&gt;</a>");
    }
    #[test]
    fn rels_pretty() {
        let xml = build_rels_xml(vec![("http://example".to_string(), "/AppManifest.xml".to_string())], false);
        assert!(xml.contains("Relationship"));
        assert!(xml.contains("rId1"));
    }
}
