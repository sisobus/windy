//! JS-facing API surface for the browser playground (v0.3).
//!
//! Only compiled when the crate is built for `wasm32-*`. The native CLI
//! build skips this module entirely via `#[cfg]` in `lib.rs`.
//!
//! Two entry points:
//!
//! * `run(source, stdin, seed?, max_steps?) -> RunResult` — batch
//!   execution; returns once the program halts or hits the step cap.
//! * `Session::new(source, stdin, seed?, max_steps?)` — stepper handle;
//!   the caller drives execution via `step()` / `run_to_halt()` and
//!   introspects IP / stack / grid / captured stdout between ticks.

use crate::{banner, decode_cell, detect, parse, run_source, Op, RunOptions, Vm};
use num_traits::ToPrimitive;
use std::io::Write;
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

/// Interactive stepper. Wraps a `Vm` plus captured stdout/stderr buffers
/// and a consumable stdin slice, exposing the state JS needs to render a
/// grid viewport, a stack panel, and a program-output panel between
/// individual VM ticks.
#[wasm_bindgen]
pub struct Session {
    vm: Vm,
    stdin: Vec<u8>,
    stdin_pos: usize,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

#[wasm_bindgen]
impl Session {
    /// Construct a session and emit the sisobus banner to captured
    /// stderr if the source text carries the watermark.
    #[wasm_bindgen(constructor)]
    pub fn new(
        source: &str,
        stdin: &str,
        seed: Option<u64>,
        max_steps: Option<u64>,
    ) -> Session {
        let (grid, scan_text) = parse(source);
        let mut stderr = Vec::<u8>::new();
        if detect(&scan_text) {
            let _ = writeln!(stderr, "{}", banner());
        }
        let vm = Vm::new(grid, seed, max_steps);
        Session {
            vm,
            stdin: stdin.as_bytes().to_vec(),
            stdin_pos: 0,
            stdout: Vec::new(),
            stderr,
        }
    }

    /// Execute a single VM tick. No-op if the session is already halted
    /// or the step cap has been reached.
    pub fn step(&mut self) {
        if self.vm.halted {
            return;
        }
        if let Some(cap) = self.vm.max_steps {
            if self.vm.steps >= cap {
                return;
            }
        }
        let mut slice = &self.stdin[self.stdin_pos..];
        let before = slice.len();
        self.vm.step(&mut slice, &mut self.stdout, &mut self.stderr);
        self.stdin_pos += before - slice.len();
        self.vm.steps += 1;
    }

    /// Run until halt or the step cap fires. Returns 0 on clean halt,
    /// 124 on `max_steps` abort.
    pub fn run_to_halt(&mut self) -> i32 {
        loop {
            if self.vm.halted {
                return 0;
            }
            if let Some(cap) = self.vm.max_steps {
                if self.vm.steps >= cap {
                    return 124;
                }
            }
            self.step();
        }
    }

    #[wasm_bindgen(getter)]
    pub fn halted(&self) -> bool {
        self.vm.halted
    }

    #[wasm_bindgen(getter)]
    pub fn steps(&self) -> u64 {
        self.vm.steps
    }

    /// Number of live IPs (SPEC §3.5). `1` for single-IP programs;
    /// grows after each `t` (SPLIT) executes.
    #[wasm_bindgen(getter)]
    pub fn ip_count(&self) -> u32 {
        self.vm.ips.len() as u32
    }

    // ---- "primary" IP accessors (oldest live IP, birth order) ----

    #[wasm_bindgen(getter)]
    pub fn ip_x(&self) -> i64 {
        self.vm.first_ip().map(|c| c.ip.x).unwrap_or(0)
    }

    #[wasm_bindgen(getter)]
    pub fn ip_y(&self) -> i64 {
        self.vm.first_ip().map(|c| c.ip.y).unwrap_or(0)
    }

    #[wasm_bindgen(getter)]
    pub fn dx(&self) -> i64 {
        self.vm.first_ip().map(|c| c.ip.dx).unwrap_or(1)
    }

