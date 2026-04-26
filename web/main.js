import init, { run, version, Session } from './pkg/windy.js?v=__VERSION__';

// Inline the canonical examples so the playground is self-contained and
// works over `file://` too (no fetch fallbacks needed).
const EXAMPLES = {
  hello: `"!dlroW ,olleH",,,,,,,,,,,,,@\n`,

  add: `&&+.@

  sisobus
  ----------------------------------------------------------------------
  Read two integers from stdin, print their sum.

  Try it: put "3 4" in the stdin box below and hit Run.
          Output: "7 ".

  How: the source is one row, five cells.

      &   GET_NUM   read one decimal integer from stdin, push to
                    the stack. Whitespace between integers is
                    consumed automatically; EOF or malformed
                    input pushes -1.
      &   GET_NUM   read the second integer.
      +   ADD       pop b, pop a, push a + b.
      .   PUT_NUM   pop the top, write its decimal repr followed
                    by a single space.
      @   HALT      end the program.

  Notes
  -----
  - Stack values are arbitrary-precision (SPEC §2 #4). Try
    "100000000000000000 1" — no overflow, the sum is exact.
  - The two integers can be on the same line or separate lines;
    \`&\` skips leading whitespace before each read.
  - Five characters is also the entire program. This is what
    Windy looks like once you stop bracing for ceremony.
`,

  hello_winds: `"!dlroW ,olleH"↓
        ↓      ←
        →:#,_@

     sisobus — signature lives on row 4, IP never visits it.
`,

  fib: `55+055+p0155+p1255+pv
                    v                                     <
                    >155+g:.255+g:155+p+255+p055+g1-:055+p|
                                                          @

   sisobus — Fibonacci via grid memory (g/p). IP never visits this row.
`,

  stars: `55+"*****"55+"****"55+"***"55+"**"55+"*"45*055+5*pv
                                                  v                  <
                                                  >,055+5*g1-:055+5*p|
                                                                     @

  sisobus
  ----------------------------------------------------------------------
  How this prints the triangle (a "2D for-loop" expressed in 1D):

    1) Build the entire output on the stack first, IN REVERSE because
       a stack is LIFO.  String-mode segments push '*' codepoints (42),
       and \`55+\` pushes a newline (10).  After row 0's first 40 cells:

         bottom -> 10, *****, 10, ****, 10, ***, 10, **, 10, *  <- top

    2) Init a counter at grid (0, 50): \`45*\` pushes 4·5 = 20 (the total
       characters to print), and \`055+5*p\` stores it.

    3) The east-going loop on row 2 pops one char with \`,\`, decrements
       the counter, stores it back, and uses \`|\` to halt when zero.
       Top-of-stack = '*' first → output is "*\\n**\\n***\\n****\\n*****\\n".

  The same idea works for any structured shape: lay the bytes out on
  the stack in reverse, then drain them with a counter.
`,

  factorial: `1055+5*p1155+5*pv
                                                              @
                >155+5*g055+5*g*:155+5*p.055+5*g1+:055+5*p55+\`|
                ^                                             <

  sisobus
  ----------------------------------------------------------------------
  Print the first ten factorials (1! through 10!) using grid memory.

  Layout:
    n     at cell (0, 50)   — counter, starts at 1
    fact  at cell (1, 50)   — running product, starts at 1

  Each tick of row 2 (going east):
    155+5*g   load fact
    055+5*g   load n
    *         fact * n  → new fact
    :155+5*p  dup, store new fact at (1, 50)
    .         print fact (decimal + space)
    055+5*g   load n again
    1+:       n + 1, dup
    055+5*p   store new n at (0, 50)
    55+\`      push 10, GT  → 1 if n+1 > 10 else 0
    |         IF_V — top=1 → north (halt @), top=0 → south (loop back)

  Output: "1 2 6 24 120 720 5040 40320 362880 3628800 "
  The values quickly outgrow i64 — Windy's stack is BigInt.
`,

  split: `#@,"A",t"B",@

  sisobus
  ----------------------------------------------------------------------
  Concurrent IPs (v0.4) via the \`t\` (SPLIT) opcode.

  Tick by tick on row 0 — IP0 is the original, IP1 spawns at the t cell:

    tick  IP0 cell   IP0 effect          IP1 cell   IP1 effect
    ----  --------   ------------------  ---------  --------------------
     1    (0)#       trampoline → skip
     2    (2),       underflow print 0       —         not yet alive
     3    (3)"       strmode on              —
     4    (4)A       push 65                 —
     5    (5)"       strmode off             —
     6    (6),       print 'A'               —
     7    (7)t       SPLIT                   —     IP1 spawns at (6,0)
                                                       going west, empty stack
     8    (8)"       strmode on             (6),       underflow print 0
     9    (9)B       push 66                (5)"       strmode on
    10    (10)"      strmode off            (4)A       push 65
    11    (11),      print 'B'              (3)"       strmode off
    12    (12)@      HALT (IP0 only)        (2),       print 'A'
                                            (1)@       HALT (next tick)

  After tick 12 IP0 is gone but IP1 keeps going. Tick 13: IP1 at (1,0) =
  \`@\`, halts. List empties → program ends.

  Stdout sequence (in tick order):
    tick 2:  '\\0'  (IP0)
    tick 6:  'A'   (IP0)
    tick 8:  '\\0'  (IP1)
    tick 11: 'B'   (IP0)
    tick 12: 'A'   (IP1)

  Visible chars (most terminals swallow \\0): "ABA".

  Things to notice:
    - Each IP has its own stack. IP1's stack is empty when it spawns; it
      builds its own "A" by re-running the strmode segment going west.
    - \`@\` only halts the executing IP — IP0 halts at (12,0) but IP1
      keeps running until it finds its own \`@\` at (1,0).
    - IP0 uses \`#\` (trampoline) at (0,0) so it skips IP1's halt cell at
      (1,0). Without that, IP0 would have halted before ever reaching
      \`t\`.
`,

  gust: `"YDNIW"≫$,$,$,$,$,@@

  sisobus
  ----------------------------------------------------------------------
  Wind speed shaping the output. Run as-is and the program prints
  WINDY.

  How: "YDNIW" pushes 5 codepoints in reverse, so 'W' lands on top
  of the stack. Then ≫ raises speed to 2, and the second half is a
  1D obstacle course of $/, pairs:

      $   DROP    — tosses the top
      ,   PUT_CHR — pops the top and writes its codepoint as a char

  At speed 2 the IP only lands on every other cell. The layout puts
  every $ on an odd-index cell and every , on an even-index cell, so
  the IP hits all five \`,\`s and flies over all five \`$\`s,
  draining the stack cleanly into "WINDY". Without the speed boost
  the IP would visit every cell and the alternating $/, sequence
  would drop a letter for every one it prints — so wind speed is
  literally what makes the message reach stdout.

  Tick-by-tick:

    tick  cell        op            speed   stack                    out
    ----  ----------  ------------  -----   ----------------------   ---
     1    (0)  "      strmode on    1       []                       —
     2    (1)  Y      push 89       1       [89]                     —
     3    (2)  D      push 68       1       [89,68]                  —
     4    (3)  N      push 78       1       [89,68,78]               —
     5    (4)  I      push 73       1       [89,68,78,73]            —
     6    (5)  W      push 87       1       [89,68,78,73,87]         —
     7    (6)  "      strmode off   1       (no change)              —
     8    (7)  ≫      speed += 1    2       (no change)              —
     9    (9)  ,      pop 87, putc  2       [89,68,78,73]            W
    10    (11) ,      pop 73, putc  2       [89,68,78]               I
    11    (13) ,      pop 78, putc  2       [89,68]                  N
    12    (15) ,      pop 68, putc  2       [89]                     D
    13    (17) ,      pop 89, putc  2       []                       Y
    14    (19) @      HALT          —       []                       —

  Ticks 9–13 advance by 2 columns each: the IP lands on columns 9,
  11, 13, 15, 17 — exactly the \`,\` cells. The \`$\` cells at
  columns 8, 10, 12, 14, 16 are intermediate cells the IP flies
  over without decoding (SPEC §3.7).

  Things to play with:

    - Replace ≫ with ≫≫ to push speed to 3. The IP now lands on
      columns 10, 13, 16, 19, ... none of which carry \`,\`, so v1
      prints nothing and falls into the trailing \`@@\`.

    - Add a ≪ between two of the \`,\`s. At speed 2 the IP lands on
      ≪, drops to speed 1, and starts traversing every cell again
      — half the output is "WINDY"-style sampled, half is v0-style
      "$,$,$,..." mangled.

    - Trace under Debug mode and watch the \`speed\` row in the
      state panel jump from 1 to 2 the moment the IP visits ≫.
`,

  storm: `→"AB"t"CD"←@

  sisobus
  ----------------------------------------------------------------------
  IP collision merge as a runtime garbage collector.

  Two IPs each build a stack of 5 codepoints, then collide head-on
  at column 5 on tick 15 and vanish. The program halts cleanly with
  exit 0 and empty stdout. The interesting part is what happens on
  the way there.

  Source is one row, 12 cells:

      → " A B " t " C D " ← @
      0 1 2 3 4 5 6 7 8 9 10 11

  Tick-by-tick (v1.0 default):

    tick  IP0 cell  IP0 effect                   IP1 cell  IP1 effect
    ----  --------  ---------------------------  --------  -----------------
     1    (0,0)→    set east; → (1,0)            —         not yet alive
     2    (1,0)"    strmode on; → (2,0)          —
     3    (2,0)A    push 65; → (3,0)             —
     4    (3,0)B    push 66; → (4,0)             —
     5    (4,0)"    strmode off; → (5,0)         —
     6    (5,0)t    SPLIT IP1 at (4,0) west;     —         (born this tick,
                    → (6,0)                                  runs from tick 7)
     7    (6,0)"    strmode on; → (7,0)          (4,0)"    strmode on; → (3,0)
     8    (7,0)C    push 67; → (8,0)             (3,0)B    push 66; → (2,0)
     9    (8,0)D    push 68; → (9,0)             (2,0)A    push 65; → (1,0)
    10    (9,0)"    strmode off; → (10,0)        (1,0)"    strmode off; → (0,0)
    11    (10,0)←   set west; → (9,0)            (0,0)→    set east; → (1,0)
    12    (9,0)"    strmode on; → (8,0)          (1,0)"    strmode on; → (2,0)
    13    (8,0)D    push 68 again; → (7,0)       (2,0)A    push 65 again; → (3,0)
    14    (7,0)C    push 67 again; → (6,0)       (3,0)B    push 66 again; → (4,0)
    15    (6,0)"    strmode off; → (5,0)         (4,0)"    strmode off; → (5,0)
       ↓ end-of-tick collision: both IPs at (5,0) ↓
              IP0 dir (-1,0) + IP1 dir (1,0) = (0,0) — head-on, dies.
              IP0 stack [65,66,67,68,68,67]  ("ABCDDC")
              IP1 stack [66,65,65,66]        ("BAAB")
              Birth-order merge would yield [A,B,C,D,D,C,B,A,A,B]
              ("ABCDDCBAAB") — but the head-on kills it.

  The merge pass earning its keep
  -------------------------------
  This isn't just a semantic feature — it's a runtime garbage
  collector for IPs that end up sharing a cell. Without it, this
  layout would fork-bomb: every visit to (5,0) hits \`t\` and
  spawns another child, the population doubles every couple of
  ticks, and the page locks up. The collision pass turns that
  pathological case into a clean exit-0.

  Things to try:

    - Step through under Debug mode. Watch the IP count in the
      state panel: 1 → 2 at tick 6, 2 → 0 at tick 15.

    - Cap with max-steps 14 to abort just before the collision and
      inspect the two pre-merge stacks side by side.
`,

  anthem: `"dniw ekil swolf edoc"v
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

  sisobus
  ----------------------------------------------------------------------
  Output:  code flows like wind

  Notice there is no \`@\` anywhere in this program. It still
  halts cleanly. Two winds meet head-on at the eye of the spiral
  and the program ends.

  How it flows
  ------------
  Row 0 builds the message in reverse so 'c' lands on top of the
  stack, then \`v\` redirects the IP south. On the next tick \`≫\`
  raises its speed to 2.

  From there the IP rides a clockwise rotation with diagonal
  corners — \`↘ ↙ ↖\` — at speed 2. Each edge holds five \`,\`
  print cells:

    top edge        →  prints "code "
    right edge      →  prints "flows"
    bottom edge     →  prints " like"   (read west-to-east)
    left edge       →  prints " wind"

  After the final 'd' on the left edge at (20, 7), the IP advances
  north to (20, 5) — the eye of the storm. Three things happen
  there in quick succession:

    (20, 5)  ≪   speed drops to 1
    (20, 4)  ↘   redirect to south-east
    (21, 5)  →   set east

  Then at speed 1 the IP runs into:

    (22, 5)  →
    (23, 5)  t   SPLIT — child spawns at (22, 5) going west
    (24, 5)  ←   parent reverses, now heading west

  On the next tick parent and child both arrive at (23, 5) from
  opposite sides:

    parent: (24, 5) ←  →  advances west to (23, 5)
    child:  (22, 5) →  →  advances east to (23, 5)

  End-of-tick collision pass (SPEC §3.8): two IPs share (23, 5).
  Direction sum is (-1, 0) + (+1, 0) = (0, 0) — head-on. The
  merged IP dies. Live IP list is empty, so the runtime halts.
  No \`@\` ever runs.

  The drop to speed 1 is load-bearing
  ----------------------------------
  At speed 2 the parent only ever lands on even-x cells. The
  child of \`t\` is born at (parent_x − 1) — odd-x — and
  speed-2 movement preserves that parity, so parent and child
  slide past each other forever. The \`≪\` puts both IPs back
  on a common parity, so the merge can actually happen.

  In other words: the wind has to slow down for the storm to
  meet itself.

  All four v2.0 mechanics in one program
  --------------------------------------
  - Eight winds (the corner glyphs ↘ ↙ ↖ + cardinal → ↓ ↑ ←).
  - Wind speed (\`≫\` on the way in, \`≪\` at the eye).
  - SPLIT (\`t\` creates the second IP).
  - IP collision merge (head-on cancel halts the program).

  Things to notice
  ----------------
  - Step under Debug. The state panel reads \`ips: 1\` for the
    entire outer rotation, flips to \`ips: 2\` on the tick \`t\`
    runs, and drops to \`ips: 0\` one tick later when the merge
    fires. That \`2 → 0\` transition is the halt.

  - Open the source in any text editor and the IP's actual
    trajectory is visible as the spiral itself.
`,

  winds: `→ #↓t #↓t #↓t #↓t @









   @   @   @   @

  sisobus
  ----------------------------------------------------------------------
  Five winds blow simultaneously across the grid. The program
  prints nothing; it exists to exhibit Windy's multi-IP machinery.
  At peak the runtime juggles five live IPs in parallel.

  How it works
  ------------
  Row 0 holds four \`t\` SPLITs. The parent IP enters going east
  and crosses them in sequence. Each \`t\` spawns a fresh child
  at (parent_x − 1, 0) going west. Four splits = five total IPs
  (1 parent + 4 children).

  Cascade avoidance
  -----------------
  Two design tricks keep the splits clean:

  1. \`#\` (TRAMPOLINE) before each \`t\`. The parent reads \`#\`,
     skips the next cell, and lands on \`t\`. The cell that gets
     skipped is always \`↓\` — that's deliberate.
  2. \`↓\` at every (col_t − 1) position. When the child reads
     its first cell, it sees \`↓\`, sets its direction to south,
     and immediately leaves row 0. It never re-traverses the
     row of \`t\`s, so children can't snowball.

  After the four splits the parent continues east, falls into
  the final \`@\` at (18, 0), and halts. Each child descends
  ten blank rows of NOP space and lands on its own \`@\` on
  row 10:

      col 3   col 7   col 11   col 15
       │        │         │         │
       ↓        ↓         ↓         ↓
       (drift through 9 rows of space)
       ↓        ↓         ↓         ↓
       @        @         @         @

  Tick-by-tick IP count
  ---------------------
    tick 0–3   : 1 (parent only)
    tick 4     : 2 (child1 born)
    tick 7     : 3 (child2 born)
    tick 10    : 4 (child3 born)
    tick 13    : 5 ← peak
    tick 14    : 5 (all four children still descending)
    tick 15    : 3 (parent halts; child1 halts on row 10)
    tick 18    : 2 (child2 halts)
    tick 21    : 1 (child3 halts)
    tick 24    : 0 (child4 halts; program ends)

  Things to notice
  ----------------
  - Step under Debug. Watch the \`ips:\` row climb 1 → 2 → 3
    → 4 → 5 then drain back to 0. The grid view highlights
    every live IP cell, so the four descending columns light
    up at once.

  - The blank rows in the source aren't padding — they are
    the children's flight paths, drawn into the grid as empty
    space. Each child crosses ten of those rows.
`,

  blank: '',
};

