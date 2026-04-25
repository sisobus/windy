# Windy Language Specification — v0.4

This document is the single source of truth for the Windy programming language.
Implementations (the reference Python interpreter, the WASM backend, any future
ports) MUST conform to the semantics defined here. Deviations are bugs.

---

## 1. Overview

Windy is a two-dimensional esoteric programming language in the Befunge family.
A program is a grid of Unicode characters. An **instruction pointer** (IP)
drifts across the grid in one of eight directions — the "winds" — and executes
each cell it visits. The language is:

- **Turing-complete** — unbounded grid, arbitrary-precision integers,
  self-modifying code.
- **Stack-based** — a single unbounded LIFO stack of integers.
- **Visually directional** — control flow is written as arrows (`→ ↗ ↑ ↖ ← ↙ ↓ ↘`).
- **WebAssembly-compilable** — programs can be compiled to portable `.wasm`
  modules via the reference backend.

The name *Windy* is the Korean reading of the Pokémon Arcanine. The language's
directional-wind mechanic is a thematic pun on that name, not a direct
reference to the Pokémon's type or abilities.

---

## 2. Design Philosophy

1. **Authorial identity is built in.** Every source file may be watermarked
   with the `sisobus` signature (§8). Programs without this signature execute
   normally; programs *with* it print an author banner before execution.
2. **Visual by construction.** Program text should read like a flow diagram.
   Directional glyphs are primary; ASCII aliases exist only for the four
   cardinal directions, and only as a convenience.
3. **Small core, emergent complexity.** The language has exactly 33 opcodes.
   There are no functions, types, modules, or standard library. All structure
   is emergent from grid layout.
4. **No bounded datatypes.** The grid, the stack, and integer values are all
   conceptually unbounded. Implementations MUST use arbitrary-precision
   integers and sparse grid storage.

---

## 3. Execution Model

### 3.1 The Grid

- A partial function `G : ℤ × ℤ → ℤ` mapping `(x, y)` coordinates to an integer
  cell value. Each cell value is a Unicode codepoint.
- Missing cells default to `0x20` (ASCII space, a NOP).
- The grid is **infinite** in all four directions. Implementations MUST store
  it sparsely (e.g., a hash map keyed on `(x, y)`).
- Coordinate convention: **+x is east, +y is south.** Origin `(0, 0)` is the
  top-left cell of the source file.

### 3.2 Instruction Pointer (IP)

- State: position `(x, y)` and direction `(dx, dy)`, where
  `dx, dy ∈ {-1, 0, +1}` and at least one of `dx, dy` is non-zero.
- **Initial position**: `(0, 0)`.
- **Initial direction**: east, `(1, 0)`.
- After each instruction executes, the IP advances by `(dx, dy)`.

### 3.3 Stack

- An unbounded LIFO stack of arbitrary-precision signed integers.
- Initially empty.
- **Underflow is non-fatal.** Popping from an empty stack yields `0`.

### 3.4 String Mode

- A single boolean flag, initially `false`.
- When `true`, each cell the IP visits has its integer codepoint pushed to
  the stack. The only exception is `"` itself, which toggles the flag back
  to `false`.
- When `false`, cells are decoded and executed as opcodes normally.

### 3.5 Concurrent IPs

A Windy program is driven by an **ordered list of IPs**. Each IP owns
its own `(position, direction, stack, strmode)` tuple; the grid is
shared. Initially the list contains a single IP — position `(0, 0)`,
direction east, empty stack, string mode off.

New IPs are spawned by `t` (SPLIT, §4). When `t` executes on an IP at
position `(x, y)` with direction `(dx, dy)`, a **new IP** is appended
to the end of the list at position `(x - dx, y - dy)` with direction
`(-dx, -dy)`, an empty stack, and string mode off. The executing IP is
otherwise unchanged — it advances normally. The `(x - dx, y - dy)`
offset (one cell "behind" the executing IP along its original heading)
guarantees that the new IP does NOT re-execute the `t` cell on its
next tick, which would otherwise cause an infinite split cascade.

### 3.6 Main Loop

