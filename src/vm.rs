//! Windy bytecode VM — main execution loop (SPEC §3.5).
//!
//! All 34 opcodes are implemented per SPEC §4. Stack underflow yields 0
//! (§3.3, §7). Division and modulo by zero push 0 (§7). `GRID_PUT`
//! writes re-take effect on the next IP visit because cell decoding is
//! on-demand (no external cache to invalidate).
//!
//! The VM does **not** own its I/O streams — `step` / `run` accept them
//! as `&mut dyn` parameters. This lets external drivers (the interactive
//! debugger in `debugger.rs`, most obviously) inspect the captured stdout
//! buffer between steps without fighting the borrow checker.

use crate::easter::{detect, BANNER};
use crate::grid::{Grid, Ip, SPACE};
use crate::opcodes::{decode_cell, Op};
use crate::parser::parse;
use num_bigint::BigInt;
use num_integer::Integer;
use num_traits::{One, ToPrimitive, Zero};
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::HashSet;
use std::io::{Read, Write};

const WINDS: [(i64, i64); 8] = [
    (1, 0), (1, -1), (0, -1), (-1, -1),
    (-1, 0), (-1, 1), (0, 1), (1, 1),
];

const EAST: (i64, i64) = (1, 0);
const NORTH: (i64, i64) = (0, -1);
const WEST: (i64, i64) = (-1, 0);
const SOUTH: (i64, i64) = (0, 1);
const NE: (i64, i64) = (1, -1);
const NW: (i64, i64) = (-1, -1);
const SW: (i64, i64) = (-1, 1);
const SE: (i64, i64) = (1, 1);

const STR_QUOTE: u32 = 0x22;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitCode {
    Ok,
    MaxSteps,
}

impl ExitCode {
    pub fn code(self) -> i32 {
        match self {
            ExitCode::Ok => 0,
            ExitCode::MaxSteps => 124,
        }
    }
}

/// Top-level runtime configuration used by `run_source`. Stream refs are
/// borrowed so callers retain ownership of the underlying buffers.
pub struct RunOptions<'a> {
    pub seed: Option<u64>,
    pub max_steps: Option<u64>,
    pub stdin: &'a mut dyn Read,
    pub stdout: &'a mut dyn Write,
    pub stderr: &'a mut dyn Write,
}

pub struct Vm {
    pub grid: Grid,
    pub ip: Ip,
    pub stack: Vec<BigInt>,
    pub strmode: bool,
    pub halted: bool,
    pub steps: u64,
    pub max_steps: Option<u64>,
    rng: ChaCha8Rng,
    warned: HashSet<u32>,
}

impl Vm {
    pub fn new(grid: Grid, seed: Option<u64>, max_steps: Option<u64>) -> Self {
        let rng = match seed {
            Some(s) => ChaCha8Rng::seed_from_u64(s),
            None => ChaCha8Rng::from_entropy(),
        };
        Self {
            grid,
            ip: Ip::default(),
            stack: Vec::new(),
            strmode: false,
            halted: false,
            steps: 0,
            max_steps,
            rng,
            warned: HashSet::new(),
        }
    }

    pub fn run(
        &mut self,
        stdin: &mut dyn Read,
        stdout: &mut dyn Write,
        stderr: &mut dyn Write,
    ) -> ExitCode {
        while !self.halted {
            if let Some(cap) = self.max_steps {
                if self.steps >= cap {
                    return ExitCode::MaxSteps;
                }
            }
            self.step(stdin, stdout, stderr);
            self.steps += 1;
        }
        ExitCode::Ok
    }

    pub fn step(
        &mut self,
        stdin: &mut dyn Read,
        stdout: &mut dyn Write,
        stderr: &mut dyn Write,
    ) {
        let cell = self.grid.get(self.ip.x, self.ip.y);
        if self.strmode {
            if cell.to_u32() == Some(STR_QUOTE) {
                self.strmode = false;
            } else {
                self.push(cell.clone());
            }
        } else {
            let (op, operand) = decode_cell(&cell);
            self.execute(op, operand, &cell, stdin, stdout, stderr);
        }
        self.ip.advance();
    }

    fn pop(&mut self) -> BigInt {
        self.stack.pop().unwrap_or_else(BigInt::zero)
    }