const VIEWPORT_W_DESKTOP = 60;
const VIEWPORT_W_MOBILE = 36;
const VIEWPORT_H_DESKTOP = 13;
const VIEWPORT_H_MOBILE = 15;

function currentViewport() {
  const mobile = matchMedia('(max-width: 800px)').matches;
  return mobile
    ? { w: VIEWPORT_W_MOBILE, h: VIEWPORT_H_MOBILE }
    : { w: VIEWPORT_W_DESKTOP, h: VIEWPORT_H_DESKTOP };
}

const DIR_NAMES = {
  '1,0': '→ east',
  '1,-1': '↗ ne',
  '0,-1': '↑ north',
  '-1,-1': '↖ nw',
  '-1,0': '← west',
  '-1,1': '↙ sw',
  '0,1': '↓ south',
  '1,1': '↘ se',
};

const $ = (id) => document.getElementById(id);

// Editor + input
const sourceEl = $('source');
const stdinEl = $('stdin');
const pickerEl = $('example-picker');
const seedEl = $('seed');
const maxStepsEl = $('max-steps');
const versionBadge = $('version-badge');

// Idle-mode toolbar + run output
const toolbarIdle = $('toolbar-idle');
const runBtn = $('btn-run');
const debugBtn = $('btn-debug');
const outputRun = $('output-run');
const stdoutEl = $('stdout');
const stderrEl = $('stderr');
const exitEl = $('exit-code');

