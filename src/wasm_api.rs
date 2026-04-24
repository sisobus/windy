//! JS-facing API surface for the browser playground (v0.3).
//!
//! Only compiled when the crate is built for `wasm32-*`. The native CLI
//! build skips this module entirely via `#[cfg]` in `lib.rs`.
//!
//! Exposes a single `run(source, stdin, seed?, max_steps?)` entry point
//! that returns a `RunResult` object with `stdout`, `stderr`, and `exit`
//! getters. No grid / IP / stepper surface is published yet — the step
//! debugger lands as a follow-up once the basic playground ships.

use crate::{run_source, RunOptions};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct RunResult {
    stdout: String,
    stderr: String,
    exit: i32,
}

#[wasm_bindgen]
impl RunResult {
    #[wasm_bindgen(getter)]
    pub fn stdout(&self) -> String {
        self.stdout.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn stderr(&self) -> String {
        self.stderr.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn exit(&self) -> i32 {
        self.exit
    }
}

#[wasm_bindgen]
pub fn run(
    source: &str,
    stdin: &str,
    seed: Option<u64>,
    max_steps: Option<u64>,
) -> RunResult {
    let mut stdin_bytes = stdin.as_bytes();
    let mut stdout = Vec::<u8>::new();
    let mut stderr = Vec::<u8>::new();
    let exit = run_source(
        source,
        RunOptions {
            seed,
            max_steps,
            stdin: &mut stdin_bytes,
            stdout: &mut stdout,
            stderr: &mut stderr,
        },
    );
    RunResult {
        stdout: String::from_utf8(stdout).unwrap_or_default(),
        stderr: String::from_utf8(stderr).unwrap_or_default(),
        exit: exit.code(),
    }
}

/// Version string for the playground footer.
#[wasm_bindgen]
pub fn version() -> String {
    crate::VERSION.to_string()
}
