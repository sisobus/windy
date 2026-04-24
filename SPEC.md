# Windy Language Specification — v0.1

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
3. **Small core, emergent complexity.** The language has exactly 34 opcodes.
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

### 3.5 Main Loop

```
IP ← (0, 0); dir ← (1, 0); stack ← []; strmode ← false; halted ← false
while not halted:
    cell ← G[IP]                         # defaults to 0x20 if missing
    if strmode and cell ≠ 0x22 ('"'):    # inside a string literal
        push cell
    else:
        op ← decode(cell)
        execute(op)                      # may set halted or change dir
    IP ← IP + dir
```

Execution terminates iff `@` (HALT) executes or the runtime exceeds the
`--max-steps` budget (§9).

---

## 4. Opcode Reference

All 34 opcodes are listed below. The **Glyph** column lists the primary
Unicode character first, with ASCII aliases in parentheses when defined.

| Category     | Glyph         | Name        | Semantics                                                 |
|--------------|---------------|-------------|-----------------------------------------------------------|
| Flow         | (space) · (U+00B7) | NOP    | Do nothing.                                               |
| Flow         | `@`           | HALT        | Stop execution.                                           |
| Flow         | `#`           | TRAMPOLINE  | Advance IP an extra step (skip the next cell).            |
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

A constructive demonstration — a Brainfuck interpreter written in Windy —
is planned as `examples/bf.wnd`. v0.1 ships a placeholder at that path
that only halts + fires the watermark banner; the real interpreter is
tracked under §10 for v0.2. Until it lands, the argument above is the
witness of record: it does not depend on the example existing.

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

- **Rust-based reference VM (v0.2).** The interpreter is reimplemented in
  Rust to collapse the language/host split. A single `windy-core` crate
  powers both the native CLI (via `cargo install`) and the browser
  playground (via `wasm32` target). The Python implementation ships on
  as a *conformance reference* — both implementations MUST produce
  byte-identical stdout for the same source, seed, and stdin, and this
  is enforced by shared golden tests.
- **Brainfuck interpreter example** (`examples/bf.wnd`, §6) — placeholder
  in v0.1, full interpreter lands alongside the Rust VM in v0.2.
- **Serverless browser playground (v0.3).** The Rust VM is compiled to
  `wasm32-unknown-unknown` (or `wasm32-wasip1`) and loaded by a static
  HTML page under `web/`. No backend server is required; the browser
  interprets `.wnd` source directly via the shipped `.wasm`. This
  replaces the "WAT AOT compiler" plan that v0.1's `wasm.py` stopgap
  gestured at — per-program AOT is not needed once the interpreter
  itself ships as WebAssembly.
- **Threads / concurrent IPs** (Befunge-98 `t`) — v0.4+.
- **Fingerprints / language extensions** — v0.4+.
- **Tracing JIT for hot loops** — v0.4+.
- **Standard-library overlays** (pre-written grid regions loaded by name) —
  v0.5+.

Implementations MAY define experimental opcodes outside the 34 listed here,
but MUST gate them behind an explicit opt-in flag to preserve portability.

---

## 11. Versioning & Conformance

- This document describes **Windy v0.1**.
- A future breaking change bumps the major version (e.g., v1.0).
- Additions that preserve existing program behavior bump the minor version
  (e.g., v0.2).
- The interpreter `windy version` subcommand MUST report the language
  version it implements.

---

*End of specification.*