// Debug-mode toolbar + panels
const toolbarDebug = $('toolbar-debug');
const stepBtn = $('btn-step');
const continueBtn = $('btn-continue');
const restartBtn = $('btn-restart');
const exitDebugBtn = $('btn-exit-debug');
const outputDebug = $('output-debug');
const gridView = $('grid-view');
const gridLabel = $('grid-viewport-label');
const stateView = $('state-view');
const stackView = $('stack-view');
const stackLenEl = $('stack-len');
const debugStdoutEl = $('debug-stdout');

let wasmReady = false;
let session = null;
let mode = 'idle'; // 'idle' | 'debug'

function loadExample(key) {
  sourceEl.value = EXAMPLES[key] ?? '';
}

function parseOptionalBigInt(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return BigInt(Math.floor(n));
}

// ---------- Run mode ----------

async function handleRun() {
  if (!wasmReady || mode !== 'idle') return;
  runBtn.disabled = true;
  debugBtn.disabled = true;
  stdoutEl.textContent = '';
  stderrEl.textContent = '';
  exitEl.textContent = 'running…';

  await new Promise((r) => setTimeout(r, 0));

  try {
    const result = run(
      sourceEl.value,
      stdinEl.value,
      parseOptionalBigInt(seedEl.value),
      parseOptionalBigInt(maxStepsEl.value),
    );
    stdoutEl.textContent = result.stdout;
    stderrEl.textContent = result.stderr;
    // exit 134 = v1 runtime trap (CALM at speed 1). Surface it
    // explicitly so users don't squint at "exit 134".
    if (result.exit === 134) {
      exitEl.textContent = 'exit 134 · trap';
    } else if (result.exit === 124) {
      exitEl.textContent = 'exit 124 · max-steps';
    } else {
      exitEl.textContent = `exit ${result.exit}`;
    }
    result.free();
  } catch (err) {
    stderrEl.textContent = String(err);
    exitEl.textContent = 'error';
  } finally {
    runBtn.disabled = false;
    debugBtn.disabled = false;
  }
}

