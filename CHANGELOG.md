# Changelog

All notable changes to Windy are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

The crate on crates.io is `windy-lang`; the language and the installed
binary are both `windy`. References to "the crate" below always mean
`windy-lang` v$X.Y.Z`.

## [Unreleased]

### Added

- **Vim-style modal editor** in the playground. The source
  textarea now starts in **NORMAL** (a small badge above the
  editor labels the current mode); first-time visitors who only
  pick an example and hit Run/Debug never notice. Power users
  hit `i` to enter INSERT and type, `Esc` to return.
  - **NORMAL keybindings**: `hjkl` + `yubn` for the eight winds
    (rogue-like 3×3 compass), `0` / `$` for line edges, `i` /
    `a` / `o` / `O` to enter INSERT, `x` to blank a cell, arrow
    keys for navigation. Every nav move auto-pads the destination
    row with spaces, so moving "down past the end of a short
    line" lands at the same column instead of dumping the cursor
    at column 0.
  - **Glyph palette + mode interaction**: clicking a wind glyph in
    INSERT inserts it, switches back to NORMAL, and advances the
    cursor in that wind's direction — so the user "draws the
    path" by chaining clicks. In NORMAL, the same click just
    navigates (no insert). `≫` `≪` `·` always insert (you can't
    type them on a keyboard) without changing mode.
  - **Mobile**: a small `i / Esc` toggle button next to the mode
    badge replaces the missing physical Esc key.
- **`docs/esolangs-wiki.md`** — MediaWiki-syntax draft of the
  esolangs.org wiki entry, bracketed with begin/end markers so
  the upload procedure (paste between markers into
  https://esolangs.org/wiki/Windy) is self-explanatory.
- **`examples/add.wnd`** — minimal stdin demo: `&&+.@` reads two
  decimal integers, prints their sum.

### Fixed

- **Glyph palette click**: source textarea regained focus after
  insertion (was the existing behavior; preserved through the
  modal editor refactor).

## [2.0.0] — 2026-04-26

Breaking-change cut. Removes the v0.4 legacy gate, tightens the
language surface to a single set of semantics, and ships
all-mechanic example programs.

### Added

- **`examples/winds.wnd`** — a multi-IP exhibit. Four `t` SPLITs
  in a row push the live IP list up to five (1 parent + 4 children)
  at peak; each child immediately redirects south via a `↓` cell on
  its spawn position, descends ten rows of NOP space, and halts at
  its own `@` on row 10. The parent uses `#` (TRAMPOLINE) before
  each `t` to skip the `↓` redirects so they never apply to itself.
  Demonstrates cascade avoidance with multiple SPLITs, alongside
  `examples/storm.wnd` (head-on collision merge).

### Changed

- **`examples/anthem.wnd`** rewritten as a clockwise diagonal-
  cornered spiral that exercises all four v2.0 mechanics in one
  program. The IP rides the perimeter at speed 2 with `↘ ↙ ↖`
  corner glyphs, prints "code flows like wind" along the way,
  then drops to speed 1 at the eye of the spiral, runs `t` to
  spawn a counter-going child, and parent + child arrive at the
  same cell from opposite sides on the next tick. The end-of-tick
  collision pass cancels them head-on, the live IP list empties,
  and the program halts. There is no `@` anywhere in the file.
  Earlier vertical-cascade and hollow-spiral versions are gone.
- **SPEC** bumped to v2.0. §9 drops the `--v0` row; §11
  Versioning rewrites the conformance promise to refer only to
  the current single-mode language.
- **Crate version 1.0.0 → 2.0.0** on crates.io as `windy-lang`.
- **Playground UI** polish: Run / Debug now sit on their own row
  beneath the picker + inputs (they used to be visually
  clustered with the Max-steps input); Debug picks up the
  outlined `secondary` style so it reads as the alternate path
  instead of a duplicate primary; button padding tightened;
  `touch-action: manipulation` added to toolbar buttons and the
  grid view so iOS/Android no longer hijack rapid Step taps as a
  pinch-zoom; "Copy link" button removed (the URL bar already
  reflects the current source via the `#s=...` hash).

### Removed

