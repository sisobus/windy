//! Windy — a 2D esoteric programming language.
//!
//! This crate is the v0.2 reference implementation. The Python package
//! under `../src/windy/` remains a conformance reference: both
//! implementations must produce byte-identical stdout for the same
//! `(source, seed, stdin)` tuple (SPEC.md §11 + §10).

pub mod easter;
pub mod grid;
pub mod opcodes;
pub mod parser;
pub mod vm;

pub use easter::{detect, BANNER, SIGNATURE};
pub use grid::{Grid, Ip, SPACE};
pub use opcodes::{decode_cell, Op};
pub use parser::{normalize, parse};
pub use vm::{run_source, ExitCode, RunOptions, Vm};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
