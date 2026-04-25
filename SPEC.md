# Windy Language Specification — v1.0

This document is the single source of truth for the Windy programming language.
Implementations (the reference Rust interpreter, the WASM backend, any future
ports) MUST conform to the semantics defined here. Deviations are bugs.

---

## 1. Overview

Windy is a two-dimensional esoteric programming language. A program is a grid of
Unicode characters. An **instruction pointer** (IP) drifts across the grid in
one of eight directions — the "winds" — and executes each cell it visits. The
language is:

- **Turing-complete** — unbounded grid, arbitrary-precision integers,
  self-modifying code.
- **Stack-based** — a single unbounded LIFO stack of integers per IP.
- **Visually directional** — control flow is written as arrows
  (`→ ↗ ↑ ↖ ← ↙ ↓ ↘`).
- **Concurrent** — programs may spawn additional IPs that execute in lockstep
  and may merge on collision (§3.5, §3.8).
- **Variable-speed** — each IP carries an unbounded positive `speed`; high
  wind blows past obstacles (§3.7).
- **WebAssembly-compilable** — programs run unmodified through the reference
  WASI binary and the browser playground.

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
3. **Small core, emergent complexity.** The language has exactly 35 opcodes.
   There are no functions, types, modules, or standard library. All structure
   is emergent from grid layout, IP geometry, and inter-IP collisions.
4. **No bounded datatypes.** The grid, the stack, integer values, and IP wind
   speed are all conceptually unbounded. Implementations MUST use
   arbitrary-precision integers and sparse grid storage.

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

Each IP carries:

- **Position** `(x, y)`.
- **Direction** `(dx, dy)`, where `dx, dy ∈ {-1, 0, +1}` and at least one of
  `dx, dy` is non-zero.
- **Speed** — a strictly positive arbitrary-precision integer, initially `1`
  (§3.7).
- A **stack** (§3.3) and a **string-mode** flag (§3.4).

The **initial IP** has position `(0, 0)`, direction east `(1, 0)`, speed `1`,
empty stack, and string mode off. Subsequent IPs are spawned by `t` (SPLIT,
§3.5).

### 3.3 Stack

- An unbounded LIFO stack of arbitrary-precision signed integers, owned by
  each IP.
- Initially empty.
- **Underflow is non-fatal.** Popping from an empty stack yields `0`.

### 3.4 String Mode

- A single boolean flag per IP, initially `false`.
- When `true`, each cell the IP visits has its integer codepoint pushed to
  the stack. The only exception is `"` itself, which toggles the flag back
  to `false`.
- When `false`, cells are decoded and executed as opcodes normally.

### 3.5 Concurrent IPs

A Windy program is driven by an **ordered list of IPs**. Each IP owns
its own `(position, direction, stack, strmode, speed)` tuple; the grid is
shared. Initially the list contains a single IP — position `(0, 0)`,
direction east, speed `1`, empty stack, string mode off.

