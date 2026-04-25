# Windy

> A 2D esoteric programming language where code flows like wind.

[![Deploy to S3](https://github.com/sisobus/windy/actions/workflows/deploy.yml/badge.svg)](https://github.com/sisobus/windy/actions/workflows/deploy.yml)
[![crates.io](https://img.shields.io/crates/v/windy.svg)](https://crates.io/crates/windy)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Try it in your browser:** **[windy.sisobus.com](https://windy.sisobus.com)**

Windy is a Befunge-98 dialect with a Unicode-first surface and a mandatory
author-signature watermark. Programs live on an infinite 2D grid. An
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

- **33 opcodes**, including concurrent IPs via `t` (SPLIT).
- **Turing complete** — infinite sparse grid, arbitrary-precision integers
  (`BigInt` everywhere), and self-modifying code via `g` / `p`.
- **Single Rust crate** powers the native CLI, the WASI distribution, and the
  in-browser playground.
- **Interactive debugger** — step through programs with a live view of the
  grid, the IP, and the stack. Native (`windy debug`) and in-browser (Debug
  mode in the playground).
- **sisobus watermark** — embed `sisobus` anywhere in your source to sign
  your program with an author banner.

## Install

### Native (cargo)

Requires a stable Rust toolchain (1.75+). Install via
[rustup](https://rustup.rs/) if you don't have it.

```bash
cargo install --git https://github.com/sisobus/windy
# once published to crates.io:
cargo install windy
```

Or build from a clone:

```bash
git clone https://github.com/sisobus/windy.git
cd windy
cargo build --release
./target/release/windy run examples/hello.wnd
```

### Run via WASI (no Rust toolchain)

CI publishes the interpreter as a WASI module alongside the playground.
Anything that speaks WASI preview1 (`wasmtime`, `wasmer`, Node
`--experimental-wasi-unstable-preview1`) can run it:

```bash
curl -O https://windy.sisobus.com/windy.wasm
wasmtime --dir=. windy.wasm run examples/hello.wnd
```

The WASI binary is the same Rust crate as the native CLI — semantics are
byte-identical.

## Usage

```bash
windy --help
windy run examples/hello.wnd
windy run --seed 42 --max-steps 1000 examples/fib.wnd
windy debug examples/hello_winds.wnd
windy version
```

## Examples

- `examples/hello.wnd` — straight-line "Hello, World!".
- `examples/hello_winds.wnd` — 2D loop routing with the sisobus watermark.
- `examples/fib.wnd` — first ten Fibonacci numbers, state stored via `g` / `p`.
- `examples/stars.wnd` — 5-row star triangle via stack pre-load + counter loop.
- `examples/factorial.wnd` — 1! through 10!, demonstrating BigInt growth past i64.

## Browser playground

The same Rust VM also compiles to WebAssembly via `wasm-bindgen` and loads
directly in a browser. No backend — `.wnd` source is interpreted in the page,
including the step debugger.

Build locally:

```bash
wasm-pack build --target web --release --out-dir web/pkg
python3 -m http.server -d web 8000
# open http://localhost:8000
```

See [`web/README.md`](web/README.md) for build and deployment notes.

## Documentation

- **[SPEC.md](SPEC.md)** — the complete language specification. Source of
  truth for every implementation detail.
- **[CLAUDE.md](CLAUDE.md)** — development context for AI pair-programming.

## Testing

```bash
cargo test                       # unit tests (per-module)
cargo test --test conformance    # shared goldens (conformance/cases.json)
```

The conformance JSON is language-neutral; future implementations are expected
to consume the same file.

## Status

**v0.4** — 33 opcodes including `t` (SPLIT) for concurrent IPs. The same Rust
crate drives the native CLI, the interactive terminal stepper (`windy debug`),
the WASI module shipped to [windy.sisobus.com/windy.wasm](https://windy.sisobus.com/windy.wasm),
and the static browser playground at [windy.sisobus.com](https://windy.sisobus.com).
See [SPEC.md §10](SPEC.md#10-reserved-for-future-versions) for the forward
roadmap.

Version history:
- **v0.1** — Python scaffold: interpreter, rich-based debugger, WASI
  output-baking stopgap. Retired.
- **v0.2** — Rust rewrite. Single crate at repo root powers the CLI.
- **v0.3** — Browser playground. `windy` compiled to wasm32 via wasm-bindgen;
  static HTML page runs `.wnd` source serverlessly.
- **v0.4** — Concurrent IPs via `t` (SPEC §3.5 / §3.6 / §4).
- **v0.5** *(in progress)* — WASI distribution, crates.io publish prep,
  README polish.
- **v1.0** *(planned)* — Adopt at least one semantic feature without precedent
  in the Befunge family so Windy stops being a "dialect with a haircut".
  Candidate directions are catalogued in
  [SPEC §10](SPEC.md#10-reserved-for-future-versions).

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