// ---------- Debug mode ----------

const escHtml = (ch) =>
  ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;

function renderGridView() {
  const { w: vw, h: vh } = currentViewport();
  const ipX = Number(session.ip_x);
  const ipY = Number(session.ip_y);
  const x0 = ipX - Math.floor(vw / 2);
  const y0 = ipY - Math.floor(vh / 2);

  const cells = session.grid_slice(x0, y0, vw, vh);

  // Collect every live IP's (x, y) so we can highlight multi-IP programs.
  const positions = session.ip_positions();
  const ipCells = new Set();
  for (let i = 0; i < positions.length; i += 4) {
    const x = Number(positions[i]);
    const y = Number(positions[i + 1]);
    ipCells.add(`${x},${y}`);
  }

  const lines = [];
  for (let dy = 0; dy < vh; dy++) {
    const row = [];
    for (let dx = 0; dx < vw; dx++) {
      const cp = cells[dy * vw + dx];
      let ch = String.fromCodePoint(cp);
      if (cp < 0x20 || cp === 0x7f) ch = ' ';
      const safe = escHtml(ch);
      if (ipCells.has(`${x0 + dx},${y0 + dy}`)) {
        row.push(`<span class="ip-cell">${safe}</span>`);
      } else {
        row.push(safe);
      }
    }
    lines.push(row.join(''));
  }
  gridView.innerHTML = lines.join('\n');
  const ipCount = Number(session.ip_count);
  gridLabel.textContent = ipCount > 1
    ? `(${ipX}, ${ipY}) · ${ipCount} IPs`
    : `(${ipX}, ${ipY})`;
}

