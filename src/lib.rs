//! Windy — a 2D esoteric programming language.
//!
//! The v0.2 reference implementation. Same crate backs the native CLI
//! today and (in v0.3) the browser playground via `wasm32` target.

pub mod debugger;
pub mod easter;
pub mod grid;
pub mod opcodes;
pub mod parser;
pub mod vm;

#[cfg(target_arch = "wasm32")]
pub mod wasm_api;

pub use debugger::debug_source;
pub use easter::{banner, detect, SIGNATURE};
pub use grid::{Grid, Ip, SPACE};
pub use opcodes::{decode_cell, Op};
pub use parser::{normalize, parse};
pub use vm::{run_source, ExitCode, RunOptions, Vm};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