- **`--v0` CLI flag.** The wind-speed (≫/≪) and IP-collision-merge
  semantics introduced in v1.0 were always the language going
  forward; the legacy gate let callers opt into the pre-1.0 surface
  for migration. v2.0 deletes the gate. Programs that depended on
  the legacy surface should pin a v1.x release of the reference
  implementation, or `git checkout` the repo at the v1.0.0 tag.
- **`RunOptions.v1` field**, **`Vm::with_v1` constructor**, and the
  wasm `run` / `Session::new` `v1: Option<bool>` parameter — public
  API surface that only existed to support the gate.
- **`v0_*` unit tests** and `tests/conformance_v1.rs::v0_cases_pass_under_v1_mode`
  (the additivity guard). Both were proving "v0 semantics still
  reachable when the gate is set"; with the gate gone, neither has
  anything to prove.
- **Web playground v0 toggle** and the in-browser framing that
  required users to choose a mode before running anything.

### Fixed

- **Browser playground source loading**. The `anthem` entry in
  `web/main.js`'s `EXAMPLES` map closed its template literal with
  an escaped backtick (`\\\``), which JS treats as a literal
  character — so the template stayed open, swallowed the rest of
  the file, and the module failed to load (no example source ever
  appeared in the editor when picked). Replace with a real backtick.

### Migration

- CLI: drop the `--v0` flag from your scripts. v1.0's default
  (no flag = full v1 semantics) is now the only behavior.
- Library: stop passing `v1: false` (or `v1: true`) when
  constructing `RunOptions`; the field is gone. Replace
  `Vm::with_v1(grid, seed, max, true)` with `Vm::new(grid, seed, max)`.
- wasm: stop passing the trailing `v1` argument to `run()` /
  `new Session(...)`; the parameter is gone.

## [1.0.0] — 2026-04-25

The first stable release. Wind speed and IP collision merge become
normative; the v0.4 surface remains available as a legacy gate.

### Added

- **Wind speed** (SPEC §3.7). Each IP carries an unbounded positive
  integer `speed` field (default `1`) and advances `speed` cells per
  tick. Only the destination cell decodes — intermediate cells are
  not read at all. Two new opcodes: `≫` (GUST, `speed += 1`) and
  `≪` (CALM, `speed -= 1`; runtime trap if it would yield 0).
- **IP collision merge** (SPEC §3.8). End-of-tick coincidence of two
  or more IPs on the same cell triggers a merge: stacks concatenate
  in birth order (oldest at the bottom), directions sum and clip
  per axis to `{-1, 0, +1}` (head-on `(0,0)` ⇒ merged IP dies),
  speed becomes `max`, strmode resets to off. The pass also serves
  as a runtime garbage collector for IPs in cyclic layouts.
- **Trap exit code** `134` for `≪` at speed 1 ("calm in still air").
- **`--v0` legacy gate** on the CLI, the WASI binary, the wasm
  `Session` / `run` API, and the playground toolbar. Under the gate,
  `≫` / `≪` decode as Unknown (NOP + warning) and the collision
  pass is skipped — bit-identical to v0.4.
- **`conformance/v1.json`** with 4 cases (gust skip, gust/calm cycle,
  calm@1 trap, 2× gust) and `tests/conformance_v1.rs` harness.
- **Additivity guard** (`v0_cases_pass_under_v1_mode`): every v0.4
  conformance case is re-run under v1.0 semantics to confirm that
  programs without `≫`/`≪` and without collisions behave identically
  under both gates.
- **`examples/gust.wnd`** (wind speed obstacle course — same source
  prints `WINDY` under v1, `ID\0\0\0` under v0) and
  **`examples/storm.wnd`** (head-on collision; v1 cleanly halts
  via merge, v0 fork-bombs without the merge as IP-GC).

### Changed

- **Crate version 0.4.0 → 1.0.0.** Banner picks up via
  `CARGO_PKG_VERSION`.
- **Crate name on crates.io is `windy-lang`** (the bare `windy` was
  taken by an unrelated Windows-strings library). The library and
  the installed binary are still `windy`; only the install command
  is `cargo install windy-lang`.
- **CLI: `--v1` removed; `--v0` added.** v1.0 semantics are now the
  default. The legacy gate is opt-in.