function renderState() {
  const dirKey = `${session.dx},${session.dy}`;
  const cp = session.current_cell();
  const ch = cp ? String.fromCodePoint(cp) : '?';
  const displayCh = (cp >= 0x20 && cp !== 0x7f) ? ch : ' ';
  const rows = [
    ['step', session.steps.toString()],
    ['ips', Number(session.ip_count).toString()],
    ['ip', `(${session.ip_x}, ${session.ip_y})`],
    ['dir', DIR_NAMES[dirKey] ?? '?'],
    ['strmod', session.strmode ? 'on' : 'off'],
  ];
  // Surface speed (per primary IP) and any trap state.
  const ipCount = Number(session.ip_count);
  if (ipCount <= 1) {
    rows.push(['speed', session.speed_for(0)]);
  } else {
    const speeds = [];
    for (let i = 0; i < ipCount; i++) speeds.push(session.speed_for(i));
    rows.push(['speed', speeds.join(' / ')]);
  }
  if (session.trapped) {
    rows.push(['trap', 'calm in still air']);
  }
  rows.push(['halted', session.halted ? 'yes' : 'no']);
  rows.push(['cell', `${JSON.stringify(displayCh)} (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`]);
  rows.push(['op', session.current_op()]);
  stateView.innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escHtml(v)}</dd>`)
    .join('');
}

function renderOneStack(values) {
  if (values.length === 0) return '<span class="empty">(empty)</span>';
  const shown = values.slice(-40).reverse();
  const hidden = values.length - shown.length;
  const lines = shown.map((v) => escHtml(v));
  if (hidden > 0) lines.push(`… (+${hidden} below)`);
  return lines.join('\n');
}

function renderStack() {
  const ipCount = Number(session.ip_count);
  if (ipCount === 0) {
    stackLenEl.textContent = '';
    stackView.innerHTML = '<span class="empty">(no live IPs)</span>';
    return;
  }
  if (ipCount === 1) {
    // Single-IP programs keep the original compact rendering.
    const values = session.stack();
    stackLenEl.textContent = `(${values.length})`;
    stackView.innerHTML = '';
    const pre = document.createElement('pre');
    pre.className = 'stack-body';
    pre.innerHTML = renderOneStack(values);
    stackView.appendChild(pre);
    return;
  }
  // Multi-IP — one labelled section per live IP, in birth order.
  const totalEntries = (() => {
    let n = 0;
    for (let i = 0; i < ipCount; i++) n += Number(session.stack_len_for(i));
    return n;
  })();
  stackLenEl.textContent = `(${ipCount} IPs · ${totalEntries})`;
  stackView.innerHTML = '';
  for (let i = 0; i < ipCount; i++) {
    const values = session.stack_for(i);
    const section = document.createElement('div');
    section.className = 'stack-section';

    const head = document.createElement('div');
    head.className = 'stack-section-head';
    head.textContent = `IP ${i} (${values.length})`;
    section.appendChild(head);

    const pre = document.createElement('pre');
    pre.className = 'stack-body';
    pre.innerHTML = renderOneStack(values);
    section.appendChild(pre);

    stackView.appendChild(section);
  }
}

function renderDebug() {
  renderGridView();
  renderState();
  renderStack();
  debugStdoutEl.textContent = session.stdout();
}

function freeSession() {
  if (!session) return;
  try {
    session.free();
  } catch (_) {
    // wasm-bindgen throws if free() is called twice; ignore.
  }
  session = null;
}

function buildSession() {
  return new Session(
    sourceEl.value,
    stdinEl.value,
    parseOptionalBigInt(seedEl.value),
    parseOptionalBigInt(maxStepsEl.value),
  );
}

function enterDebug() {
  if (!wasmReady) return;
  freeSession();
  try {
    session = buildSession();
  } catch (err) {
    stderrEl.textContent = String(err);
    exitEl.textContent = 'error';
    return;
  }
  mode = 'debug';
  document.body.classList.add('debug-mode');
  toolbarIdle.hidden = true;
  toolbarDebug.hidden = false;
  outputRun.hidden = true;
  outputDebug.hidden = false;
  renderDebug();
  // Don't auto-focus stepBtn on touch devices — it scrolls the page and
  // summons the virtual keyboard on some platforms. Only grab focus when
  // there's a physical keyboard in play.
  if (!matchMedia('(pointer: coarse)').matches) {
    stepBtn.focus();
  }
}

function exitDebug() {
  freeSession();
  mode = 'idle';
  document.body.classList.remove('debug-mode');
  toolbarIdle.hidden = false;
  toolbarDebug.hidden = true;
  outputRun.hidden = false;
  outputDebug.hidden = true;
}

function restartDebug() {
  if (mode !== 'debug') return;
  freeSession();
  try {
    session = buildSession();
  } catch (err) {
    stderrEl.textContent = String(err);
    return;
  }
  renderDebug();
}

function doStep() {
  if (mode !== 'debug' || !session) return;
  if (session.halted) return;
  session.step();
  renderDebug();
}

function doContinue() {
  if (mode !== 'debug' || !session) return;
  const exit = session.run_to_halt();
  renderDebug();
  if (exit === 124) {
    debugStdoutEl.textContent += '\n[max-steps exceeded]';
  } else if (exit === 134) {
    debugStdoutEl.textContent += '\n[trap: ' + (session.stderr() || 'runtime trap') + ']';
  }
}

// ---------- URL hash permalink ----------

const PERMALINK_PREFIX = '#s=';

function encodeSourceForHash(src) {
  const bytes = new TextEncoder().encode(src);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  // Base64 → base64url for slightly friendlier hashes.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSourceFromHash(hash) {
  // Accept `#s=…` (current) or a bare `#…` blob (looser; matches older
  // shared links if we ever widen the format).
  let payload = null;
  if (hash.startsWith(PERMALINK_PREFIX)) payload = hash.slice(PERMALINK_PREFIX.length);
  if (payload == null) return null;
  try {
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (_) {
    return null;
  }
}

