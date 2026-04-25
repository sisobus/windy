import init, { run, version, Session } from './pkg/windy.js';

// Inline the canonical examples so the playground is self-contained and
// works over `file://` too (no fetch fallbacks needed).
const EXAMPLES = {
  hello: `"!dlroW ,olleH",,,,,,,,,,,,,@\n`,

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
const shareBtn = $('btn-share');

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
    exitEl.textContent = `exit ${result.exit}`;
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
    ['halted', session.halted ? 'yes' : 'no'],
    ['cell', `${JSON.stringify(displayCh)} (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`],
    ['op', session.current_op()],
  ];
  stateView.innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escHtml(v)}</dd>`)
    .join('');
}

function renderStack() {
  const values = session.stack();
  stackLenEl.textContent = `(${values.length})`;
  if (values.length === 0) {
    stackView.innerHTML = '<span class="empty">(empty)</span>';
    return;
  }
  // Top of the stack first.
  const shown = values.slice(-40).reverse();
  const hidden = values.length - shown.length;
  const lines = shown.map((v) => escHtml(v));
  if (hidden > 0) lines.push(`… (+${hidden} below)`);
  stackView.textContent = lines.join('\n');
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

async function copyPermalink() {
  const src = sourceEl.value;
  const url = src
    ? `${location.origin}${location.pathname}${PERMALINK_PREFIX}${encodeSourceForHash(src)}`
    : `${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(url);
    const old = shareBtn.textContent;
    shareBtn.textContent = 'Copied';
    setTimeout(() => { shareBtn.textContent = old; }, 1200);
  } catch (_) {
    // Older browsers / insecure contexts: prompt with the URL.
    prompt('Permalink', url);
  }
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
shareBtn.addEventListener('click', copyPermalink);

sourceEl.addEventListener('input', scheduleHashWrite);

sourceEl.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
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
  await init();
  wasmReady = true;
  versionBadge.textContent = `windy ${version()}`;
  runBtn.disabled = false;
  debugBtn.disabled = false;
})();