```
IPs ← [ IP(position=(0,0), dir=(1,0), stack=[], strmode=false) ]
while IPs is non-empty:
    for each ip in IPs:                 # visit in birth order
        cell ← G[ip.position]           # defaults to 0x20
        if ip.strmode and cell ≠ 0x22:  # inside a string literal
            ip.push(cell)
        else:
            op ← decode(cell)
            execute(op)                 # may change dir, spawn IPs, set @-halt
        if ip has been @-halted: mark for removal
        else: ip.position ← ip.position + ip.dir
    remove @-halted IPs from the list
```

`@` (HALT, §4) removes **only the IP that executed it**. When the last
IP is removed, the program terminates cleanly. The step counter used
by `--max-steps` (§9) advances by **1 per tick**, not per IP — one
"tick" is one pass over every live IP.

Execution terminates iff the IP list becomes empty or the runtime
exceeds the `--max-steps` budget (§9).

The order in which IPs are visited within a tick is **birth order**
(oldest first). A brand-new IP created this tick does NOT execute on
the same tick it was born — it joins the list and first runs on the
following tick. This keeps each tick deterministic and side-effect
stable regardless of implementation details like iterator invalidation.

---

## 4. Opcode Reference

All 33 opcodes are listed below. The **Glyph** column lists the primary
Unicode character first, with ASCII aliases in parentheses when defined.

| Category     | Glyph         | Name        | Semantics                                                 |
|--------------|---------------|-------------|-----------------------------------------------------------|
| Flow         | (space) · (U+00B7) | NOP    | Do nothing.                                               |
| Flow         | `@`           | HALT        | Remove the executing IP from the live list (§3.5). When the list empties, the program terminates. |
| Flow         | `#`           | TRAMPOLINE  | Advance IP an extra step (skip the next cell).            |
| Flow         | `t`           | SPLIT       | Spawn a new IP at `(x - dx, y - dy)` going `(-dx, -dy)` with an empty stack and strmode off; the executing IP is unchanged. See §3.5. |
| Wind         | `→` (`>`)     | MOVE\_E     | `dir ← (+1,  0)`                                          |
| Wind         | `↗`           | MOVE\_NE    | `dir ← (+1, -1)`                                          |
| Wind         | `↑` (`^`)     | MOVE\_N     | `dir ← ( 0, -1)`                                          |
| Wind         | `↖`           | MOVE\_NW    | `dir ← (-1, -1)`                                          |
| Wind         | `←` (`<`)     | MOVE\_W     | `dir ← (-1,  0)`                                          |
| Wind         | `↙`           | MOVE\_SW    | `dir ← (-1, +1)`                                          |
| Wind         | `↓` (`v`)     | MOVE\_S     | `dir ← ( 0, +1)`                                          |
| Wind         | `↘`           | MOVE\_SE    | `dir ← (+1, +1)`                                          |
| Wind         | `~`           | TURBULENCE  | `dir ← uniform random choice of the 8 wind directions`.   |
| Literal      | `0`…`9`       | PUSH\_DIGIT | Push the digit's integer value (0–9) to the stack.        |
| Literal      | `"`           | STR\_MODE   | Toggle string mode.                                       |
| Arithmetic   | `+`           | ADD         | `b ← pop; a ← pop; push a + b`                            |
| Arithmetic   | `-`           | SUB         | `b ← pop; a ← pop; push a - b`                            |
| Arithmetic   | `*`           | MUL         | `b ← pop; a ← pop; push a * b`                            |
| Arithmetic   | `/`           | DIV         | `b ← pop; a ← pop; push a // b` (floor; `b==0` ⇒ push 0)  |
| Arithmetic   | `%`           | MOD         | `b ← pop; a ← pop; push a %% b` (`b==0` ⇒ push 0)         |
| Arithmetic   | `!`           | NOT         | `a ← pop; push (1 if a == 0 else 0)`                      |
| Arithmetic   | `` ` ``       | GT          | `b ← pop; a ← pop; push (1 if a > b else 0)`              |
| Stack        | `:`           | DUP         | Duplicate the top.                                        |
| Stack        | `$`           | DROP        | Discard the top.                                          |
| Stack        | `\`           | SWAP        | Swap the top two.                                         |
| Branch       | `_`           | IF\_H       | `a ← pop; dir ← east if a == 0 else west`                 |
| Branch       | `\|`          | IF\_V       | `a ← pop; dir ← south if a == 0 else north`               |
| I/O          | `.`           | PUT\_NUM    | `a ← pop; write decimal repr of a, followed by a space`.  |
| I/O          | `,`           | PUT\_CHR    | `a ← pop; write codepoint a as a Unicode character`.      |
| I/O          | `&`           | GET\_NUM    | Read one decimal integer from stdin; push it (EOF ⇒ -1).  |
| I/O          | `?`           | GET\_CHR    | Read one Unicode character from stdin; push its codepoint (EOF ⇒ -1). |
| Grid memory  | `g`           | GRID\_GET   | `y ← pop; x ← pop; push G[(x, y)]` (missing ⇒ 0x20).      |
| Grid memory  | `p`           | GRID\_PUT   | `y ← pop; x ← pop; v ← pop; G[(x, y)] ← v`.               |

**Unknown character.** Any Unicode character not listed above and not a digit
decodes to the NOP opcode, and the implementation SHOULD emit a one-time
warning per unknown glyph to stderr (never to stdout).

### 4.1 Binary operator argument order

For `+ - * / %` and `` ` ``, the convention is *top is right operand*. Given
the program `3 4 -`, execution pushes 3, pushes 4, then pops `b=4`, `a=3`, and
pushes `a - b = -1`.

