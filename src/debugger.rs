//! Interactive step debugger — terminal edition.
//!
//! No TUI crate: just ANSI escapes + Unicode box-drawing. Between steps
//! the screen is redrawn with a grid viewport around the IP, the stack,
//! runtime state, and the program's captured stdout. The user drives
//! the stepper with single-character commands:
//!
//! * `Enter` / `s` — advance one step
//! * `c` — run until HALT or the built-in safety cap
//! * `q` — quit
//!
//! `debug_source` owns the captured stdout buffer across steps so it
//! can be displayed between instructions. This is why `Vm::step`
//! accepts streams as parameters rather than owning them — see the
//! module comment in `vm.rs`.

use crate::easter::{detect, BANNER};
use crate::opcodes::{decode_cell, Op};
use crate::parser::parse;
use crate::vm::Vm;
use num_traits::ToPrimitive;
use std::io::{self, BufRead, Write};

const VIEWPORT_COLS: i64 = 60;
const VIEWPORT_ROWS: i64 = 13;
const RUN_SAFETY_CAP: u64 = 10_000_000;

const CLEAR_SCREEN: &str = "\x1b[2J\x1b[H";
const REVERSE_ON: &str = "\x1b[7m";
const REVERSE_OFF: &str = "\x1b[0m";

fn dir_name(dx: i64, dy: i64) -> &'static str {
    match (dx, dy) {
        (1, 0) => "→ east",
        (1, -1) => "↗ ne",
        (0, -1) => "↑ north",
        (-1, -1) => "↖ nw",
        (-1, 0) => "← west",
        (-1, 1) => "↙ sw",
        (0, 1) => "↓ south",
        (1, 1) => "↘ se",
        _ => "?",
    }
}

fn render_grid(out: &mut dyn Write, vm: &Vm) -> io::Result<()> {
    let half_w = VIEWPORT_COLS / 2;
    let half_h = VIEWPORT_ROWS / 2;
    let x0 = vm.ip.x - half_w;
    let y0 = vm.ip.y - half_h;
    writeln!(out, "┌─ grid {:>52}", format!("({}, {})  ", vm.ip.x, vm.ip.y))?;
    for y in y0..y0 + VIEWPORT_ROWS {
        write!(out, "│ ")?;
        for x in x0..x0 + VIEWPORT_COLS {
            let cp = vm.grid.get(x, y);
            let ch = cp
                .to_u32()
                .and_then(char::from_u32)
                .filter(|c| !c.is_control() && *c != '\t' && *c != '\n')
                .unwrap_or(' ');
            if x == vm.ip.x && y == vm.ip.y {
                write!(out, "{REVERSE_ON}{ch}{REVERSE_OFF}")?;
            } else {
                write!(out, "{ch}")?;
            }
        }
        writeln!(out, " │")?;
    }
    writeln!(out, "└{}", "─".repeat(VIEWPORT_COLS as usize + 2))?;
    Ok(())
}

fn render_status(out: &mut dyn Write, vm: &Vm) -> io::Result<()> {
    let cell = vm.grid.get(vm.ip.x, vm.ip.y);
    let cp = cell.to_u32().unwrap_or(0);
    let ch = char::from_u32(cp).unwrap_or('?');
    let (op, operand) = decode_cell(&cell);
    writeln!(out, "┌─ state ─────")?;
    writeln!(out, "│ step:   {}", vm.steps)?;
    writeln!(out, "│ ip:     ({}, {})", vm.ip.x, vm.ip.y)?;
    writeln!(out, "│ dir:    {}", dir_name(vm.ip.dx, vm.ip.dy))?;
    writeln!(out, "│ strmod: {}", if vm.strmode { "on" } else { "off" })?;
    writeln!(out, "│ halted: {}", if vm.halted { "yes" } else { "no" })?;
    writeln!(out, "│ cell:   {:?} (U+{:04X})", ch, cp)?;
    let op_line = if op == Op::PushDigit {
        format!("│ op:     {} (value={})", op.name(), operand)
    } else {
        format!("│ op:     {}", op.name())
    };
    writeln!(out, "{op_line}")?;
    writeln!(out, "└─────────────")?;
    Ok(())
}

fn render_stack(out: &mut dyn Write, vm: &Vm) -> io::Result<()> {
    writeln!(out, "┌─ stack (top first) ─")?;
    if vm.stack.is_empty() {
        writeln!(out, "│ (empty)")?;
    } else {
        let show = 20usize.min(vm.stack.len());
        for v in vm.stack.iter().rev().take(show) {
            writeln!(out, "│ {v}")?;
        }
        if vm.stack.len() > show {
            writeln!(out, "│ ... (+{} below)", vm.stack.len() - show)?;
        }
    }
    writeln!(out, "└─────────────────────")?;
    Ok(())
}

