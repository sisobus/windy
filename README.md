# Windy

> A 2D esoteric programming language where code flows like wind.

Windy is a Befunge-family esolang. Programs live on an infinite 2D grid. An
instruction pointer drifts across the grid in one of eight directions — the
"winds" — and executes each cell it visits.

The name comes from the Pokémon 윈디 (Arcanine). The directional-wind mechanic
is a thematic pun.

```
"!dlroW ,olleH",,,,,,,,,,,,,@
```

```
$ windy run examples/hello.wnd
Hello, World!
```

## Highlights

- **Turing complete** — infinite grid, arbitrary-precision integers,
  self-modifying code via `g` / `p`.
- **Single Rust VM** — powers both the native CLI and the planned browser
  playground (v0.3).
- **Interactive debugger** — step through programs with a live view of the
  grid, the IP, and the stack.
- **sisobus watermark** — embed `sisobus` anywhere in your source to sign
  your program with an author banner.

## Install

Requires a stable Rust toolchain (1.75+). Install via
[rustup](https://rustup.rs/) if you don't have it.

```bash
git clone https://github.com/sisobus/windy.git
cd windy
cargo install --path .
```

Or run without installing:

```bash
cargo run --release -- run examples/hello.wnd
```

## Usage

```bash
windy --help
windy run examples/hello.wnd
windy run --seed 42 --max-steps 1000 examples/fib.wnd
windy version
```

## Examples

- `examples/hello.wnd` — straight-line "Hello, World!".
- `examples/hello_winds.wnd` — 2D loop routing with the sisobus watermark.
- `examples/fib.wnd` — first ten Fibonacci numbers, state stored via `g` / `p`.

A Brainfuck interpreter written in Windy — the constructive
Turing-completeness witness from SPEC §6 — lands in v0.3 as
`examples/bf.wnd` alongside the browser playground.

## Documentation

- **[SPEC.md](SPEC.md)** — the complete language specification. Source of
  truth for every implementation detail.
- **[CLAUDE.md](CLAUDE.md)** — development context for AI pair-programming.

## Testing

```bash
cargo test                  # unit tests (per-module)
cargo test --test conformance   # shared goldens (conformance/cases.json)
```

The conformance JSON is language-neutral; future implementations
(browser-side JS, WASM, etc.) are expected to consume the same file.

## Status

**v0.1** shipped an interpreter, interactive debugger, and WebAssembly
output-baking stopgap in Python. **v0.2** retires the Python codebase and
reimplements the VM in Rust — the single crate in this repo drives both the
native CLI now and the browser playground in v0.3. See
[SPEC.md §10](SPEC.md) for the forward roadmap.

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