### 4.2 String mode and `"`

`"` is the only opcode whose behavior depends on the flag it toggles. Every
other opcode is either executed (flag off) or suppressed in favor of a
codepoint push (flag on).

### 4.3 TURBULENCE (`~`) determinism

`~` is non-deterministic by default. Implementations MUST accept a `--seed`
flag (or equivalent configuration) which makes the RNG reproducible. Given
identical seed, identical input, and an identical source, two runs MUST
produce identical output.

---

## 5. File Format

- **Extension**: `.wnd`
- **Encoding**: strict UTF-8. A leading BOM (`U+FEFF`) at byte 0, if present,
  is silently stripped.
- **Line endings**: `\r\n` and `\r` are normalized to `\n` before parsing.
- **Shebang**: if the first byte of the file is `#` followed by `!`, the
  *entire* first line (up to and including the first `\n`) is stripped before
  grid construction. This enables `#!/usr/bin/env windy` scripts.
- **Grid layout**: after shebang stripping, each `\n`-delimited line becomes
  one row. Row index `y` increases with each line (top line is `y = 0`).
  Within a row, column index `x` is the Unicode **codepoint** offset (not
  byte offset) from the start of the line. Trailing newlines do not create
  empty rows.

Source bytes outside the grid (e.g., a BOM, a stripped shebang) do NOT count
toward the `sisobus` watermark scan (§8) — the scan runs over the
post-normalization source text.

---

## 6. Turing Completeness

Windy is Turing-complete. A sketch:

1. **Unbounded memory.** `g` and `p` address the infinite grid with
   arbitrary-precision integer coordinates, giving access to a countably
   infinite number of integer cells. The stack is likewise unbounded.
2. **Conditional branching.** `_` and `|` provide one-bit conditional
   branches on stack-top.
