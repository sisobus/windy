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

  blank: '',
};

const VIEWPORT_W = 60;
const VIEWPORT_H = 13;

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
  const ipX = Number(session.ip_x);
  const ipY = Number(session.ip_y);
  const x0 = ipX - Math.floor(VIEWPORT_W / 2);
  const y0 = ipY - Math.floor(VIEWPORT_H / 2);

  const cells = session.grid_slice(x0, y0, VIEWPORT_W, VIEWPORT_H);

  // Collect every live IP's (x, y) so we can highlight multi-IP programs.
  const positions = session.ip_positions();
  const ipCells = new Set();
  for (let i = 0; i < positions.length; i += 4) {
    const x = Number(positions[i]);
    const y = Number(positions[i + 1]);
    ipCells.add(`${x},${y}`);
  }

  const lines = [];
  for (let dy = 0; dy < VIEWPORT_H; dy++) {
    const row = [];
    for (let dx = 0; dx < VIEWPORT_W; dx++) {
      const cp = cells[dy * VIEWPORT_W + dx];
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

function enterDebug() {
  if (!wasmReady) return;
  // Tear down any lingering session so "Debug" always restarts cleanly,
  // including the legitimate-but-easy-to-miss case where mode was left as
  // 'debug' by a previous render error.
  freeSession();
  try {
    session = new Session(
      sourceEl.value,
      stdinEl.value,
      parseOptionalBigInt(seedEl.value),
      parseOptionalBigInt(maxStepsEl.value),
    );
  } catch (err) {
    stderrEl.textContent = String(err);
    exitEl.textContent = 'error';
    return;
  }
  mode = 'debug';
  toolbarIdle.hidden = true;
  toolbarDebug.hidden = false;
  outputRun.hidden = true;
  outputDebug.hidden = false;
  renderDebug();
  stepBtn.focus();
}

function exitDebug() {
  freeSession();
  mode = 'idle';
  toolbarIdle.hidden = false;
  toolbarDebug.hidden = true;
  outputRun.hidden = false;
  outputDebug.hidden = true;
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

// ---------- Wire up ----------

pickerEl.addEventListener('change', (e) => loadExample(e.target.value));
runBtn.addEventListener('click', handleRun);
debugBtn.addEventListener('click', enterDebug);
stepBtn.addEventListener('click', doStep);
continueBtn.addEventListener('click', doContinue);
exitDebugBtn.addEventListener('click', exitDebug);

sourceEl.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
  }
});

document.addEventListener('keydown', (e) => {
  if (mode !== 'debug') return;
  const target = e.target;
  if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
  if (e.key === 'Enter' || e.key === 's') {
    e.preventDefault();
    doStep();
  } else if (e.key === 'c') {
    e.preventDefault();
    doContinue();
  } else if (e.key === 'q' || e.key === 'Escape') {
    e.preventDefault();
    exitDebug();
  }
});

loadExample('hello');

runBtn.disabled = true;
debugBtn.disabled = true;

(async () => {
  await init();
  wasmReady = true;
  versionBadge.textContent = `windy ${version()}`;
  runBtn.disabled = false;
  debugBtn.disabled = false;
})();
