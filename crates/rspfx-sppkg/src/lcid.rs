use std::collections::HashMap;
use std::sync::OnceLock;

fn locale_map() -> &'static HashMap<&'static str, u32> {
    static MAP: OnceLock<HashMap<&'static str, u32>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("af-za", 1078);
        m.insert("ar-sa", 1025);
        m.insert("az-latn-az", 1068);
        m.insert("bg-bg", 1026);
        m.insert("bs-latn-ba", 5146);
        m.insert("ca-es", 1027);
        m.insert("cs-cz", 1029);
        m.insert("cy-gb", 1106);
        m.insert("da-dk", 1030);
        m.insert("de-de", 1031);
        m.insert("de-ch", 2055);
        m.insert("el-gr", 1032);
        m.insert("en-us", 1033);
        m.insert("en-gb", 2057);
        m.insert("es-es", 3082);
        m.insert("es-mx", 2058);
        m.insert("et-ee", 1061);
        m.insert("eu-es", 1069);
        m.insert("fi-fi", 1035);
        m.insert("fr-fr", 1036);
        m.insert("fr-ca", 3084);
        m.insert("gl-es", 1110);
        m.insert("he-il", 1037);
        m.insert("hi-in", 1081);
        m.insert("hr-hr", 1050);
        m.insert("hu-hu", 1038);
        m.insert("id-id", 1057);
        m.insert("it-it", 1040);
        m.insert("it-ch", 2064);
        m.insert("ja-jp", 1041);
        m.insert("kk-kz", 1087);
        m.insert("ko-kr", 1042);
        m.insert("lt-lt", 1063);
        m.insert("lv-lv", 1062);
        m.insert("ms-my", 1086);
        m.insert("nb-no", 1044);
        m.insert("nl-nl", 1043);
        m.insert("nl-be", 2067);
        m.insert("pl-pl", 1045);
        m.insert("pt-br", 1046);
        m.insert("pt-pt", 2070);
        m.insert("ro-ro", 1048);
        m.insert("ru-ru", 1049);
        m.insert("sk-sk", 1051);
        m.insert("sl-si", 1060);
        m.insert("sr-latn-rs", 1080);
        m.insert("sr-cyrl-rs", 3098);
        m.insert("sv-se", 1053);
        m.insert("th-th", 1054);
        m.insert("tr-tr", 1055);
        m.insert("uk-ua", 1058);
        m.insert("vi-vn", 1066);
        m.insert("zh-cn", 2052);
        m.insert("zh-tw", 1028);
        m.insert("zh-hans", 2052);
        m.insert("zh-hant", 1028);
        m
    })
}

fn lcid_to_culture_map() -> &'static HashMap<u32, &'static str> {
    static MAP: OnceLock<HashMap<u32, &'static str>> = OnceLock::new();
    MAP.get_or_init(|| {
        let mut m = HashMap::new();
        for (k, v) in locale_map().iter() {
            m.entry(*v).or_insert(*k);
        }
        m
    })
}

fn format_culture(culture: &str) -> String {
    let parts: Vec<&str> = culture.split('-').collect();
    match parts.len() {
        2 => format!("{}-{}", parts[0], parts[1].to_uppercase()),
        3 => format!("{}-{}-{}", parts[0], parts[1], parts[2].to_uppercase()),
        _ => culture.to_string(),
    }
}

pub fn locale_to_lcid(locale: &str) -> u32 {
    let normalized = locale.to_lowercase();
    let hyphenated = normalized.replace('_', "-");
    if let Some(v) = locale_map().get(normalized.as_str()) {
        return *v;
    }
    if let Some(v) = locale_map().get(hyphenated.as_str()) {
        return *v;
    }
    1033
}

pub fn lcid_to_culture_name(lcid: u32) -> String {
    if let Some(culture) = lcid_to_culture_map().get(&lcid) {
        return format_culture(culture);
    }
    "en-US".to_string()
}

pub fn locale_to_culture_name(locale: &str) -> String {
    if locale == "default" {
        return "default".to_string();
    }
    let normalized = locale.to_lowercase().replace('_', "-");
    if normalized.chars().all(|c| c.is_ascii_digit()) {
        if let Ok(n) = normalized.parse::<u32>() {
            return lcid_to_culture_name(n);
        }
    }
    if let Some(lcid) = locale_map().get(normalized.as_str()) {
        return lcid_to_culture_name(*lcid);
    }
    if normalized.contains('-') {
        return format_culture(&normalized);
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn known_locales() {
        assert_eq!(locale_to_lcid("en-us"), 1033);
        assert_eq!(locale_to_lcid("EN_US"), 1033);
        assert_eq!(locale_to_lcid("af-za"), 1078);
        assert_eq!(locale_to_lcid("zh-hans"), 2052);
        assert_eq!(locale_to_lcid("unknown"), 1033);
    }
    #[test]
    fn culture_roundtrip() {
        assert_eq!(lcid_to_culture_name(1033), "en-US");
        assert_eq!(lcid_to_culture_name(9999), "en-US");
        assert_eq!(locale_to_culture_name("default"), "default");
        assert_eq!(locale_to_culture_name("en-us"), "en-US");
        assert_eq!(locale_to_culture_name("1033"), "en-US");
        assert_eq!(locale_to_culture_name("fr-ca"), "fr-CA");
    }
}