    fn push(&mut self, v: BigInt) {
        self.stack.push(v);
    }

    fn execute(
        &mut self,
        op: Op,
        operand: u32,
        cell: &BigInt,
        stdin: &mut dyn Read,
        stdout: &mut dyn Write,
        stderr: &mut dyn Write,
    ) {
        match op {
            Op::Nop => {}
            Op::Halt => self.halted = true,
            Op::Trampoline => self.ip.advance(),
            Op::MoveE => self.ip.set_dir(EAST.0, EAST.1),
            Op::MoveNe => self.ip.set_dir(NE.0, NE.1),
            Op::MoveN => self.ip.set_dir(NORTH.0, NORTH.1),
            Op::MoveNw => self.ip.set_dir(NW.0, NW.1),
            Op::MoveW => self.ip.set_dir(WEST.0, WEST.1),
            Op::MoveSw => self.ip.set_dir(SW.0, SW.1),
            Op::MoveS => self.ip.set_dir(SOUTH.0, SOUTH.1),
            Op::MoveSe => self.ip.set_dir(SE.0, SE.1),
            Op::Turbulence => {
                let (dx, dy) = *WINDS.choose(&mut self.rng).unwrap();
                self.ip.set_dir(dx, dy);
            }
            Op::PushDigit => self.push(BigInt::from(operand)),
            Op::StrMode => self.strmode = true,
            Op::Add => {
                let b = self.pop();
                let a = self.pop();
                self.push(a + b);
            }
            Op::Sub => {
                let b = self.pop();
                let a = self.pop();
                self.push(a - b);
            }
            Op::Mul => {
                let b = self.pop();
                let a = self.pop();
                self.push(a * b);
            }
            Op::Div => {
                let b = self.pop();
                let a = self.pop();
                self.push(if b.is_zero() { BigInt::zero() } else { a.div_floor(&b) });
            }
            Op::Mod => {
                let b = self.pop();
                let a = self.pop();
                self.push(if b.is_zero() { BigInt::zero() } else { a.mod_floor(&b) });
            }
            Op::Not => {
                let a = self.pop();
                self.push(if a.is_zero() { BigInt::one() } else { BigInt::zero() });
            }
            Op::Gt => {
                let b = self.pop();
                let a = self.pop();
                self.push(if a > b { BigInt::one() } else { BigInt::zero() });
            }
            Op::Dup => {
                let top = self.pop();
                self.push(top.clone());
                self.push(top);
            }
            Op::Drop => {
                let _ = self.pop();
            }
            Op::Swap => {
                let b = self.pop();
                let a = self.pop();
                self.push(b);
                self.push(a);
            }
            Op::IfH => {
                let a = self.pop();
                let (dx, dy) = if a.is_zero() { EAST } else { WEST };
                self.ip.set_dir(dx, dy);
            }
            Op::IfV => {
                let a = self.pop();
                let (dx, dy) = if a.is_zero() { SOUTH } else { NORTH };
                self.ip.set_dir(dx, dy);
            }
            Op::PutNum => {
                let a = self.pop();
                let _ = write!(stdout, "{} ", a);
            }
            Op::PutChr => {
                let a = self.pop();
                if let Some(cp) = a.to_u32() {
                    if let Some(c) = char::from_u32(cp) {
                        let _ = write!(stdout, "{}", c);
                    }
                }
            }
            Op::GetNum => {
                let v = read_num_input(stdin).unwrap_or_else(|| BigInt::from(-1));
                self.push(v);
            }
            Op::GetChr => {
                let v = match read_utf8_char(stdin) {
                    Ok(Some(c)) => BigInt::from(c as u32),
                    _ => BigInt::from(-1),
                };
                self.push(v);
            }
            Op::GridGet => {
                let y = self.pop();
                let x = self.pop();
                let (xi, yi) = match (x.to_i64(), y.to_i64()) {
                    (Some(xi), Some(yi)) => (xi, yi),
                    _ => {
                        self.push(BigInt::from(SPACE));
                        return;
                    }
                };
                self.push(self.grid.get(xi, yi));
            }
            Op::GridPut => {
                let y = self.pop();
                let x = self.pop();
                let v = self.pop();
                if let (Some(xi), Some(yi)) = (x.to_i64(), y.to_i64()) {
                    self.grid.put(xi, yi, v);
                }
            }
            Op::Unknown => self.warn_unknown(cell, stderr),
        }
    }

