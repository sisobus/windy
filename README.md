# Windy

> A 2D esoteric programming language where code flows like wind.

[![Deploy to S3](https://github.com/sisobus/windy/actions/workflows/deploy.yml/badge.svg)](https://github.com/sisobus/windy/actions/workflows/deploy.yml)
[![crates.io](https://img.shields.io/crates/v/windy-lang.svg)](https://crates.io/crates/windy-lang)
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
Korean). The wind-direction mechanic that the language is built around
is a thematic pun on that name.

## Why Windy

Windy is a tiny, deterministic, infinite-grid 2D language. A program
is a flow chart you can read by eye: an **instruction pointer** (IP)
drifts across the grid in one of eight winds, can speed up and skip
past obstacles, can split into multiple IPs, and merges any IPs that
crash into each other. The whole language is **35 opcodes** — no
functions, no types, no standard library. Structure is emergent from
layout.

### The eight winds are the canonical surface

A program is a flow diagram. The IP drifts across the grid in one of
**eight winds**, and Windy uses the Unicode arrows for those winds
as primary glyphs:

```
   ↖   ↑   ↗
   ←   ·   →
   ↙   ↓   ↘
```

The four cardinals also accept ASCII aliases (`>` `^` `<` `v`) for
typing convenience, but the canonical printed form looks like a flow
chart, with diagonals as first-class citizens — there's no `q` / `r`
opcode you have to remember; if you can draw the path, you can
encode it. The whole point is that you read the program by following
the wind, not by parsing text left-to-right.

### Wind has speed (`≫` / `≪`)

Each IP carries a strictly positive `speed` (default `1`) and
advances `speed` cells per tick. Only the destination cell decodes —
intermediate cells are not even read for unknown-glyph warnings or
string-mode toggles. **High wind blows past obstacles.** `≫` (GUST)
bumps speed, `≪` (CALM) trims it. `≪` at speed 1 is a *runtime trap*
(exit 134) rather than a silent clamp: calm in still air is an
error, by design.

```
≫9.@@   →   "0 "    (speed=2 skips the 9; the `.` finds an empty stack)
```

Speed is BigInt — there is no upper bound — which keeps the
language's "no bounded datatypes" promise consistent. See
[SPEC §3.7](SPEC.md#37-wind-speed).

### IPs collide (`t` + collision merge)

`t` (SPLIT) spawns a second IP behind the executing one. Whenever
two or more IPs share a cell at end of tick, the runtime merges
them:

- Stacks **concatenate** in birth order, oldest at the bottom.
- Directions are **summed and clipped** to `{-1, 0, +1}` per axis. A
  head-on storm — sum `(0, 0)` — cancels itself: the merged IP dies.
- Speed is the **max** over the constituents (strong wind absorbs
  weak), strmode is forced off, the oldest IP keeps its slot in the
  list.

The merge order is fully determined by birth order, so collision
outcomes are reproducible across implementations. See
[SPEC §3.8](SPEC.md#38-ip-collision-merge).

### `~` (TURBULENCE) — let the weather decide

Windy's `~` picks uniformly from all eight winds, and it's seeded
for reproducible runs via `--seed N`. Speed is preserved across a
turbulence event — the wind swings, but it doesn't slacken.

### What the spec actually enforces

- **Stack values are arbitrary-precision integers.** `factorial.wnd`
  runs through `10!` (3,628,800) without thinking; `100!` would too.
  No silent i32 / i64 wraparound, no "implementation-defined" range.
- **Wind speed is unbounded.** Same promise applies to the `speed`
  field — `≫` repeated a million times is legal; the IP just lands
  far out in the empty far field of the grid where every cell is a
  NOP.
- **The grid is bi-infinite and sparse.** Negative `g` / `p`
  coordinates are perfectly legal; cells you never write occupy
  zero memory.
- **Concurrent IPs are tick-deterministic.** Each tick is one
  round-robin pass over live IPs in birth order. New IPs born this
  tick wait until the next; `@` halts only the executing IP;
  collision merges happen in birth order. The same source, seed,
  and stdin produce the same stdout — across the native CLI, the
  WASI binary, and the browser playground.

### One Rust crate, three deploys

The same crate runs in three places:

| target                       | what you get                                  |
|------------------------------|-----------------------------------------------|
| native (`cargo install`)     | a CLI: `windy run` / `windy debug` / `windy version` |
| `wasm32-wasip1` (`wasmtime`) | portable `windy.wasm`, no Rust toolchain      |
| `wasm32-unknown-unknown` (browser) | the playground at [windy.sisobus.com](https://windy.sisobus.com) |

A shared conformance harness pins stdout byte-for-byte across all
three targets — divergence breaks CI.

## Install

### Native (cargo)

Requires a stable Rust toolchain (1.75+). Install via
[rustup](https://rustup.rs/) if you don't have it.

```bash
cargo install windy-lang
# or, from the git tip:
cargo install --git https://github.com/sisobus/windy
```

The crates.io package is `windy-lang`; the installed binary is
`windy`.

Or build from a clone:

```bash
git clone https://github.com/sisobus/windy.git
cd windy
cargo build --release
./target/release/windy run examples/hello.wnd
```

### Run via WASI (no Rust toolchain)

CI publishes the interpreter as a WASI module alongside the
playground. Anything that speaks WASI preview1 (`wasmtime`,
`wasmer`, Node `--experimental-wasi-unstable-preview1`) can run it:

```bash
curl -O https://windy.sisobus.com/windy.wasm
wasmtime --dir=. windy.wasm run examples/hello.wnd
```

The WASI binary is the same Rust crate as the native CLI —
semantics are byte-identical.

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
- `examples/hello_winds.wnd` — 2D loop routing.
- `examples/fib.wnd` — first ten Fibonacci numbers, state stored
  via `g` / `p`.
- `examples/stars.wnd` — 5-row star triangle via stack pre-load +
  counter loop.
- `examples/factorial.wnd` — 1! through 10!, demonstrating BigInt
  growth past i64.
- `examples/split.wnd` — concurrent IPs via `t` (SPLIT). Two IPs
  run side by side, each with its own stack, both halting cleanly
  via their own `@`.
- `examples/gust.wnd` — wind speed (`≫`) shaping the output:
  speed=2 skips decoy cells and prints "WINDY".
- `examples/storm.wnd` — head-on IP collision; the merge pass
  cancels both IPs and the program halts cleanly.
- `examples/anthem.wnd` — multi-row wind-tunnel ASCII art that
  prints "code flows like wind". Speed=2 lets the IP descend
  through walls of `↘` and `↗` without ever decoding them, only
  landing on the print row in between.

## Browser playground

The same Rust VM also compiles to WebAssembly via `wasm-bindgen`
and loads directly in a browser. No backend — `.wnd` source is
interpreted in the page, including the step debugger.

Build locally:

```bash
wasm-pack build --target web --release --out-dir web/pkg
python3 -m http.server -d web 8000
# open http://localhost:8000
```

See [`web/README.md`](web/README.md) for build and deployment notes.

## Documentation

- **[SPEC.md](SPEC.md)** — the complete language specification.
  Source of truth for every implementation detail.
- **[CHANGELOG.md](CHANGELOG.md)** — release history.
- **[CLAUDE.md](CLAUDE.md)** — development context for AI
  pair-programming.

## Testing

```bash
cargo test                       # unit + conformance
cargo test --test conformance    # the language-neutral goldens only
```

The conformance JSON is language-neutral; future implementations
are expected to consume the same file.

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
