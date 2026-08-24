pub mod localized;

pub const SPFX_PUBLIC_PATH_SENTINEL: &str = "__RSPFX_SPFX_PUBLIC_PATH__";

pub fn hello() -> String {
    "rspfx-rspack-plugin".to_string()
}

pub fn script_url_global_key(entry_name: &str) -> String {
    format!("__rspfx_script_url_{entry_name}")
}

pub fn public_path_expression(entry_name: &str) -> String {
    let key = script_url_global_key(entry_name);
    format!(r#"(typeof window!=="undefined"&&window[{key:?}]||"").replace(/\/[^/]*$/,"/")"#)
}

pub fn capture_line(entry_name: &str) -> String {
    let key = script_url_global_key(entry_name);
    format!(
        "(function(){{window[{k:?}]=typeof document!==\"undefined\"&&document.currentScript?document.currentScript.src:\"\";try{{Object.defineProperty(window,{k:?},{{value:window[{k:?}],writable:false,configurable:false}});}}catch{{}}}})();\n",
        k = key
    )
}
