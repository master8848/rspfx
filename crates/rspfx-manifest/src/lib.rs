pub mod manifests_js;
pub mod sp_dependencies;

pub use manifests_js::generate_manifests_js;
pub use sp_dependencies::{find_sp_dependencies, SpDependency};

pub fn hello() -> String {
    "rspfx-manifest".to_string()
}
