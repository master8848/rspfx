use std::collections::HashMap;
use quick_xml::events::Event;
use quick_xml::Reader;

fn decode_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&apos;", "'")
        .replace("&quot;", "\"")
}

pub fn parse_resx(content: &str) -> Result<HashMap<String, String>, String> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(false);
    let mut values: HashMap<String, String> = HashMap::new();
    let mut current_name: Option<String> = None;
    let mut in_value = false;
    let mut value_buf = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "data" {
                    let mut attr_name: Option<String> = None;
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"name" {
                            attr_name = Some(String::from_utf8_lossy(&attr.value).to_string());
                        }
                    }
                    if let Some(n) = attr_name {
                        current_name = Some(n);
                    }
                    if e.is_empty() {
                        current_name = None;
                    }
                } else if name == "value" && current_name.is_some() {
                    in_value = true;
                    value_buf.clear();
                }
            }
            Ok(Event::Text(e)) => {
                if in_value {
                    let txt = e.unescape().map(|s| s.to_string()).unwrap_or_default();
                    value_buf.push_str(&txt);
                }
            }
            Ok(Event::End(e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if name == "value" && in_value {
                    if let Some(n) = current_name.clone() {
                        values.insert(n, decode_entities(&value_buf));
                    }
                    in_value = false;
                    value_buf.clear();
                } else if name == "data" {
                    current_name = None;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("Invalid RESX XML at position {}: {}", reader.buffer_position(), e)),
            _ => {}
        }
        buf.clear();
    }
    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_simple() {
        let xml = r#"<?xml version="1.0"?><root><data name="Hello"><value>World</value></data><data name="A"><value>&lt;b&gt; &amp; &quot;</value></data></root>"#;
        let m = parse_resx(xml).unwrap();
        assert_eq!(m["Hello"], "World");
        assert_eq!(m["A"], "<b> & \"");
    }
    #[test]
    fn handles_preserve() {
        let xml = r#"<root><data name="X" xml:space="preserve"><value>  spaced  </value></data></root>"#;
        let m = parse_resx(xml).unwrap();
        assert_eq!(m["X"], "  spaced  ");
    }
}