    fn warn_unknown(&mut self, cell: &BigInt, stderr: &mut dyn Write) {
        let cp = match cell.to_u32() {
            Some(v) => v,
            None => return,
        };
        if !self.warned.insert(cp) {
            return;
        }
        let ch = char::from_u32(cp).unwrap_or('?');
        let _ = writeln!(
            stderr,
            "windy: warning: unknown glyph {:?} (U+{:04X}) treated as NOP",
            ch, cp
        );
    }
}

/// Parse, print the watermark banner if applicable, then run.
pub fn run_source(source: &str, opts: RunOptions) -> ExitCode {
    let (grid, scan_text) = parse(source);
    if detect(&scan_text) {
        let _ = writeln!(opts.stderr, "{}", BANNER);
    }
    let mut vm = Vm::new(grid, opts.seed, opts.max_steps);
    vm.run(opts.stdin, opts.stdout, opts.stderr)
}

fn read_num_input(stdin: &mut dyn Read) -> Option<BigInt> {
    let first = loop {
        match read_utf8_char(stdin).ok()? {
            None => return None,
            Some(c) if c.is_whitespace() => continue,
            Some(c) => break c,
        }
    };
    let mut s = String::new();
    s.push(first);
    loop {
        match read_utf8_char(stdin).ok()? {
            None => break,
            Some(c) if c.is_whitespace() => break,
            Some(c) => s.push(c),
        }
    }
    s.parse::<BigInt>().ok()
}

