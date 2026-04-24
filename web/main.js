import init, { run, version } from './pkg/windy.js';

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

const $ = (id) => document.getElementById(id);
const sourceEl = $('source');
const stdinEl = $('stdin');
const stdoutEl = $('stdout');
const stderrEl = $('stderr');
const runBtn = $('run');
const exitEl = $('exit-code');
const pickerEl = $('example-picker');
const seedEl = $('seed');
const maxStepsEl = $('max-steps');
const versionBadge = $('version-badge');

let wasmReady = false;

function loadExample(key) {
  sourceEl.value = EXAMPLES[key] ?? '';
}

function parseOptionalInt(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return BigInt(Math.floor(n));
}

async function handleRun() {
  if (!wasmReady) return;
  runBtn.disabled = true;
  stdoutEl.textContent = '';
  stderrEl.textContent = '';
  exitEl.textContent = 'running…';

  // Yield once so the "running…" label paints before the VM blocks the UI.
  await new Promise((r) => setTimeout(r, 0));

  try {
    const result = run(
      sourceEl.value,
      stdinEl.value,
      parseOptionalInt(seedEl.value),
      parseOptionalInt(maxStepsEl.value),
    );
    stdoutEl.textContent = result.stdout;
    stderrEl.textContent = result.stderr;
    exitEl.textContent = `exit ${result.exit}`;
    // wasm-bindgen returns a reference-counted handle; free it so the
    // underlying Rust RunResult isn't kept alive by the JS GC schedule.
    result.free();
  } catch (err) {
    stderrEl.textContent = String(err);
    exitEl.textContent = 'error';
  } finally {
    runBtn.disabled = false;
  }
}

pickerEl.addEventListener('change', (e) => loadExample(e.target.value));
runBtn.addEventListener('click', handleRun);
sourceEl.addEventListener('keydown', (e) => {
  // Ctrl/Cmd+Enter to run.
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRun();
  }
});

loadExample('hello');

(async () => {
  await init();
  wasmReady = true;
  versionBadge.textContent = `windy ${version()}`;
  runBtn.disabled = false;
})();

// Disable until wasm is ready.
runBtn.disabled = true;