New IPs are spawned by `t` (SPLIT, §4). When `t` executes on an IP at
position `(x, y)` with direction `(dx, dy)` and speed `N`, a **new IP** is
appended to the end of the list at position `(x − dx, y − dy)` with direction
`(−dx, −dy)`, an empty stack, string mode off, and **speed `N`** (the
parent's speed at split time). The executing IP is otherwise unchanged — it
advances normally. The `(x − dx, y − dy)` offset (one cell "behind" the
executing IP along its original heading) guarantees that the new IP does NOT
re-execute the `t` cell on its next tick, which would otherwise cause an
infinite split cascade.

### 3.6 Main Loop

```
IPs ← [ IP(position=(0,0), dir=(1,0), stack=[], strmode=false, speed=1) ]
while IPs is non-empty:
    for each ip in IPs:                       # visit in birth order
        cell ← G[ip.position]                 # defaults to 0x20
        if ip.strmode and cell ≠ 0x22:        # inside a string literal
            ip.push(cell)
        else:
            op ← decode(cell)
            execute(op)                       # may change dir/speed,
                                              # spawn IPs, set @-halt
        if ip has been @-halted: mark for removal
        else: ip.position ← ip.position + ip.dir × ip.speed   # §3.7
    promote any IPs spawned during this tick to the live list
    run the collision pass (§3.8)
    remove halted IPs from the list
```

`@` (HALT, §4) removes **only the IP that executed it**. When the last
IP is removed, the program terminates cleanly. The step counter used
by `--max-steps` (§9) advances by **1 per tick**, not per IP — one
"tick" is one pass over every live IP.

Execution terminates iff the IP list becomes empty, the runtime
exceeds the `--max-steps` budget (§9), or a runtime trap fires (§3.7).

The order in which IPs are visited within a tick is **birth order**
(oldest first). A brand-new IP created this tick does NOT execute on
the same tick it was born — it joins the list and first runs on the
following tick. This keeps each tick deterministic and side-effect
stable regardless of implementation details like iterator invalidation.

### 3.7 Wind Speed

Each IP carries a **speed** field — a strictly positive arbitrary-
precision integer, initially `1`. The §3.6 main-loop movement step

> `ip.position ← ip.position + ip.dir × ip.speed`

means an IP at speed `N` advances `N` cells in its current direction
per tick. **Only the destination cell executes** on the next tick —
intermediate cells are not decoded, do not toggle string mode, and do
not produce unknown-glyph warnings. High wind blows past obstacles.

Two opcodes adjust speed:

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

`~` (TURBULENCE, §4) is unchanged — it picks one of the eight wind
directions uniformly at random; speed is preserved.

A **runtime trap** (currently only `≪` at speed 1) aborts the program
with exit code `134` — distinguishable from a clean halt (`0`) and
from a `--max-steps` abort (`124`). The trap message is written to
stderr.

### 3.8 IP Collision (Merge)

After every tick's movement step (§3.6), the runtime performs a
**collision pass**:

1. Group all live IPs by `(x, y)` position.
2. For each group containing two or more IPs:
   1. Sort the group by **birth order** (oldest first; identical to
      the IP list ordering of §3.5).
   2. **Merge** the group into a single IP at the same position with:
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
other; mid-segment crossing detection is reserved for a future
version (§10).

**Determinism.** Merge order is fully determined by the §3.5 birth-
order rule, so collision outcomes are reproducible across conforming
implementations.

---

## 4. Opcode Reference

All 35 opcodes are listed below. The **Glyph** column lists the primary
Unicode character first, with ASCII aliases in parentheses when defined.

| Category     | Glyph         | Name        | Semantics                                                 |
|--------------|---------------|-------------|-----------------------------------------------------------|
| Flow         | (space) · (U+00B7) | NOP    | Do nothing.                                               |
| Flow         | `@`           | HALT        | Remove the executing IP from the live list (§3.5). When the list empties, the program terminates. |
| Flow         | `#`           | TRAMPOLINE  | Advance IP an extra step (skip the next cell).            |
| Flow         | `t`           | SPLIT       | Spawn a new IP at `(x − dx, y − dy)` going `(−dx, −dy)` with an empty stack, strmode off, and the parent's speed. The executing IP is unchanged. See §3.5. |
| Wind         | `→` (`>`)     | MOVE\_E     | `dir ← (+1,  0)`                                          |
| Wind         | `↗`           | MOVE\_NE    | `dir ← (+1, -1)`                                          |
| Wind         | `↑` (`^`)     | MOVE\_N     | `dir ← ( 0, -1)`                                          |
| Wind         | `↖`           | MOVE\_NW    | `dir ← (-1, -1)`                                          |
| Wind         | `←` (`<`)     | MOVE\_W     | `dir ← (-1,  0)`                                          |
| Wind         | `↙`           | MOVE\_SW    | `dir ← (-1, +1)`                                          |
| Wind         | `↓` (`v`)     | MOVE\_S     | `dir ← ( 0, +1)`                                          |
| Wind         | `↘`           | MOVE\_SE    | `dir ← (+1, +1)`                                          |
| Wind         | `~`           | TURBULENCE  | `dir ← uniform random choice of the 8 wind directions`. Speed is preserved. |
| Speed        | `≫`           | GUST        | `speed ← speed + 1`. See §3.7.                            |
| Speed        | `≪`           | CALM        | `speed ← speed − 1`; runtime trap if it would yield `0`. See §3.7. |
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
codepoint push (flag on). At speed `N > 1`, intermediate cells — including
`"` cells along the way — are not seen, so an IP cannot toggle string mode
mid-flight (§3.7).

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
| IP direction set by `~`            | Uniformly drawn from the 8 wind directions. Speed unchanged. |
| `t` executed in string mode        | No split — `t` is pushed as codepoint 116 like any other character inside a string literal. |
| `t` spawning an IP onto a cell the same IP occupies | Perfectly legal; both IPs may visit each other's paths on subsequent ticks. |
| `≪` (CALM) at `speed == 1`         | Runtime trap; program aborts with exit code `134`. |
| `≫` (GUST) repeatedly without bound | Legal; speed is BigInt. |
| Speed exceeds populated grid extent | Legal; the destination cell defaults to space (NOP). |
| `t` SPLIT at speed `N`             | Parent advances `N` cells per the §3.6 rule; the child is born at the parent's *original* `(x − dx, y − dy)`, going `(−dx, −dy)`, with **speed `N`** (parent's speed at split time). |
| Three or more IPs collide on the same cell in the same tick | Single merge per the §3.8 rule; equivalent to a left-fold of pairwise merges in birth order. |
| String-mode toggle on a high-speed IP | Only the **destination** cell is read. If the destination is `"`, strmode toggles as normal; intermediate `"` cells are not seen. |
| Merge produces `(0, 0)` direction  | The merged IP dies. The constituents' stacks are discarded with it. |
| Two IPs swap positions mid-tick (no end-of-tick coincidence) | They pass through each other; mid-segment crossing detection is reserved for a future version (§10). |
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
║  Windy v1.0                           ║
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
Rust implementation uses the names below):