let hashWriteTimer = null;
function scheduleHashWrite() {
  clearTimeout(hashWriteTimer);
  hashWriteTimer = setTimeout(() => {
    const src = sourceEl.value;
    if (!src) {
      // Drop the hash when the editor is empty.
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      history.replaceState(null, '', PERMALINK_PREFIX + encodeSourceForHash(src));
    }
  }, 250);
}

// ---------- Wire up ----------

pickerEl.addEventListener('change', (e) => {
  loadExample(e.target.value);
  scheduleHashWrite();
});
runBtn.addEventListener('click', handleRun);
debugBtn.addEventListener('click', enterDebug);
stepBtn.addEventListener('click', doStep);
continueBtn.addEventListener('click', doContinue);
restartBtn.addEventListener('click', restartDebug);
exitDebugBtn.addEventListener('click', exitDebug);

// ---------- Vim-style modal editor ----------
//
// Two modes — NORMAL (default) and INSERT — and a small subset of
// vim navigation keys, plus 2D-aware auto-padding so moving down or
// right past the end of a row pads the destination with spaces.
// First-time visitors typically pick an example and Run, never
// touching the editor; users who actually edit hit `i` to type and
// `Esc` to navigate.

const modeBadge = $('mode-badge');
const modeToggleBtn = $('btn-mode-toggle');
let editorMode = 'normal';

