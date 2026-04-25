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
- `examples/stars.wnd` — 5-row star triangle via stack pre-load + counter loop.
- `examples/factorial.wnd` — 1!..10!, demonstrating BigInt growth past i64.

## Run via WASI (no Rust toolchain required)

CI also publishes the interpreter as a WASI module at the same origin
as the playground. Anything that speaks WASI preview1 (`wasmtime`,
`wasmer`, Node `--experimental-wasi-unstable-preview1`) can run it:

```bash
curl -O https://<your-site>/windy.wasm
wasmtime --dir=. windy.wasm run examples/hello.wnd
```

The WASI binary is the same Rust crate as the native CLI, so semantics
are byte-identical with `cargo install`'d builds.

## Browser playground

The Rust VM also compiles to WebAssembly and loads directly in a
browser. No backend — the `.wnd` source is interpreted in the page.

```bash
wasm-pack build --target web --release --out-dir web/pkg
python3 -m http.server -d web 8000
# open http://localhost:8000
```

See [`web/README.md`](web/README.md) for details and deployment notes.

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

**v0.4** — 35 opcodes including `t` (SPLIT) for concurrent IPs. The
same Rust crate drives the native CLI, the interactive terminal
stepper (`windy debug`), and the static browser playground under
`web/`. See [SPEC.md §10](SPEC.md) for the forward roadmap.

Version history:
- **v0.1** — Python scaffold: interpreter, rich-based debugger,
  WASI output-baking stopgap. Retired.
- **v0.2** — Rust rewrite. Single crate at repo root powers the CLI.
- **v0.3** — Browser playground. `windy` compiled to wasm32 via
  wasm-bindgen; static HTML page runs `.wnd` source serverlessly.
- **v0.4** — Concurrent IPs via `t` (SPEC §3.5 / §3.6 / §4).

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
