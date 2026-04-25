# Windy

> A 2D esoteric programming language where code flows like wind.

[![Deploy to S3](https://github.com/sisobus/windy/actions/workflows/deploy.yml/badge.svg)](https://github.com/sisobus/windy/actions/workflows/deploy.yml)
[![crates.io](https://img.shields.io/crates/v/windy.svg)](https://crates.io/crates/windy)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Try it in your browser:** **[windy.sisobus.com](https://windy.sisobus.com)**

```
"!dlroW ,olleH"↓
        ↓      ←
        →:#,_@
```

```
$ windy run examples/hello_winds.wnd
Hello, World!
```

The name comes from the Pokémon 윈디 (Arcanine, but read as "windy" in
Korean). The wind-direction mechanic that the language is built around is a
thematic pun on that name.

## Why Windy

Windy started in the Befunge-98 family — same 2D grid, same
stack-with-self-modification, same concurrent IPs. v1.0 is where it
stops being a dialect and becomes its own language. What you get:

### The eight winds are the canonical surface

A program is a flow diagram. The instruction pointer (the IP) drifts across
the grid in one of **eight winds**, and Windy uses the Unicode arrows for
those winds as primary glyphs:

```
→  ↗  ↑  ↖  ←  ↙  ↓  ↘
```

ASCII (`>`  `^`  `<`  `v`) survives as an alias for typing convenience, but
the canonical printed form looks like a flow chart, with diagonals as
first-class citizens — there's no `q` / `r` opcode you have to remember; if
you can draw the path, you can encode it. The whole point is that you read
the program by following the wind, not by parsing text left-to-right.

### Wind has speed (`≫` / `≪`)

Each IP carries a strictly positive `speed` (default `1`) and advances
`speed` cells per tick. Only the destination cell decodes — intermediate
cells are not even read for unknown-glyph warnings or string-mode
toggles. **High wind blows past obstacles.** `≫` (GUST) bumps speed,
`≪` (CALM) trims it. `≪` at speed 1 is a *runtime trap* (exit 134)
rather than a silent clamp: calm in still air is an error, by design.

```
≫9.@@   →   "0 "    (speed=2 skips the 9; the `.` finds an empty stack)
9.@     →   "9 "    (the v0.4 reading; toggle --v0 to see it)
```

Speed is BigInt — there is no upper bound — which keeps the language's
"no bounded datatypes" promise consistent. See
[SPEC §3.7](SPEC.md#37-wind-speed).

### IPs collide (`t` + collision merge)

`t` (SPLIT) spawns a second IP behind the executing one. Until v1.0
they passed through each other forever. In v1.0, **end-of-tick
coincidence is a collision**, and the runtime merges any group of IPs
that share a cell:

- Stacks **concatenate** in birth order, oldest at the bottom.
- Directions are **summed and clipped** to `{-1, 0, +1}` per axis. A
  head-on storm — sum `(0, 0)` — cancels itself: the merged IP dies.
- Speed is the **max** over the constituents (strong wind absorbs
  weak), strmode is forced off, the oldest IP keeps its slot in the
  list.

The merge order is fully determined by birth order, so the outcomes
are reproducible across implementations. See
[SPEC §3.8](SPEC.md#38-ip-collision-merge).

### `~` (TURBULENCE) — let the weather decide

Standard Befunge has `?` to pick a random of four directions. Windy's `~`
picks uniformly from all eight winds, and it's seeded for reproducible runs
via `--seed N`. Speed is preserved across a turbulence event — the wind
swings, but it doesn't slacken.

### The `sisobus` watermark is part of the spec

Embed the substring `sisobus` anywhere in your source — even on a row the
IP never visits — and the interpreter prints a signed author banner to
stderr before the program runs:

```
╔═══════════════════════════════════════╗
║  Windy v1.0.0                         ║
║  Crafted by Kim Sangkeun (@sisobus)   ║
╚═══════════════════════════════════════╝
```

[SPEC §8](SPEC.md#8-the-sisobus-watermark) makes this **non-optional**: a
runtime that suppresses or alters the banner is non-conforming. It's the
language's way of saying that grid programs are signed art, not throwaway
text — and a hidden `sisobus` on a never-visited row is encouraged as a
copyright line.

### Tightenings the spec actually enforces

Befunge-98 leaves a lot to the implementation. Windy commits, by spec:

- **Stack values are arbitrary-precision integers.** `factorial.wnd` runs
  through `10!` (3,628,800) without thinking; `100!` would too. No silent
  i32 / i64 wraparound, no "implementation-defined" range.
- **Wind speed is unbounded.** Same promise applies to the `speed`
  field — `≫` repeated a million times is legal; the IP just lands
  far out in the empty far field of the grid where every cell is a
  NOP.
- **The grid is bi-infinite and sparse.** Negative `g` / `p` coordinates
  are perfectly legal; cells you never write occupy zero memory.
- **Concurrent IPs are tick-deterministic.** Each tick is one round-robin
  pass over live IPs in birth order. New IPs born this tick wait until
  the next; `@` halts only the executing IP; collision merges happen
  in birth order. The same source, seed, and stdin produce the same
  stdout — across the native CLI, the WASI binary, and the browser
  playground.

### One Rust crate, three deploys

The same `windy` crate runs in three places:

| target                       | what you get                                  |
|------------------------------|-----------------------------------------------|
| native (`cargo install`)     | a CLI: `windy run` / `windy debug` / `windy version` |
| `wasm32-wasip1` (`wasmtime`) | portable `windy.wasm`, no Rust toolchain      |
| `wasm32-unknown-unknown` (browser) | the playground at [windy.sisobus.com](https://windy.sisobus.com) |

Two shared conformance harnesses (`conformance/cases.json` for the
v0.4 surface, `conformance/v1.json` for the speed + collision cases)
pin stdout byte-for-byte across all three targets — divergence breaks
CI. The v1 harness also re-runs every v0.4 case under v1.0 semantics
to enforce the additivity promise (programs that don't use `≫` / `≪`
and don't produce a collision behave identically under both).

### The legacy gate (`--v0`)

If you wrote a program against v0.4 and want to compare, every entry
point accepts a `--v0` legacy gate: native CLI, the WASI binary, and
the browser toolbar all expose the same toggle. Under `--v0` the
runtime is bit-identical to pre-1.0 — `≫` and `≪` decode as unknown
glyphs (NOP + warning), and the collision pass is skipped.

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
- `examples/split.wnd` — concurrent IPs via `t` (SPLIT). Two IPs run side
  by side, each with its own stack, both halting cleanly via their own `@`.
- `examples/gust.wnd` — wind speed (`≫` GUST) skipping a digit cell. Run
  with `--v0` to compare against the v0.4 reading.
- `examples/storm.wnd` — head-on collision: two IPs meeting on the same
  cell with opposite directions cancel each other and the program halts
  cleanly.

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

**v1.0** — 35 opcodes. Wind speed (`≫` GUST / `≪` CALM) and IP collision
merge are normative; `--v0` keeps the v0.4 surface available as a legacy
gate. The same Rust crate drives the native CLI, the interactive terminal
stepper (`windy debug`), the WASI module shipped to
[windy.sisobus.com/windy.wasm](https://windy.sisobus.com/windy.wasm),
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
- **v0.5** — WASI distribution channel; crate metadata + LICENSE polish.
- **v1.0** — Wind speed (`≫` / `≪`, SPEC §3.7) and IP collision merge
  (SPEC §3.8). v0.4 remains reachable behind `--v0`. The cut is also
  the first crates.io publish and the moment the repo went public.
- **v1.x** *(planned)* — Mid-segment IP crossing detection, fingerprint
  / extension mechanism, optional standard-library overlays. See
  [SPEC §10](SPEC.md#10-reserved-for-future-versions).

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
