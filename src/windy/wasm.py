"""WebAssembly backend for Windy (v0.1 stopgap).

v0.1 strategy — *ahead-of-time output baking*:

  1. Parse the source and run it through the Python VM to capture stdout.
  2. Emit a WASI-compatible WAT module whose ``_start`` function writes
     the captured bytes to fd 1 via ``fd_write``.
  3. If ``wat2wasm`` is on ``PATH``, assemble the WAT to a real ``.wasm``;
     otherwise write the ``.wat`` alongside and tell the user.

The emitted ``.wasm`` is a genuine WebAssembly module — run it with any
WASI runtime (``wasmtime``, ``wasmer``, ``wasm3``, Node's experimental
WASI) and it will produce byte-identical output to ``windy run``.

This is explicitly a stopgap: non-deterministic programs (``~`` without a
seed, any stdin-consuming ``&`` / ``?``) cannot be precomputed and are
rejected. A real AOT compiler — a Windy VM fully expressed in WAT — is
tracked for v0.2 under "Reserved for Future Versions" (SPEC.md §10).
"""

from __future__ import annotations

import shutil
import subprocess
from io import StringIO
from pathlib import Path

from .vm import run_source

MAX_COMPILE_STEPS = 10_000_000


class WasmCompileError(RuntimeError):
    """Raised when a Windy source cannot be compiled to WebAssembly."""


def compile_to_wat(
    source: str,
    *,
    seed: int | None = None,
) -> str:
    """Return the WAT text for ``source``. Raises ``WasmCompileError``."""
    stdout = StringIO()
    stderr = StringIO()
    # Feed an empty stdin so any '&' or '?' returns EOF (-1) deterministically —
    # callers that actually need stdin-driven compilation are on the v0.2 plan.
    exit_code = run_source(
        source,
        seed=seed,
        max_steps=MAX_COMPILE_STEPS,
        stdin=StringIO(""),
        stdout=stdout,
        stderr=stderr,
    )
    if exit_code == 124:
        raise WasmCompileError(
            "program did not halt within the compile-time step budget "
            f"({MAX_COMPILE_STEPS}). v0.1 requires a deterministic, terminating "
            "program; see wasm.py docstring."
        )
    if exit_code != 0:
        raise WasmCompileError(f"program exited non-zero ({exit_code}) during precomputation")
    return _emit_wat(stdout.getvalue().encode("utf-8"))


def compile_to_wasm(
    source: str,
    output: Path,
    *,
    seed: int | None = None,
) -> Path:
    """Write a ``.wasm`` (or ``.wat`` fallback) for ``source``. Returns the path written."""
    wat_text = compile_to_wat(source, seed=seed)
    suffix = output.suffix.lower()
    if suffix == ".wat":
        output.write_text(wat_text, encoding="utf-8")
        return output

    wat2wasm = shutil.which("wat2wasm")
    if wat2wasm is None:
        wat_fallback = output.with_suffix(".wat")
        wat_fallback.write_text(wat_text, encoding="utf-8")
        raise WasmCompileError(
            f"wat2wasm not found on PATH; wrote WAT to {wat_fallback} instead. "
            "Install the WABT toolkit (https://github.com/WebAssembly/wabt) or "
            "pass a path ending in .wat to suppress this error."
        )

    wat_tmp = output.with_suffix(".wat")
    wat_tmp.write_text(wat_text, encoding="utf-8")
    result = subprocess.run(
        [wat2wasm, str(wat_tmp), "-o", str(output)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise WasmCompileError(
            f"wat2wasm failed (exit {result.returncode}): {result.stderr.strip()}"
        )
    return output


def _emit_wat(data: bytes) -> str:
    """Build a minimal WASI module whose ``_start`` writes ``data`` to fd 1."""
    length = len(data)
    payload_offset = 16  # iovec lives at 0..8; nwritten at 8..12.
    escaped = _escape(data)
    return f"""(module
  (import "wasi_snapshot_preview1" "fd_write"
    (func $fd_write (param i32 i32 i32 i32) (result i32)))
  (memory (export "memory") 1)
  (data (i32.const {payload_offset}) "{escaped}")
  (func $_start
    ;; iovec: [ptr=payload_offset, len=length] at memory[0..8]
    (i32.store (i32.const 0) (i32.const {payload_offset}))
    (i32.store (i32.const 4) (i32.const {length}))
    (drop
      (call $fd_write
        (i32.const 1)       ;; fd = stdout
        (i32.const 0)       ;; *iovs
        (i32.const 1)       ;; iovs_len
        (i32.const 8))))    ;; *nwritten
  (export "_start" (func $_start))
)
"""


def _escape(data: bytes) -> str:
    """Encode bytes as a WAT string literal."""
    out = []
    for b in data:
        if b == 0x22:  # '"'
            out.append('\\"')
        elif b == 0x5C:  # '\\'
            out.append("\\\\")
        elif 0x20 <= b < 0x7F:
            out.append(chr(b))
        else:
            out.append(f"\\{b:02x}")
    return "".join(out)