fn render_stdout(out: &mut dyn Write, captured: &[u8]) -> io::Result<()> {
    writeln!(out, "┌─ program stdout ─────")?;
    if captured.is_empty() {
        writeln!(out, "│ (no output)")?;
    } else {
        let text = String::from_utf8_lossy(captured);
        for line in text.lines() {
            writeln!(out, "│ {line}")?;
        }
        if !text.ends_with('\n') && !text.is_empty() {
            // No trailing newline — the last line has already been emitted,
            // so just close the panel.
        }
    }
    writeln!(out, "└──────────────────────")?;
    Ok(())
}

fn render_frame(out: &mut dyn Write, vm: &Vm, captured: &[u8]) -> io::Result<()> {
    write!(out, "{CLEAR_SCREEN}")?;
    writeln!(
        out,
        "windy debugger — [Enter]/s: step  c: run-to-halt  q: quit"
    )?;
    render_grid(out, vm)?;
    render_status(out, vm)?;
    render_stack(out, vm)?;
    render_stdout(out, captured)?;
    out.flush()?;
    Ok(())
}

/// Run the interactive debugger over `source`, returning the final exit code.
///
/// Reads commands from `stdin_commands`. The VM's own stdin is fixed as
/// an empty byte slice — Windy programs under the debugger can't prompt
/// for input because the real stdin is owned by the debugger loop.
pub fn debug_source(source: &str, stdin_commands: &mut dyn BufRead) -> i32 {
    debug_source_inner(source, stdin_commands, &mut io::stderr(), &mut io::stdout())
}

pub(crate) fn debug_source_inner(
    source: &str,
    commands: &mut dyn BufRead,
    stderr: &mut dyn Write,
    ui: &mut dyn Write,
) -> i32 {
    let (grid, scan_text) = parse(source);
    if detect(&scan_text) {
        let _ = writeln!(stderr, "{}", BANNER);
    }

    let mut captured_out: Vec<u8> = Vec::new();
    let mut captured_err: Vec<u8> = Vec::new();
    let mut empty_stdin: &[u8] = b"";
    let mut vm = Vm::new(grid, None, None);

    loop {
        let _ = render_frame(ui, &vm, &captured_out);
        if vm.halted {
            let _ = writeln!(ui, "program halted");
            return 0;
        }
        let _ = write!(ui, "> ");
        let _ = ui.flush();

        let mut line = String::new();
        match commands.read_line(&mut line) {
            Ok(0) | Err(_) => return 0,
            _ => {}
        }
        let cmd = line.trim().to_lowercase();

        match cmd.as_str() {
            "" | "s" | "step" => {
                vm.step(&mut empty_stdin, &mut captured_out, &mut captured_err);
                vm.steps += 1;
            }
            "c" | "cont" | "continue" | "r" | "run" => {
                let mut remaining = RUN_SAFETY_CAP;
                while !vm.halted && remaining > 0 {
                    vm.step(&mut empty_stdin, &mut captured_out, &mut captured_err);
                    vm.steps += 1;
                    remaining -= 1;
                }
                let _ = render_frame(ui, &vm, &captured_out);
                if !vm.halted {
                    let _ = writeln!(ui, "run budget exhausted");
                    return 124;
                }
                let _ = writeln!(ui, "program halted");
                return 0;
            }
            "q" | "quit" | "exit" => return 0,
            _ => {
                let _ = writeln!(ui, "unknown command: {:?}", cmd);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn drive(source: &str, commands: &str) -> (i32, String, String) {
        let mut cmds = Cursor::new(commands.as_bytes());
        let mut stderr: Vec<u8> = Vec::new();
        let mut ui: Vec<u8> = Vec::new();
        let code = debug_source_inner(source, &mut cmds, &mut stderr, &mut ui);
        (
            code,
            String::from_utf8(ui).unwrap(),
            String::from_utf8(stderr).unwrap(),
        )
    }

    #[test]
    fn quit_returns_zero() {
        let (code, _, _) = drive("@", "q\n");
        assert_eq!(code, 0);
    }

    #[test]
    fn step_then_quit() {
        let (code, _, _) = drive("5.@", "s\nq\n");
        assert_eq!(code, 0);
    }

    #[test]
    fn continue_runs_to_halt() {
        let (code, ui, _) = drive("\"A\",@", "c\n");
        assert_eq!(code, 0);
        assert!(ui.contains("program halted"));
        // Captured stdout of the inner program appears in the UI buffer.
        assert!(ui.contains("A"));
    }

    #[test]
    fn halt_detected_after_single_step() {
        let (code, _, _) = drive("@", "s\n");
        assert_eq!(code, 0);
    }

    #[test]
    fn unknown_command_is_surfaced_not_fatal() {
        let (code, ui, _) = drive("@", "nope\nc\n");
        assert_eq!(code, 0);
        assert!(ui.contains("unknown command"));
    }

    #[test]
    fn sisobus_banner_goes_to_stderr() {
        let (_, ui, err) = drive("\"sisobus\"@", "q\n");
        assert!(err.contains("Kim Sangkeun"));
        assert!(!ui.contains("Kim Sangkeun"));
    }
}
