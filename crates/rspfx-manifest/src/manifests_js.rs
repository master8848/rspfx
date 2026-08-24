pub fn generate_manifests_js(manifests: &[serde_json::Value], metadata: Option<&serde_json::Value>) -> String {
    let manifests_json = serde_json::to_string(manifests).unwrap_or_else(|_| "[]".to_string());
    let metadata_json = match metadata {
        Some(v) => serde_json::to_string(v).unwrap_or_else(|_| "undefined".to_string()),
        None => "undefined".to_string(),
    };
    format!(
        r#"(() => {{
  const MANIFESTS_ARRAY = {manifests_json};
  let publicPath = '';
  try {{
    const scripts = document.getElementsByTagName('script');
    const currentScript = document.currentScript || (scripts.length ? scripts[scripts.length - 1] : undefined);
    if (currentScript && currentScript.src) {{
      const url = new URL(currentScript.src, window.location.href);
      let base = url.href;
      if (!base.endsWith('/')) {{
        const slashIndex = base.lastIndexOf('/');
        if (slashIndex >= 0) base = base.slice(0, slashIndex + 1);
      }}
      publicPath = base;
    }}
  }} catch (error) {{
    console.error('[rspfx] Unable to determine the base URL of the debug manifests file.', error);
  }}
  const a = {{ _metadata: {metadata_json}, getManifests: function () {{ return JSON.parse(JSON.stringify(MANIFESTS_ARRAY)); }} }};
  self.debugManifests = a;
  window.debugManifests = a;
  if (typeof define === 'function') define([], function () {{ return a; }});
}})();
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn js_contains_define() {
        let out = generate_manifests_js(&[], None);
        assert!(out.contains("define"));
        assert!(out.contains("debugManifests"));
    }
}