- **`Vm::new` now defaults to v1 semantics.** Use `Vm::with_v1(.., false)`
  to construct in legacy mode.
- **wasm `Session::new` / `run` defaults flipped.** `v1: Option<bool>`
  with `None` ⇒ `true` (v1 semantics).
- **SPEC promoted from v0.4 to v1.0.** The "Pre-release: v1.0
  (proposal)" section dissolves into normative §3.7 (Wind Speed),
  §3.8 (IP Collision — Merge), and §4 opcode-table additions
  (`≫` U+226B, `≪` U+226A). §11 Versioning explicitly catalogs the
  additivity promise.

### Removed

- The "Pre-release: v1.0 (proposal)" SPEC section as a discrete
  block — its content is now distributed across the normative
  sections above.

### Notes

- This release is the first crates.io publish and the first
  GitHub-public point in the project's history.
- The crate ships both `conformance/cases.json` (v0.4 surface) and
  `conformance/v1.json` (v1.0 wind speed + collision merge); any
  third-party implementation MUST pass both byte-for-byte, with
  the legacy gate honoring `cases.json` and the default mode
  honoring both.

## [0.5.0] — pre-release (folded into 1.0)

Distribution-channel polish that landed before the v1.0 cut.
Released only under the v1.0 tag; never published independently.

### Added

- **`wasm32-wasip1` target** producing a portable `windy.wasm` for
  any WASI host (`wasmtime`, `wasmer`, Node `--experimental-wasi`).
  CI builds it and serves it next to the playground.
- **MIT `LICENSE`** file.
- **`Cargo.toml` metadata** (keywords, categories, anchored include
  list) for clean `cargo package`.
- **Cache-bust mechanism** for the playground — `?v=<short-sha>` on
  static asset URLs, replaced by CI per deploy, paired with
  CloudFront `/*` invalidation.

### Changed

- `wasm-bindgen` cfg narrowed to `target_os = "unknown"` so the
  WASI target stops dragging in browser-only crates.

## [0.4.0] — 2026

Concurrent IPs.

### Added

- **`t` (SPLIT) opcode** spawning a new IP at `(x − dx, y − dy)`
  going `(−dx, −dy)` with empty stack and string mode off (SPEC
  §3.5 / §3.6 / §4).
- **Multi-IP VM** — `Vec<IpContext>`, tick-based birth-order
  scheduling, `@` removes only the executing IP.
- **wasm API multi-IP support** — `ip_count`, `ip_positions()`,
  `stack_for(i)`, `stack_len_for(i)`, `strmode_for(i)`. The
  browser debugger highlights every live IP cell and renders a
  per-IP labelled stack section.
- **`examples/split.wnd`** — visible concurrent-IP demo.

## [0.3.0] — 2026

Browser playground.

### Added

- **`wasm32-unknown-unknown` target** with `cdylib` + `wasm-bindgen`.
- **Static playground** under `web/` (HTML / CSS / JS, dark mode,
  mobile sticky toolbar, tap-to-step).
- **Browser debugger** via the `Session` API: Step / Continue /
  Restart / Exit, keyboard bindings, opcode reference panel.
- **URL hash permalink** (`#s=<base64url>`).
- **GitHub Actions deploy** to S3 + CloudFront.

## [0.2.0] — 2026

Rust rewrite. The Python scaffold is retired and the single Rust
crate at the repo root powers everything afterwards.

### Added

- Rust crate (`lib + bin`), 32 opcode VM (later 33 in v0.4 with the
  addition of SPLIT), `clap` CLI.
- `conformance/cases.json` + Rust harness.
- `windy debug` subcommand — terminal stepper, no TUI crate
  dependency (ANSI escapes + Unicode box drawing).

### Removed

- The v0.1 Python interpreter and the WASI output-baking stopgap
  (`wasm.py`). Per-program AOT became obsolete the moment the
  interpreter itself shipped as WebAssembly in v0.3.

## [0.1.0] — 2026

Initial scaffold. Python interpreter, rich-based debugger, WASI
output-baking stopgap. Retired by v0.2.

[1.0.0]: https://github.com/sisobus/windy/releases/tag/v1.0.0
