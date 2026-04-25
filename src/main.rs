//! Windy CLI — `windy run` / `windy debug` / `windy version`.
//!
//! The v0.1 `compile` subcommand (Python output-baking stopgap) is
//! retired — per-program AOT becomes obsolete once the interpreter
//! itself ships as WebAssembly in v0.3 (SPEC §10).

use clap::{Parser, Subcommand};
use std::fs;
use std::io;
use std::path::PathBuf;
use std::process::ExitCode as ProcessExit;
use windy::{debug_source, run_source, RunOptions, VERSION};

#[derive(Parser)]
#[command(
    name = "windy",
    version = VERSION,
    about = "Windy — 2D esolang where code flows like wind"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run a Windy program on the bytecode VM.
    Run {
        /// Path to the .wnd source file.
        file: PathBuf,
        /// Seed for the ~ (turbulence) RNG.
        #[arg(long)]
        seed: Option<u64>,
        /// Halt after N executed steps (exit 124 if exceeded).
        #[arg(long = "max-steps")]
        max_steps: Option<u64>,
        /// Enable v1.0 (proposal) semantics: wind speed (≫/≪) and IP
        /// collision merge. Off by default — without this flag the
        /// runtime is bit-identical to v0.4.
        #[arg(long = "v1")]
        v1: bool,
    },
    /// Step through a Windy program interactively.
    Debug {
        /// Path to the .wnd source file.
        file: PathBuf,
        /// Enable v1.0 (proposal) semantics in the debugger.
        #[arg(long = "v1")]
        v1: bool,
    },
    /// Print the Windy version.
    Version,
}

fn main() -> ProcessExit {
    let cli = Cli::parse();
    match cli.cmd {
        Command::Version => {
            println!("Windy {}", VERSION);
            ProcessExit::from(0)
        }
        Command::Run { file, seed, max_steps, v1 } => {
            let source = match fs::read_to_string(&file) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("windy: cannot read {}: {}", file.display(), e);
                    return ProcessExit::from(2);
                }
            };
            let mut stdin = io::stdin().lock();
            let mut stdout = io::stdout().lock();
            let mut stderr = io::stderr().lock();
            let code = run_source(
                &source,
                RunOptions {
                    seed,
                    max_steps,
                    v1,
                    stdin: &mut stdin,
                    stdout: &mut stdout,
                    stderr: &mut stderr,
                },
            );
            ProcessExit::from(code.code() as u8)
        }
        Command::Debug { file, v1 } => {
            let source = match fs::read_to_string(&file) {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("windy: cannot read {}: {}", file.display(), e);
                    return ProcessExit::from(2);
                }
            };
            let mut stdin = io::stdin().lock();
            let code = debug_source(&source, &mut stdin, v1);
            ProcessExit::from(code.clamp(0, 255) as u8)
        }
    }
}