    #[wasm_bindgen(getter)]
    pub fn dy(&self) -> i64 {
        self.vm.first_ip().map(|c| c.ip.dy).unwrap_or(0)
    }

    #[wasm_bindgen(getter)]
    pub fn strmode(&self) -> bool {
        self.vm.first_ip().map(|c| c.strmode).unwrap_or(false)
    }

    /// Primary IP's stack, bottom to top, as decimal strings. JS
    /// coerces entries to BigInt as needed. Equivalent to
    /// `stack_for(0)` when at least one IP is alive.
    pub fn stack(&self) -> Vec<String> {
        self.stack_for(0)
    }

    pub fn stack_len(&self) -> u32 {
        self.stack_len_for(0)
    }

    /// Stack of the IP at `ip_index` (birth order), bottom to top, as
    /// decimal strings. Out-of-range indices return an empty vec, so
    /// the JS side can call without bounds-checking against `ip_count`.
    pub fn stack_for(&self, ip_index: u32) -> Vec<String> {
        self.vm
            .ips
            .get(ip_index as usize)
            .map(|c| c.stack.iter().map(|v| v.to_string()).collect())
            .unwrap_or_default()
    }

    pub fn stack_len_for(&self, ip_index: u32) -> u32 {
        self.vm
            .ips
            .get(ip_index as usize)
            .map(|c| c.stack.len() as u32)
            .unwrap_or(0)
    }

    pub fn strmode_for(&self, ip_index: u32) -> bool {
        self.vm
            .ips
            .get(ip_index as usize)
            .map(|c| c.strmode)
            .unwrap_or(false)
    }

    /// Captured stdout so far (UTF-8 lossy).
    pub fn stdout(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }

    /// Captured stderr so far (banner + any warnings).
    pub fn stderr(&self) -> String {
        String::from_utf8_lossy(&self.stderr).into_owned()
    }

    /// Human-readable name of the opcode under the primary IP.
    /// Appends the digit value for `PUSH_DIGIT`.
    pub fn current_op(&self) -> String {
        let ctx = match self.vm.first_ip() {
            Some(c) => c,
            None => return "—".to_string(),
        };
        let cell = self.vm.grid.get(ctx.ip.x, ctx.ip.y);
        let (op, operand) = decode_cell(&cell);
        if op == Op::PushDigit {
            format!("{} ({})", op.name(), operand)
        } else {
            op.name().to_string()
        }
    }

    /// Codepoint of the cell under the primary IP.
    pub fn current_cell(&self) -> u32 {
        let ctx = match self.vm.first_ip() {
            Some(c) => c,
            None => return 0,
        };
        self.vm.grid.get(ctx.ip.x, ctx.ip.y).to_u32().unwrap_or(0)
    }

    /// Flattened `(x, y, dx, dy)` of every live IP, in birth order. JS
    /// coerces each entry to BigInt; length is `4 * ip_count`.
    pub fn ip_positions(&self) -> Vec<i64> {
        let mut out = Vec::with_capacity(self.vm.ips.len() * 4);
        for c in &self.vm.ips {
            out.push(c.ip.x);
            out.push(c.ip.y);
            out.push(c.ip.dx);
            out.push(c.ip.dy);
        }
        out
    }

    /// Flattened `width * height` grid of codepoints starting at
    /// `(x0, y0)`. Unpopulated cells come back as `0x20` (space).
    pub fn grid_slice(&self, x0: i32, y0: i32, width: u32, height: u32) -> Vec<u32> {
        let mut out = Vec::with_capacity((width as usize) * (height as usize));
        for dy in 0..height as i32 {
            for dx in 0..width as i32 {
                let cell = self.vm.grid.get(x0 as i64 + dx as i64, y0 as i64 + dy as i64);
                out.push(cell.to_u32().unwrap_or(0x20));
            }
        }
        out
    }
}