/// Read one UTF-8 char from `reader`. Returns `Ok(None)` on EOF.
pub(crate) fn read_utf8_char(reader: &mut dyn Read) -> std::io::Result<Option<char>> {
    let mut buf = [0u8; 4];
    let n = reader.read(&mut buf[..1])?;
    if n == 0 {
        return Ok(None);
    }
    let first = buf[0];
    let expected = if first < 0x80 {
        1
    } else if first < 0xC0 {
        return Ok(Some(char::REPLACEMENT_CHARACTER));
    } else if first < 0xE0 {
        2
    } else if first < 0xF0 {
        3
    } else {
        4
    };
    let mut filled = 1;
    while filled < expected {
        match reader.read(&mut buf[filled..expected])? {
            0 => return Ok(Some(char::REPLACEMENT_CHARACTER)),
            k => filled += k,
        }
    }
    Ok(std::str::from_utf8(&buf[..filled])
        .ok()
        .and_then(|s| s.chars().next()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(source: &str) -> (ExitCode, String, String) {
        run_with_stdin(source, b"")
    }

    fn run_with_stdin(source: &str, stdin_bytes: &[u8]) -> (ExitCode, String, String) {
        let mut stdin = stdin_bytes;
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let code = run_source(
            source,
            RunOptions {
                seed: Some(42),
                max_steps: Some(1_000_000),
                stdin: &mut stdin,
                stdout: &mut stdout,
                stderr: &mut stderr,
            },
        );
        (
            code,
            String::from_utf8(stdout).unwrap(),
            String::from_utf8(stderr).unwrap(),
        )
    }

    #[test]
    fn halt_returns_ok() {
        let (code, out, _) = run("@");
        assert_eq!(code, ExitCode::Ok);
        assert_eq!(out, "");
    }

    #[test]
    fn hello_world() {
        let (code, out, _) = run("\"!dlroW ,olleH\",,,,,,,,,,,,,@");
        assert_eq!(code, ExitCode::Ok);
        assert_eq!(out, "Hello, World!");
    }

    #[test]
    fn put_num_trailing_space() {
        let (_, out, _) = run("34+.@");
        assert_eq!(out, "7 ");
    }

    #[test]
    fn sub_argument_order() {
        let (_, out, _) = run("34-.@");
        assert_eq!(out, "-1 ");
    }

    #[test]
    fn div_mod_by_zero_push_zero() {
        assert_eq!(run("50/.@").1, "0 ");
        assert_eq!(run("50%.@").1, "0 ");
    }

    #[test]
    fn stack_underflow_yields_zero() {
        assert_eq!(run(".@").1, "0 ");
    }

    #[test]
    fn gt_comparison() {
        assert_eq!(run("53`.@").1, "1 ");
        assert_eq!(run("35`.@").1, "0 ");
    }

    #[test]
    fn dup_and_swap() {
        assert_eq!(run("7:..@").1, "7 7 ");
        assert_eq!(run("12\\..@").1, "1 2 ");
    }

    #[test]
    fn trampoline_skips_next_cell() {
        assert_eq!(run("#@5.@").1, "5 ");
    }

    #[test]
    fn string_mode_pushes_codepoints() {
        assert_eq!(run("\"A\",@").1, "A");
        assert_eq!(run("\"+\".@").1, "43 ");
    }

    #[test]
    fn if_v_routes_vertically() {
        let src = "0v\n |\n @";
        let (code, out, _) = run(src);
        assert_eq!(code, ExitCode::Ok);
        assert_eq!(out, "");
    }

    #[test]
    fn grid_put_then_get_roundtrip() {
        assert_eq!(run("\"!\"55p55g,@").1, "!");
    }

    #[test]
    fn grid_put_self_modifies_for_halt() {
        let (code, out, err) = run("88*70p X");
        assert_eq!(code, ExitCode::Ok);
        assert_eq!(out, "");
        assert!(!err.contains("unknown glyph"));
    }

    #[test]
    fn max_steps_returns_124() {
        let mut stdin: &[u8] = b"";
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        let code = run_source(
            "    ",
            RunOptions {
                seed: Some(0),
                max_steps: Some(3),
                stdin: &mut stdin,
                stdout: &mut stdout,
                stderr: &mut stderr,
            },
        );
        assert_eq!(code, ExitCode::MaxSteps);
    }

    #[test]
    fn unknown_glyph_warned_once() {
        let (_, _, err) = run("ZZ@");
        assert_eq!(err.matches("unknown glyph").count(), 1);
    }

    #[test]
    fn unknown_glyph_per_codepoint() {
        let (_, _, err) = run("ZY@");
        assert_eq!(err.matches("unknown glyph").count(), 2);
    }

    #[test]
    fn sisobus_banner_on_stderr() {
        let (_, out, err) = run("\"sisobus\"@");
        assert!(err.contains("Kim Sangkeun"));
        assert!(!out.contains("Kim Sangkeun"));
    }

    #[test]
    fn no_banner_without_watermark() {
        let (_, _, err) = run("@");
        assert!(!err.contains("Kim Sangkeun"));
    }

    #[test]
    fn put_chr_emits_unicode() {
        assert_eq!(run("\"가\",@").1, "가");
    }

    #[test]
    fn get_chr_on_empty_stdin_pushes_minus_one() {
        assert_eq!(run_with_stdin("?.@", b"").1, "-1 ");
    }

    #[test]
    fn get_chr_reads_one_char() {
        assert_eq!(run_with_stdin("?.@", b"A").1, "65 ");
    }

    #[test]
    fn get_num_reads_integer() {
        assert_eq!(run_with_stdin("&.@", b"42 ").1, "42 ");
    }

    #[test]
    fn get_num_on_empty_stdin_pushes_minus_one() {
        assert_eq!(run_with_stdin("&.@", b"").1, "-1 ");
    }

    #[test]
    fn turbulence_deterministic_with_seed() {
        let mut s1: &[u8] = b"";
        let mut o1 = Vec::new();
        let mut e1 = Vec::new();
        run_source(
            "~.@\n.@\n.@",
            RunOptions {
                seed: Some(42),
                max_steps: Some(50),
                stdin: &mut s1,
                stdout: &mut o1,
                stderr: &mut e1,
            },
        );
        let mut s2: &[u8] = b"";
        let mut o2 = Vec::new();
        let mut e2 = Vec::new();
        run_source(
            "~.@\n.@\n.@",
            RunOptions {
                seed: Some(42),
                max_steps: Some(50),
                stdin: &mut s2,
                stdout: &mut o2,
                stderr: &mut e2,
            },
        );
        assert_eq!(o1, o2);
    }
}