| Control         | Effect                                                             |
|-----------------|--------------------------------------------------------------------|
| `--seed N`      | Seed the TURBULENCE RNG for reproducible runs. Default: OS entropy. |
| `--max-steps N` | Abort after N IP steps with exit code 124. Default: unbounded.      |
| `--v0`          | Run in v0.4 legacy mode: disable §3.7 wind speed and §3.8 collision merge; `≫` and `≪` decode as Unknown (NOP + warning). Default: off (full v1.0 semantics). |

### 9.1 Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Clean halt — the live IP list emptied. |
| `124` | `--max-steps` budget exhausted. |
| `134` | Runtime trap (e.g. `≪` at speed 1, §3.7). |

---

## 10. Reserved for Future Versions

The following features are *not* part of v1.0. They are listed so that v1.0
programs remain forward-compatible when they ship:

- **Mid-segment IP crossing detection** — v1.x. Two speed-≥1 IPs that swap
  positions in a single tick currently pass through each other; a future
  version may detect that crossing and treat it as a collision.
- **Fingerprints / language extensions.** A discoverable mechanism for
  optional opcode bundles, gated behind an explicit opt-in flag. Reserved
  for v1.x+.
- **Tracing JIT for hot loops** — v1.x+. An implementation concern, not a
  language change; will not affect program semantics.
- **Standard-library overlays** (pre-written grid regions loaded by name) —
  v1.x+.

Implementations MAY define experimental opcodes outside the 35 listed here,
but MUST gate them behind an explicit opt-in flag to preserve portability.

---

## 11. Versioning & Conformance

- This document describes **Windy v1.0**.
- The v1.0 cut is a **major-version** change from v0.4. New language
  surface: §3.7 wind speed (the `≫` / `≪` opcodes plus the speed-aware
  movement rule), §3.8 IP collision merge, and the `134` trap exit code.
  These features are **additive**: programs that never execute `≫` / `≪`
  and never produce a collision behave identically under v0.4 and v1.0.
  The reference implementation backs this guarantee with a per-case
  conformance harness that runs every v0.4 case under v1.0 semantics
  (`tests/conformance_v1.rs::v0_cases_pass_under_v1_mode`).
- Implementations MUST expose the legacy gate as `--v0` (or an equivalent
  named flag). With the gate **on**, the implementation MUST be
  bit-identical to v0.4 — including a NOP-with-warning decode for `≫`
  and `≪`. With the gate **off** (the default), the implementation MUST
  pass both `conformance/cases.json` and `conformance/v1.json`
  byte-for-byte on stdout + exit code.
- Subsequent additive changes that preserve existing program behavior bump
  the minor version (e.g., v1.1).
- A future breaking change bumps the major version (e.g., v2.0).
- The interpreter `windy version` subcommand MUST report the language
  version it implements.

---

*End of specification.*