3. **Arithmetic.** `+ - * / %` together with comparison (`` ` ``) and
   negation (`!`) are sufficient for all primitive-recursive arithmetic.
4. **Self-modification.** Because `p` writes into the grid and subsequent
   IP visits re-decode cells, a Windy program can construct arbitrary
   execution paths at runtime. This is strictly stronger than static
   control flow.

---

## 7. Semantics of Edge Cases

| Condition                          | Behavior                                  |
|------------------------------------|-------------------------------------------|
| Pop from empty stack               | Yields `0`.                               |
| Division by zero (`/`, `%`)        | Pushes `0` (no trap).                     |
| Unknown glyph (§4)                 | Treated as NOP; one-shot warning on stderr. |
| EOF on `?` or `&`                  | Pushes `-1`.                              |
| Malformed integer on `&`           | Consume input until the next whitespace, push `-1`. |
| Negative `p`/`g` coordinates       | Perfectly legal; the grid is bi-infinite. |
| `p` writing a non-printable codepoint | Perfectly legal; cell stores the integer. |
| IP direction set by `~` | Uniformly drawn from the 8 wind directions. |
| `t` executed in string mode | No split — `t` is pushed as codepoint 116 like any other character inside a string literal. |
| `t` spawning an IP onto a cell the same IP occupies | Perfectly legal; both IPs may visit each other's paths on subsequent ticks. |
| Interleaved stdout from multiple IPs | Bytes are written in the order IPs execute `,` / `.` within each tick (birth order, §3.5). No implicit buffering. |

---

## 8. The sisobus Watermark

### 8.1 Rule

If the post-normalization source text contains the **ASCII substring**
`sisobus` (case-sensitive), the interpreter SHALL print the following banner
to **stderr** once, before any user-program output, and before the VM begins
execution:

```
╔═══════════════════════════════════════╗
║  Windy v0.1                           ║
║  Crafted by Kim Sangkeun (@sisobus)   ║
╚═══════════════════════════════════════╝
```

If the substring is absent, no banner is printed.

### 8.2 Intent

The substring need not lie on any path the IP will ever traverse.
Programmers are encouraged to embed `sisobus` in unreachable regions of the
grid as a *signature watermark* — the Windy equivalent of a copyright line.

This feature is non-optional in conforming implementations: a Windy runtime
that suppresses or alters the banner is not conformant.

---

## 9. Runtime Configuration

Conforming implementations MUST expose at least the following controls to
the user (precise flag names are implementation-defined, but the reference
Python implementation uses the names below):

| Control         | Effect                                                             |
|-----------------|--------------------------------------------------------------------|
| `--seed N`      | Seed the TURBULENCE RNG for reproducible runs. Default: OS entropy. |
| `--max-steps N` | Abort after N IP steps with exit code 124. Default: unbounded.      |

---

## 10. Reserved for Future Versions

The following features are *not* part of v0.1. They are listed so that v0.1
programs remain forward-compatible when they ship:

- **Rust reference VM (v0.2).** The interpreter lives in a single Rust
  crate at the repo root. That same crate powers the native CLI today
  and (in v0.3) the browser playground via the `wasm32` target. The
  v0.1 Python implementation has been retired; its goldens live on in
  `conformance/cases.json`, a language-neutral file that every future
  implementation MUST pass byte-for-byte on stdout + exit code.
- **Serverless browser playground (v0.3).** The Rust VM is compiled to
  `wasm32-unknown-unknown` (or `wasm32-wasip1`) and loaded by a static
  HTML page under `web/`. No backend server is required; the browser
  interprets `.wnd` source directly via the shipped `.wasm`. This
  replaces the "WAT AOT compiler" plan that v0.1's `wasm.py` stopgap
  gestured at — per-program AOT is not needed once the interpreter
  itself ships as WebAssembly.
- **WASI distribution channel (v0.5).** The Rust crate also targets
  `wasm32-wasip1`, producing a portable `windy.wasm` runnable under any
  WASI host (`wasmtime`, `wasmer`, etc.) with `--dir=.` for filesystem
  access. The same artifact is published next to the browser bundle
  on the static-host origin.
- **Fingerprints / language extensions** — v0.5+.
- **Tracing JIT for hot loops** — v0.5+.
- **Standard-library overlays** (pre-written grid regions loaded by name) —
  v0.6+.
- **Windy v1.0 — semantic distinction.** Through the v0.x line, Windy
  is, in execution-model terms, Befunge-98 with Unicode arrow glyphs
  and a mandatory `sisobus` watermark; aside from the watermark and
  some tightenings (mandatory BigInt, mandatory bi-infinite sparse
  grid), the semantics are a strict subset of Funge-98. To stop being
  "a Befunge dialect" by the time the major version turns over, v1.0
  will adopt **at least one** semantic feature without precedent in
  the Befunge family. Candidate directions, captured here so the
  selection is a deliberate decision rather than the loudest issue
  the day the cut is made:
    - **Wind tension / inertia** — direction changes obey a graph
      over the eight winds (e.g. only adjacent rotations, or per-cell
      preferred winds), so flow turns into a navigation problem
      instead of a free-for-all.
    - **Time-aware grid** — cells are keyed `(x, y, t)`. `p` may
      write a future tick, `g` may read past ticks, enabling causal
      puzzles foreign to a static 2D plane.
    - **2D stack** — values live on a visible auxiliary plane that
      grows by IP-relative direction rather than a 1D LIFO. push/pop
      become geometrically meaningful.
    - **IP collision semantics** — when two live IPs share a cell on
      the same tick, they merge / fork / annihilate per a defined
      rule, instead of independently passing through.
    - **Cells as multi-token regions** — a cell may hold a finite
      ordered tuple of codepoints; string mode operates inside the
      tuple, decoupling source layout from token granularity.
    - **Wind speed** — each IP carries a strictly positive
      `speed` (default `1`) and advances `speed` cells per tick.
      Two new opcodes — `≫` (GUST) and `≪` (CALM) — bump or trim
      it. Added as a sixth candidate during the v0.5 design review.

  Selecting one (or composing several) is the v1.0 design exercise.
  Until then, README and the public site describe Windy as "a
  Befunge-98 dialect with a Unicode-first surface and a mandatory
  author-signature watermark" — which is honest and does the
  language no harm.

  **Decision (post v0.5 review).** The v1.0 cut composes
  **wind speed** and **IP collision (merge)** semantics. Both are
  additive and orthogonal; programs that don't use the new opcodes
  and never produce a collision execute identically under v0.4 and
  v1.0. Normative semantics live in the *Pre-release: v1.0
  (proposal)* section below. See also `docs/v1.0-design.md` for the
  rationale and the candidates that were rejected.

Implementations MAY define experimental opcodes outside the 33 listed here,
but MUST gate them behind an explicit opt-in flag to preserve portability.

---

## Pre-release: v1.0 (proposal)

> Status: **proposal**, not part of v0.4 conformance. Implementations
> MAY support the semantics in this section behind an explicit opt-in
> flag (recommended: `--v1`). When the flag is off, behavior is
> exactly as specified in §1–§9. v1.0 goldens live in a parallel
> `conformance/v1.json` and load only when the flag is set.

The v0.x line is, in execution-model terms, Befunge-98 with stricter
promises and a Unicode-first surface (§10). v1.0 introduces **two
additive semantic features** so that "Windy is just Befunge with a
haircut" stops being a fair sentence:

1. **Wind Speed** — IPs may move multiple cells per tick.
2. **IP Collision (Merge)** — IPs that meet on the same cell
   coalesce into one.

Both are additive: programs that never execute the new opcodes and
never produce a collision behave identically under v0.4 and v1.0.

### Wind Speed

Each IP gains a new field, **speed**: a strictly positive arbitrary-
precision integer, initially `1`. The §3.6 main-loop movement step

> `ip.position ← ip.position + ip.dir`

becomes

> `ip.position ← ip.position + ip.dir × ip.speed`

That is: an IP at speed `N` advances `N` cells in its current
direction per tick, and **only the destination cell executes** —
intermediate cells are not decoded, do not toggle string mode, and
do not produce unknown-glyph warnings. High wind blows past
obstacles.

Two new opcodes adjust speed:

| Glyph | Codepoint | Name | Semantics |
|-------|-----------|------|-----------|
| `≫`   | U+226B    | GUST | `ip.speed ← ip.speed + 1`. |
| `≪`   | U+226A    | CALM | `ip.speed ← ip.speed − 1`. If the result would be `0`, the executing IP **traps** with a runtime error ("calm in still air") that aborts the program with a non-zero exit code. |

Both opcodes also advance the IP per the standard movement rule
above. Executing `≫` at speed 3 advances the IP 3 cells *and* leaves
it at speed 4 for the next tick.

Speed has **no upper bound**: it is BigInt, consistent with the
language's promise of unbounded arithmetic (§2 #4). At speed `N`
larger than the populated grid extent, the IP simply lands on a cell
that defaults to space (NOP).

`t` (SPLIT, §4) is extended: the new IP **inherits the parent's
speed at split time**. The parent's speed is unchanged. The empty-
stack and string-mode-off rules from §3.5 are unchanged.

`~` (TURBULENCE, §4) is unchanged — it picks one of the eight wind
directions uniformly at random; speed is preserved.

### IP Collision (Merge)

After every tick's movement step (§3.6), the runtime performs a
**collision pass**:

1. Group all live IPs by `(x, y)` position.
2. For each group containing two or more IPs:
   1. Sort the group by **birth order** (oldest first; identical to
      the IP list ordering of §3.5).
   2. **Merge** the group into a single IP at the same position
      with:
      - **stack**: concatenation of the constituent stacks in
        birth order, with the oldest IP's stack at the bottom.
      - **direction**: the per-axis sum of constituent directions,
        clipped to `{-1, 0, +1}`. If the result is `(0, 0)` —
        a head-on storm cancelling itself — the merged IP **dies**
        and is removed from the live list.
      - **speed**: maximum over the constituents (strong wind
        absorbs weak).
      - **strmode**: forced to `false`. Merging is a fresh start.
   3. Replace the group with the single merged IP, retaining the
      oldest IP's slot in the live list.

The collision pass runs **once per tick**, after movement and before
the next tick begins. A merged IP that lands on a third IP on a
following tick merges again per the same rule.

**Detection scope.** Only end-of-tick coincidence is a collision.
Two IPs that swap positions in a single tick (e.g., two speed-1 IPs
moving toward each other from adjacent cells) pass through each
other in v1.0; mid-segment crossing detection is reserved for a
future version.

**Determinism.** Merge order is fully determined by the §3.5 birth-
order rule, so collision outcomes are reproducible across conforming
implementations.

### Edge Cases (additive to §7)

| Condition | Behavior |
|-----------|----------|
| `≪` at `speed == 1` (would yield 0) | Runtime error; program aborts with a non-zero exit code. |
| `≫` repeatedly without bound | Legal; speed is BigInt. |
| Speed exceeds populated grid extent | Legal; the destination cell defaults to space (NOP). |
| `t` SPLIT at speed `N` | Parent advances `N` cells per the §3.6 rule; the child is born at the parent's *original* `(x − dx, y − dy)`, going `(−dx, −dy)`, with **speed `N`** (parent's speed at split time). |
| Three or more IPs collide on the same cell in the same tick | Single merge per the rule above; equivalent to a left-fold of pairwise merges in birth order. |
| String-mode toggle on a high-speed IP | Only the **destination** cell is read. If the destination is `"`, strmode toggles as normal; intermediate `"` cells are not seen. |
| `~` (TURBULENCE) on a high-speed IP | Speed is preserved; only direction changes. |
| Merge produces `(0, 0)` direction | The merged IP dies. The constituents' stacks are discarded with it. |

### Conformance

A v1.0 implementation MUST expose an opt-in flag (recommended:
`--v1`). With the flag **off**, the implementation MUST be
bit-identical to v0.4 — including a NOP-with-warning decode for `≫`
and `≪`, since they are not v0.4 opcodes. With the flag **on**, the
implementation MUST pass `conformance/v1.json` byte-for-byte on
stdout + exit code, in addition to the existing
`conformance/cases.json`.

The `--v1` flag and the corresponding browser-runtime toggle MAY be
renamed in the v1.0 final cut, but the semantics defined in this
section are stable proposals subject only to bug-fix changes.

---

## 11. Versioning & Conformance

- This document describes **Windy v0.4**. The language grammar is
  backwards compatible with v0.1 modulo one change: `t` used to decode
  as Unknown (NOP + warning) and now is the SPLIT opcode. Programs
  that relied on `t` being a warning will no longer see the warning.
- A future breaking change bumps the major version (e.g., v1.0).
- Additions that preserve existing program behavior bump the minor version
  (e.g., v0.2).
- The interpreter `windy version` subcommand MUST report the language
  version it implements.

---

*End of specification.*
