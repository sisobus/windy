<!--
  Draft of the esolangs.org wiki entry for Windy.

  esolangs.org runs MediaWiki, so the body below uses MediaWiki
  syntax — '''bold''', [[InternalLink]], [https://url label],
  <syntaxhighlight>...</syntaxhighlight>, {{infobox proglang|...}},
  category tags at the bottom. To upload:

    1. Go to https://esolangs.org/wiki/Windy
    2. Sign in (or create an account — no email required).
    3. Click "create this page".
    4. Paste everything BELOW the `=== begin wiki ===` marker.
    5. Save.

=== begin wiki ===
-->

{{infobox proglang
|name=Windy
|paradigms=[[:Category:Imperative paradigm|imperative]], [[:Category:Two-dimensional languages|two-dimensional]], stack-based
|author=Kim Sangkeun (sisobus)
|year=[[:Category:2026|2026]]
|memsys=infinite bi-directional sparse 2D grid + per-IP unbounded stack
|class=[[:Category:Turing complete|Turing complete]]
|refimpl=[https://github.com/sisobus/windy windy-lang]
|files=<code>.wnd</code>
|influenced_by=[[Befunge]], [[Funge-98]]
}}

'''Windy''' is a two-dimensional [[:Category:Esoteric|esoteric programming language]] designed by Kim Sangkeun (sisobus) in 2026. A program is a grid of Unicode characters; an instruction pointer (IP) drifts across the grid in one of '''eight winds''' — <code>→ ↗ ↑ ↖ ← ↙ ↓ ↘</code> — and executes the cell it lands on. The language was originally a [[Befunge]] dialect, but the v1.0 cut introduced two additive semantic features that Befunge lacks, and v2.0 made them the only behavior:

* '''Wind speed''' — every IP carries a strictly positive integer <code>speed</code> (default 1) and advances <code>speed</code> cells per tick. <code>≫</code> bumps speed, <code>≪</code> trims it. Only the destination cell decodes — intermediate cells are skipped entirely.
* '''IP collision merge''' — when two or more IPs share the same cell at end of tick, the runtime merges them: stacks concatenate in birth order, directions sum and clip per axis to {-1, 0, +1}, speed becomes the max, and a head-on cancel kills the merged IP.

The name is the Korean reading of the [[wikipedia:Arcanine|Pokémon Arcanine]] (윈디); the wind-direction mechanic is a thematic pun on the name.

== Overview ==

The language has '''35 opcodes''' total — there are no functions, no types, no modules, and no standard library. All structure is emergent from grid layout, IP geometry, and inter-IP collisions.

Promises Windy makes by spec:

* '''Arbitrary precision'''. Stack values, IP wind speed, and grid coordinates are all unbounded integers. Programs that exercise them — e.g. <code>factorial.wnd</code> printing 1! through 10! — run without overflow.
* '''Bi-infinite sparse grid'''. Negative <code>g</code>/<code>p</code> coordinates are perfectly legal; cells you never write occupy zero memory.
* '''Tick-deterministic concurrent IPs'''. Each tick is a single round-robin pass over live IPs in birth order. New IPs born this tick wait until the next; <code>@</code> halts only the executing IP; collision merges happen in birth order. The same source, seed, and stdin produce the same stdout across the native CLI, the WASI binary, and the browser playground.
* '''Mandatory author signature'''. If the source contains the ASCII substring <code>sisobus</code>, the interpreter prints a banner to stderr before the program runs. Implementations that suppress or alter the banner are non-conforming.

== Opcodes ==

{| class="wikitable"
|-
! Category !! Glyph !! Effect
|-
| Flow || (space) <code>·</code> || NOP
|-
| Flow || <code>@</code> || HALT (remove the executing IP from the live list; when the list empties, the program ends)
|-
| Flow || <code>#</code> || TRAMPOLINE (advance an extra step, skipping the next cell)
|-
| Flow || <code>t</code> || SPLIT — spawn a new IP at <code>(x − dx, y − dy)</code> going <code>(−dx, −dy)</code> with empty stack, strmode off, and the parent's speed
|-
| Wind || <code>→</code> (<code>></code>) || <code>dir ← (+1,&nbsp;0)</code>
|-
| Wind || <code>↗</code> || <code>dir ← (+1, −1)</code>
|-
| Wind || <code>↑</code> (<code>^</code>) || <code>dir ← (0, −1)</code>
|-
| Wind || <code>↖</code> || <code>dir ← (−1, −1)</code>
|-
| Wind || <code>←</code> (<code><</code>) || <code>dir ← (−1,&nbsp;0)</code>
|-
| Wind || <code>↙</code> || <code>dir ← (−1, +1)</code>
|-
| Wind || <code>↓</code> (<code>v</code>) || <code>dir ← (0, +1)</code>
|-
| Wind || <code>↘</code> || <code>dir ← (+1, +1)</code>
|-
| Wind || <code>~</code> || TURBULENCE — uniform random pick of the eight winds (deterministic with <code>--seed</code>)
|-
| Speed || <code>≫</code> || GUST — <code>speed += 1</code>
|-
| Speed || <code>≪</code> || CALM — <code>speed −= 1</code>; runtime trap (exit 134) if it would yield 0
|-
| Literal || <code>0</code>–<code>9</code> || push the digit's integer value
|-
| Literal || <code>"</code> || toggle string mode (cells push their codepoint instead of executing)
|-
| Arithmetic || <code>+ - * / %</code> || pop two, push result; floor division/modulo, divide-by-zero pushes 0
|-
| Arithmetic || <code>!</code> || logical NOT (push 1 if top is 0, else 0)
|-
| Arithmetic || <code>`</code> || GT (push 1 if a > b else 0)
|-
| Stack || <code>:</code> || DUP
|-
| Stack || <code>$</code> || DROP
|-
| Stack || <code>\</code> || SWAP
|-
| Branch || <code>_</code> || pop; <code>dir ← east if 0 else west</code>
|-
| Branch || <code>&#124;</code> || pop; <code>dir ← south if 0 else north</code>
|-
| I/O || <code>.</code> || PUT_NUM (decimal repr followed by a space)
|-
| I/O || <code>,</code> || PUT_CHR (Unicode codepoint as a character)
|-
| I/O || <code>&</code> || GET_NUM (read one decimal integer from stdin; EOF ⇒ -1)
|-
| I/O || <code>?</code> || GET_CHR (read one Unicode character; EOF ⇒ -1)
|-
| Grid || <code>g</code> || pop y, pop x, push <code>G[(x,&nbsp;y)]</code> (missing ⇒ 0x20)
|-
| Grid || <code>p</code> || pop y, pop x, pop v, write <code>G[(x,&nbsp;y)] ← v</code>
|}

Cells outside the table decode as NOP plus a one-shot warning per glyph on stderr.

== Examples ==

=== Hello, World! ===

<syntaxhighlight lang="text">
"!dlroW ,olleH",,,,,,,,,,,,,@
</syntaxhighlight>

The strmode segment <code>"!dlroW ,olleH"</code> pushes the message reverse-bytewise so that <code>'H'</code> lands on top of the stack. Each subsequent <code>,</code> pops one codepoint and writes it as a Unicode character. <code>@</code> halts.

=== Two-dimensional Hello ===

<syntaxhighlight lang="text">
"!dlroW ,olleH"↓
        ↓      ←
        →:#,_@
</syntaxhighlight>

Same idea, but the IP routes through a <code>↓ ↓ → :#,_@</code> loop on the second and third rows: <code>:</code> dups the stack top, <code>#</code> trampolines past the <code>,</code> on a zero (so the loop falls through to <code>@</code>), and <code>_</code> branches west on a non-zero to repeat the print.

=== Add two integers from stdin ===

<syntaxhighlight lang="text">
&&+.@
</syntaxhighlight>

Five cells. <code>&</code> reads a decimal integer from stdin and pushes it; the second <code>&</code> reads the next; <code>+</code> sums; <code>.</code> prints the decimal repr; <code>@</code> halts. Run as <code>echo "3 4" | windy run examples/add.wnd</code> → <code>7</code>.

=== Wind speed in action ===

<syntaxhighlight lang="text">
"YDNIW"≫$,$,$,$,$,@@
</syntaxhighlight>

Prints <code>WINDY</code>. The strmode segment loads five codepoints; <code>≫</code> raises speed to 2, so the IP lands on every other subsequent cell — exactly the <code>,</code> cells, while flying over the <code>$</code> drops in between. With speed 1 the IP would visit every cell and the alternating <code>$/,</code> would discard a letter for every one printed. Wind speed is what makes the message reach stdout.

=== Spiral with all four v2.0 mechanics ===

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

Prints <code>code flows like wind</code> and halts. There is no <code>@</code> anywhere in the source. The IP rides a clockwise rotation at speed 2, printing one character per non-corner cell along the perimeter; at the eye of the spiral it drops to speed 1, runs <code>t</code> to spawn a counter-going child, and parent + child arrive at the same cell from opposite sides on the next tick. The end-of-tick collision pass cancels them head-on, the live IP list empties, and the program halts. The four v2.0 mechanics — eight winds, wind speed, SPLIT, and collision merge — all show up in one program.

== Implementation ==

The reference implementation is a single Rust crate at [https://github.com/sisobus/windy github.com/sisobus/windy], published on crates.io as [https://crates.io/crates/windy-lang windy-lang]. It targets:

* '''Native''' (<code>cargo install windy-lang</code>) — a CLI <code>windy run / debug / version</code>.
* '''<code>wasm32-wasip1</code>''' — a portable <code>windy.wasm</code> runnable under any [[wikipedia:WebAssembly_System_Interface|WASI]] host (<code>wasmtime</code>, <code>wasmer</code>, etc.).
* '''<code>wasm32-unknown-unknown</code>''' (browser) — the playground at [https://windy.sisobus.com windy.sisobus.com], with a step debugger and click-to-insert glyph palette.

Two language-neutral conformance harnesses (<code>conformance/cases.json</code> and <code>conformance/v1.json</code>) pin stdout byte-for-byte across all three targets. Future implementations are expected to consume the same JSON.

== External resources ==

* [https://github.com/sisobus/windy GitHub repository]
* [https://crates.io/crates/windy-lang crates.io: windy-lang]
* [https://windy.sisobus.com Browser playground]
* [https://github.com/sisobus/windy/blob/main/SPEC.md Language specification (SPEC.md)]

[[Category:2026]]
[[Category:Languages]]
[[Category:Two-dimensional languages]]
[[Category:Stack-based]]
[[Category:Turing complete]]
[[Category:Funge]]

<!-- === end wiki === -->