function setEditorMode(next) {
  editorMode = next;
  modeBadge.textContent = next === 'normal' ? 'NORMAL' : 'INSERT';
  modeBadge.className = 'mode-badge mode-' + next;
  modeToggleBtn.textContent = next === 'normal' ? 'i' : 'Esc';
  document.body.classList.toggle('mode-normal', next === 'normal');
  document.body.classList.toggle('mode-insert', next === 'insert');
}
setEditorMode('normal');

// 1D textarea offset ↔ (row, col) helpers, with auto-padding moves.
function cursorRowCol() {
  const v = sourceEl.value;
  const pos = sourceEl.selectionStart;
  let row = 0, col = 0;
  for (let i = 0; i < pos; i++) {
    if (v.charCodeAt(i) === 10) { row++; col = 0; }
    else col++;
  }
  return { row, col };
}

function rowColToOffset(lines, row, col) {
  let pos = 0;
  for (let r = 0; r < row; r++) pos += lines[r].length + 1;
  return pos + col;
}

// Move cursor to (row, col). Pads with newlines / spaces as needed
// so moving "down past the end" works without the user manually
// typing whitespace.
function moveTo(row, col) {
  if (row < 0) row = 0;
  if (col < 0) col = 0;
  const lines = sourceEl.value.split('\n');
  while (lines.length <= row) lines.push('');
  while (lines[row].length < col) lines[row] += ' ';
  sourceEl.value = lines.join('\n');
  const pos = rowColToOffset(lines, row, col);
  sourceEl.selectionStart = sourceEl.selectionEnd = pos;
  sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
  sourceEl.focus();
}

function moveBy(dx, dy) {
  const { row, col } = cursorRowCol();
  moveTo(row + dy, col + dx);
}

function insertAtCursor(glyph) {
  const start = sourceEl.selectionStart;
  const end = sourceEl.selectionEnd;
  const v = sourceEl.value;
  sourceEl.value = v.slice(0, start) + glyph + v.slice(end);
  const caret = start + glyph.length;
  sourceEl.selectionStart = sourceEl.selectionEnd = caret;
  sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
  sourceEl.focus();
}

// Palette click. The 8 winds carry data-kind="wind" (set in the
// HTML by data-dx/data-dy living between -1 and +1 not both zero
// in practice); ≫ ≪ and · don't navigate, they just insert.
//
// In INSERT, clicking a wind drops the glyph at the cursor, switches
// back to NORMAL, and advances the cursor in the wind's direction
// — so the user "draws the path" by chaining clicks.
//
// In NORMAL, clicking a wind just moves the cursor in that
// direction (no insertion). The other glyphs still insert, since
// you can't type ≫ ≪ on a keyboard.
document.querySelectorAll('.glyph-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const glyph = btn.dataset.glyph;
    const dx = parseInt(btn.dataset.dx ?? '0', 10);
    const dy = parseInt(btn.dataset.dy ?? '0', 10);
    const isWind = (dx !== 0 || dy !== 0) && glyph !== '≫' && glyph !== '≪';
    if (isWind) {
      if (editorMode === 'insert') {
        insertAtCursor(glyph);
        // After insertAtCursor, cursor is +1 column from where we
        // were. The wind's destination is +(dx, dy) from that
        // pre-insert position, i.e. (dx-1, dy) from the new cursor.
        moveBy(dx - 1, dy);
        setEditorMode('normal');
      } else {
        moveBy(dx, dy);
      }
    } else {
      // ≫ ≪ · always insert at the cursor, mode unchanged.
      insertAtCursor(glyph);
    }
  });
});

modeToggleBtn.addEventListener('click', () => {
  setEditorMode(editorMode === 'normal' ? 'insert' : 'normal');
});

sourceEl.addEventListener('input', scheduleHashWrite);

