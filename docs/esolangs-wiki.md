<!--
  Draft of the esolangs.org wiki entry for Windy.

  esolangs.org runs MediaWiki, so the body below uses MediaWiki
  syntax — '''bold''', [[InternalLink]], [https://url label],
  <syntaxhighlight>...</syntaxhighlight>, {{infobox proglang|...}},
  category tags at the bottom.

  ==============================================================
  HOW TO UPLOAD (you've already signed up)
  ==============================================================

  1. Go to https://esolangs.org/wiki/Windy
     (if the page doesn't exist yet, MediaWiki will offer a
      "Create the page Windy on this wiki!" link.)

  2. Click "Create" / "create this page" / "edit source".

  3. Copy the body BETWEEN the `=== begin wiki ===` and
     `=== end wiki ===` markers below — NOT the HTML comments.

  4. Paste into the wiki edit box.

  5. (Optional) Fill in the "Summary" field with something like
     "Initial entry for Windy v2.0".

  6. Hit "Show preview" to verify the infobox/tables render.

  7. Hit "Publish page".

  8. The page now lives at https://esolangs.org/wiki/Windy and
     is auto-listed under each [[Category:...]] tag at the
     bottom (2026, Two-dimensional languages, Stack-based,
     Turing complete, ...).

  After publishing, you may also want to:
   - Add "Windy" to https://esolangs.org/wiki/Language_list
     under "W" (manual alphabetical insertion).
   - Cross-link from https://esolangs.org/wiki/Category:2026
     (this happens automatically via the Category tag).

=== begin wiki ===
-->

{{infobox proglang
|name=Windy
|paradigms=[[:Category:Imperative paradigm|imperative]], [[:Category:Two-dimensional languages|two-dimensional]], [[:Category:Stack-based|stack-based]], concurrent
|author=Kim Sangkeun (sisobus)
|year=[[:Category:2026|2026]]
|memsys=infinite bi-directional sparse 2D grid + per-IP unbounded stack
|class=[[:Category:Turing complete|Turing complete]]
|refimpl=[https://github.com/sisobus/windy windy-lang]
|files=<code>.wnd</code>
}}

'''Windy''' is a two-dimensional [[:Category:Esoteric|esoteric programming language]] designed by Kim Sangkeun (sisobus) in 2026. A program is a grid of Unicode characters; one or more '''instruction pointers (IPs)''' drift across the grid in one of '''eight winds''' — <code>→ ↗ ↑ ↖ ← ↙ ↓ ↘</code> — and execute the cell each one lands on at every tick. The language has '''35 opcodes''' total, no functions, no types, no modules, and no standard library; all program structure is emergent from grid layout, IP geometry, and inter-IP collisions.

The name is the Korean reading of the [[wikipedia:Arcanine|Pokémon Arcanine]] (윈디); the wind-direction mechanic is a thematic pun on the name.

== Design highlights ==

=== Eight winds, diagonals as primaries ===

Diagonals (<code>↗ ↖ ↙ ↘</code>) are first-class glyphs, not synthesized from cardinal pairs. The intent is that programs read as flow diagrams — if you can draw the path the IP should take, you can encode it directly.

The four cardinals also accept ASCII aliases (<code>></code> <code>^</code> <code><</code> <code>v</code>) for typing convenience, but the printed form uses the Unicode arrows.

=== Wind speed ===

Each IP carries a strictly positive integer <code>speed</code> (default 1). The IP advances <code>speed</code> cells per tick, but '''only the destination cell decodes''' — intermediate cells are skipped entirely (no string-mode toggles, no unknown-glyph warnings, no opcode dispatch).

* <code>≫</code> (GUST) raises speed by 1.
* <code>≪</code> (CALM) lowers speed by 1; if this would yield 0, the runtime traps with exit code 134.

Speed, like the stack, is BigInt — there is no upper bound. High wind blows past obstacles.

=== Multi-IP concurrency with collision merge ===

The <code>t</code> (SPLIT) opcode spawns a new IP at <code>(x − dx, y − dy)</code> going <code>(−dx, −dy)</code> with empty stack, string mode off, and the parent's speed. Multiple IPs run concurrently — every tick, all live IPs execute their current cell in birth order, then move.

When two or more IPs share the same cell at end of tick, the runtime applies a deterministic '''collision merge''':

* Stacks concatenate in birth order (oldest below).
* Direction vectors sum and are then clipped per axis to <code>{-1, 0, +1}</code>.
* If the clipped sum is <code>(0, 0)</code>, all participants die — head-on cancellation.
* Otherwise a single survivor IP continues with the merged stack.
* Speed becomes the maximum of participants.
* String mode is reset to false on the survivor.

The merge rules are race-free and tick-deterministic. Programs that halt purely via collision merge — with no <code>@</code> anywhere in the source — are routine.

=== Arbitrary precision throughout ===

Stack values, wind speeds, and grid coordinates are all unbounded integers. <code>2**1000</code>-sized values, six-digit speeds, or grid coordinates at <code>(10^18, -10^18)</code> all work without special syntax or overflow.

=== Bi-infinite sparse grid ===

The grid extends infinitely in both directions from the origin <code>(0, 0)</code>. Negative <code>g</code>/<code>p</code> coordinates are legal; unwritten cells default to <code>0x20</code> (the codepoint of <code>' '</code>) on read and occupy zero memory until <code>p</code> writes to them.

=== Tick-determinism ===

Each tick is a single round-robin pass over live IPs in birth order. New IPs born during a tick wait until the next tick to execute. <code>@</code> halts only the executing IP; collision merges happen in birth order at end-of-tick.

The same source, same <code>--seed</code> (for the <code>~</code> turbulence opcode), and same stdin produce the same stdout, byte for byte, across the native CLI, WASI binary, and browser WASM. The reference implementation pins this with two language-neutral JSON conformance harnesses.

== Computational class ==

Windy is '''Turing complete'''. The four classical building blocks are all present:

* Unbounded memory — BigInt stack plus the sparse grid via <code>g</code>/<code>p</code> with BigInt coordinates is sufficient for an unbounded tape.
* Conditional branching — <code>_</code> (horizontal if) and <code>|</code> (vertical if) pop a value and branch on zero/non-zero.
* Looping — winds redirect IP travel back across already-visited cells; <code>fib.wnd</code> and <code>factorial.wnd</code> in the reference distribution use 2D loops.
* Self-modification — <code>p</code> writes any value to any grid cell at run time, so a program can rewrite its own code.

== Opcodes ==

The full instruction set, in eight functional groups:

{| class="wikitable"
|-
! Group !! Glyph !! Effect
|-
| Flow || (space) <code>·</code> || NOP
|-
| Flow || <code>@</code> || HALT — remove the executing IP from the live list. When the list empties, the program ends.
|-
| Flow || <code>#</code> || TRAMPOLINE — advance one extra step in the current direction (skip the next cell).
|-
| Flow || <code>t</code> || SPLIT — spawn a new IP at <code>(x − dx, y − dy)</code> going <code>(−dx, −dy)</code> with empty stack, string mode off, parent's speed.
|-
| Wind || <code>→</code> (<code>></code>) || <code>dir ← (+1, 0)</code>
|-
| Wind || <code>↗</code> || <code>dir ← (+1, −1)</code>
|-
| Wind || <code>↑</code> (<code>^</code>) || <code>dir ← (0, −1)</code>
|-
| Wind || <code>↖</code> || <code>dir ← (−1, −1)</code>
|-
| Wind || <code>←</code> (<code><</code>) || <code>dir ← (−1, 0)</code>
|-
| Wind || <code>↙</code> || <code>dir ← (−1, +1)</code>
|-
| Wind || <code>↓</code> (<code>v</code>) || <code>dir ← (0, +1)</code>
|-
| Wind || <code>↘</code> || <code>dir ← (+1, +1)</code>
|-
| Wind || <code>~</code> || TURBULENCE — uniform random pick of the eight winds; deterministic with <code>--seed</code>.
|-
| Speed || <code>≫</code> || GUST — <code>speed += 1</code>
|-
| Speed || <code>≪</code> || CALM — <code>speed −= 1</code>; runtime trap (exit 134) if it would yield 0.
|-
| Literal || <code>0</code>–<code>9</code> || push the digit's integer value.
|-
| Literal || <code>"</code> || toggle string mode — between two <code>"</code>, every cell pushes its codepoint instead of executing.
|-
| Arithmetic || <code>+</code> <code>-</code> <code>*</code> <code>/</code> <code>%</code> || pop two, push result. Floor division and modulo. Divide by zero pushes 0 (no trap).
|-
| Arithmetic || <code>!</code> || logical NOT — push 1 if top is 0, else 0.
|-
| Arithmetic || <code>`</code> || GT — pop b, pop a, push 1 if <code>a > b</code> else 0.
|-
| Stack || <code>:</code> || DUP — duplicate top.
|-
| Stack || <code>$</code> || DROP — pop and discard top.
|-
| Stack || <code>\</code> || SWAP — swap top two.
|-
| Branch || <code>_</code> || pop x; <code>dir ← east</code> if <code>x == 0</code>, else <code>west</code>.
|-
| Branch || <code>&#124;</code> || pop x; <code>dir ← south</code> if <code>x == 0</code>, else <code>north</code>.
|-
| I/O || <code>.</code> || PUT_NUM — print top as decimal, followed by a single space.
|-
| I/O || <code>,</code> || PUT_CHR — print top as a Unicode character.
|-
| I/O || <code>&</code> || GET_NUM — read one decimal integer from stdin; on EOF push <code>−1</code>.
|-
| I/O || <code>?</code> || GET_CHR — read one Unicode character; on EOF push <code>−1</code>.
|-
| Grid || <code>g</code> || pop y, pop x, push <code>G[(x, y)]</code> (default <code>0x20</code> if unwritten).
|-
| Grid || <code>p</code> || pop y, pop x, pop v, write <code>G[(x, y)] ← v</code>.
|}

Cells outside this table decode as NOP plus a one-shot warning per glyph on stderr.

Stack underflow on <code>+ - * / %</code> <code>:</code> <code>$</code> <code>\</code> <code>_</code> <code>|</code> <code>.</code> <code>,</code> treats the missing operand(s) as <code>0</code> — there is no trap.

== Examples ==

=== Hello, World! ===

<syntaxhighlight lang="text">
"!dlroW ,olleH",,,,,,,,,,,,,@
</syntaxhighlight>

The string-mode segment <code>"!dlroW ,olleH"</code> pushes the message in reverse byte order so that <code>'H'</code> is on top. Each subsequent <code>,</code> pops one codepoint and writes it. <code>@</code> halts. 28 cells.

=== Add two integers from stdin ===

<syntaxhighlight lang="text">
&&+.@
</syntaxhighlight>

Five cells. Two <code>&</code> reads, <code>+</code> sums, <code>.</code> prints, <code>@</code> halts. <code>echo "3 4" | windy run</code> → <code>7</code>.

=== Wind speed in action ===

<syntaxhighlight lang="text">
"YDNIW"≫$,$,$,$,$,@@
</syntaxhighlight>

Prints <code>WINDY</code>. The strmode segment loads five codepoints. <code>≫</code> raises speed to 2, so the IP lands on every other subsequent cell — exactly the <code>,</code> cells, flying over each <code>$</code> in between. Without the speed change, the alternating <code>$/,</code> would discard a letter for every one printed. Wind speed is what gets the message to stdout. The trailing <code>@@</code> is a parity pad — at speed 2 the IP needs the halt cell at an even offset from <code>≫</code>.

=== Multi-IP collision halt ===

<syntaxhighlight lang="text">
→1.2.3t4.5.6←@
</syntaxhighlight>

Outputs <code>1 2 4 3 5 2 6 1 5 2</code> and halts with exit 0. The trailing <code>@</code> is dead code.

* The IP enters east, prints <code>1</code> and <code>2</code>, pushes <code>3</code>.
* <code>t</code> at column 6 spawns a child going west with empty stack.
* Parent and child run on the same row simultaneously in opposite directions, each printing as they go.
* After bouncing off <code>←</code> (parent) and <code>→</code> (child), they meet again at column 6 — the original <code>t</code> cell — at the same tick.
* Direction sum <code>(−1, 0) + (+1, 0) = (0, 0)</code> → both die. Live IP list is empty → program halts.

This is the canonical Windy halt pattern: deterministic concurrent IPs cancel each other out without an explicit terminator.

=== Asymmetric four-IP halt ===

<syntaxhighlight lang="text">
→1.2.3t4.5t6.7←@
</syntaxhighlight>

Outputs <code>1 2 4 3 2 6 5 1 7 4</code>. Two SPLITs spawn four IPs; they pairwise collide at columns 4 and 10 in two distinct ticks. The asymmetric layout (5 cells west of t₁ versus 8 cells east of it) only halts cleanly because the spacing satisfies <code>t₂ − t₁ = ← − t₂ = 4</code>. Random asymmetric layouts cascade indefinitely — the engineered timing is what makes the four IPs collide just before either of them re-executes a <code>t</code> cell.

=== Spiral that prints "code flows like wind" ===

<syntaxhighlight lang="text">
"dniw ekil swolf edoc"v
                      ≫

                      → , , , , , ↘
                    ↘
                    ≪→→t←           ↓

                    ,               ,

                    ,               ,

                    ,               ,

                    ,               ,

                    ,               ,

                    ↑               ↙

                      ↖ , , , , , ←
</syntaxhighlight>

Prints <code>code flows like wind</code> and halts. There is no <code>@</code> in the source. The IP rides a clockwise rotation at speed 2, printing one character per non-corner cell along the perimeter. At the eye of the spiral it drops back to speed 1 with <code>≪</code>, runs <code>t</code> to spawn a counter-going child, and parent + child arrive at the same cell from opposite sides on the next tick. The end-of-tick collision pass cancels them, the live IP list empties, and the program halts. All four "Windy-only" mechanics — eight winds, wind speed, SPLIT, collision merge — appear in the same program.

== Reference implementation ==

A single Rust crate, [https://github.com/sisobus/windy github.com/sisobus/windy], published on crates.io as [https://crates.io/crates/windy-lang windy-lang]. It compiles to three targets:

* '''Native''' — <code>cargo install windy-lang</code> installs a CLI <code>windy</code> with subcommands <code>run</code>, <code>debug</code>, <code>version</code>. The debugger steps tick by tick with full IP / stack / grid inspection.
* '''<code>wasm32-wasip1</code>''' — a portable <code>windy.wasm</code> runnable under any [[wikipedia:WebAssembly_System_Interface|WASI]] host (<code>wasmtime</code>, <code>wasmer</code>, etc.).
* '''<code>wasm32-unknown-unknown</code>''' — the browser playground at [https://windy.sisobus.com windy.sisobus.com], with a step debugger and a click-to-insert glyph palette for typing the Unicode arrows.

Two language-neutral conformance harnesses (<code>conformance/cases.json</code> and <code>conformance/v1.json</code>) pin stdout byte-for-byte across all three targets. Future implementations are expected to consume the same JSON.

The interpreter prints a banner to stderr if the source contains the literal substring <code>sisobus</code>; this is part of the spec and conforming implementations must preserve it.

== External resources ==

* [https://github.com/sisobus/windy GitHub repository] — Rust source, examples, conformance harnesses, CI workflows
* [https://crates.io/crates/windy-lang crates.io: windy-lang] — published reference implementation
* [https://windy.sisobus.com Browser playground] — write, run, and step-debug Windy programs in the browser; modal Vim-style editor with click-to-insert glyph palette
* [https://github.com/sisobus/windy/blob/main/SPEC.md Language specification (SPEC.md)] — single source of truth for opcode semantics, IP scheduling, and collision merge rules
* [https://github.com/sisobus/windy/blob/main/CHANGELOG.md Changelog] — version history (Keep-a-Changelog format)
* [https://github.com/sisobus/windy/tree/main/examples Examples directory] — annotated <code>.wnd</code> programs from "Hello, World!" to four-IP asymmetric collision puzzles

[[Category:2026]]
[[Category:Languages]]
[[Category:Two-dimensional languages]]
[[Category:Stack-based]]
[[Category:Concurrent]]
[[Category:Turing complete]]
[[Category:Unicode]]

<!-- === end wiki === -->
