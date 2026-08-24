pub const LOCALIZED_STAGE: i32 = 1000;

#[derive(Debug, Clone)]
pub struct LocalizedResource {
    pub name: String,
    pub files: Vec<LocalizedFile>,
}

#[derive(Debug, Clone)]
pub struct LocalizedFile {
    pub path: String,
    pub locale: String,
}

pub fn localized_asset_name(resource: &str, locale: &str) -> String {
    format!("{resource}_{locale}.js")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn asset_name() {
        assert_eq!(localized_asset_name("MyStrings", "en-us"), "MyStrings_en-us.js");
    }
}