sourceEl.addEventListener('keydown', (e) => {
  // Ctrl/Cmd+Enter runs the program from any mode.
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
    return;
  }

  if (editorMode === 'normal') {
    // Block raw typing — the textarea is in nav mode.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      switch (e.key) {
        // hjkl + yubn: 3×3 rogue-like compass.
        //
        //    y k u      ↖ ↑ ↗
        //    h   l  =   ←   →
        //    b j n      ↙ ↓ ↘
        case 'h': moveBy(-1,  0); break;
        case 'j': moveBy( 0,  1); break;
        case 'k': moveBy( 0, -1); break;
        case 'l': moveBy( 1,  0); break;
        case 'y': moveBy(-1, -1); break;
        case 'u': moveBy( 1, -1); break;
        case 'b': moveBy(-1,  1); break;
        case 'n': moveBy( 1,  1); break;
        // Line edges
        case '0': {
          const { row } = cursorRowCol();
          moveTo(row, 0);
          break;
        }
        case '$': {
          const { row } = cursorRowCol();
          const lines = sourceEl.value.split('\n');
          moveTo(row, lines[row].length);
          break;
        }
        // Mode entries
        case 'i': setEditorMode('insert'); break;
        case 'a': moveBy(1, 0); setEditorMode('insert'); break;
        case 'o': {
          const { row } = cursorRowCol();
          const lines = sourceEl.value.split('\n');
          lines.splice(row + 1, 0, '');
          sourceEl.value = lines.join('\n');
          sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
          moveTo(row + 1, 0);
          setEditorMode('insert');
          break;
        }
        case 'O': {
          const { row } = cursorRowCol();
          const lines = sourceEl.value.split('\n');
          lines.splice(row, 0, '');
          sourceEl.value = lines.join('\n');
          sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
          moveTo(row, 0);
          setEditorMode('insert');
          break;
        }
        // Delete current cell — replace with space so the column
        // index of everything to the right is preserved.
        case 'x': {
          const { row, col } = cursorRowCol();
          const lines = sourceEl.value.split('\n');
          if (col < lines[row].length) {
            lines[row] = lines[row].slice(0, col) + ' ' + lines[row].slice(col + 1);
            sourceEl.value = lines.join('\n');
            sourceEl.dispatchEvent(new Event('input', { bubbles: true }));
            moveTo(row, col);
          }
          break;
        }
      }
    } else if (e.key === 'ArrowUp')    { e.preventDefault(); moveBy( 0, -1); }
    else if (e.key === 'ArrowDown')    { e.preventDefault(); moveBy( 0,  1); }
    else if (e.key === 'ArrowLeft')    { e.preventDefault(); moveBy(-1,  0); }
    else if (e.key === 'ArrowRight')   { e.preventDefault(); moveBy( 1,  0); }
  } else {
    // INSERT
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditorMode('normal');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Auto-pad vertical navigation in INSERT too — the whole
      // point of this editor is that 2D navigation feels first-class.
      e.preventDefault();
      moveBy(0, e.key === 'ArrowDown' ? 1 : -1);
    }
    // Other keys fall through to native textarea behavior.
  }
});

// Tap / click / Enter on the grid viewport steps the VM. Mobile users
// get a full-screen touch target; desktop users get a second chance at
// stepping without moving the mouse to the toolbar.
gridView.addEventListener('click', () => {
  if (mode === 'debug') doStep();
});
gridView.addEventListener('keydown', (e) => {
  if (mode !== 'debug') return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    doStep();
  }
});

document.addEventListener('keydown', (e) => {
  if (mode !== 'debug') return;
  const target = e.target;
  if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
  // gridView handles its own Enter/Space so focus-on-grid doesn't double-step.
  if (target === gridView) return;
  if (e.key === 'Enter' || e.key === 's') {
    e.preventDefault();
    doStep();
  } else if (e.key === 'c') {
    e.preventDefault();
    doContinue();
  } else if (e.key === 'r') {
    e.preventDefault();
    restartDebug();
  } else if (e.key === 'q' || e.key === 'Escape') {
    e.preventDefault();
    exitDebug();
  }
});

// Pull an initial program out of the URL hash if present; otherwise
// default to the hello.wnd example.
const hashSrc = decodeSourceFromHash(location.hash);
if (hashSrc != null) {
  sourceEl.value = hashSrc;
} else {
  loadExample('hello');
}

// Re-render the grid when the viewport classification changes (desktop
// ↔ mobile, e.g. after an orientation flip) so the number of columns
// stays readable without requiring a manual step.
matchMedia('(max-width: 800px)').addEventListener('change', () => {
  if (mode === 'debug' && session) renderDebug();
});
window.addEventListener('hashchange', () => {
  const src = decodeSourceFromHash(location.hash);
  if (src != null && src !== sourceEl.value && mode !== 'debug') {
    sourceEl.value = src;
  }
});

runBtn.disabled = true;
debugBtn.disabled = true;

(async () => {
  // wasm-bindgen's default loader builds the .wasm URL via
  // `new URL('windy_bg.wasm', import.meta.url)`, which drops the query
  // string of the base — so without an explicit URL the .wasm would
  // ignore our cache-bust. Construct the versioned URL ourselves.
  const wasmUrl = new URL('./pkg/windy_bg.wasm?v=__VERSION__', import.meta.url);
  await init({ module_or_path: wasmUrl });
  wasmReady = true;
  versionBadge.textContent = `windy ${version()}`;
  runBtn.disabled = false;
  debugBtn.disabled = false;
})();
