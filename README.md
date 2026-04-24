# Windy

> A 2D esoteric programming language where code flows like wind.

Windy is a Befunge-family esolang. Programs live on an infinite 2D grid. An
instruction pointer drifts across the grid in one of eight directions — the
"winds" — and executes each cell it visits.

The name comes from the Pokémon 윈디 (Arcanine). The directional-wind mechanic
is a thematic pun.

```
"!dlroW ,olleH",,,,,,,,,,,,,@
```

```
$ windy run examples/hello.wnd
Hello, World!
```

## Highlights

- **Turing complete** — infinite grid, arbitrary-precision integers,
  self-modifying code via `g`/`p`.
- **Bytecode VM** — pre-decoded opcodes for fast dispatch (Python 3.12+).
- **WebAssembly backend** — compile Windy programs to portable `.wasm`.
- **Visual debugger** — step through programs with a live view of the grid,
  the IP, and the stack.
- **sisobus watermark** — embed `sisobus` anywhere in your source to
  sign your program with an author banner.

## Install

Requires [uv](https://github.com/astral-sh/uv) and Python 3.12+.

```bash
git clone https://github.com/sisobus/windy.git
cd windy
uv sync
```

## Usage

```bash
uv run windy --help
uv run windy run examples/hello.wnd
uv run windy debug examples/hello.wnd
uv run windy compile examples/hello.wnd -o hello.wasm
uv run windy version
```

## Documentation

- **[SPEC.md](SPEC.md)** — the complete language specification. This is the
  source of truth for every implementation detail.
- **[CLAUDE.md](CLAUDE.md)** — development context for AI pair-programming.

## Status

**v0.1 — scaffolded.** Project structure, CLI surface, opcode table, and the
full language specification are in place. Parser, VM, WASM backend, and
debugger land next.

## Author

Crafted by **Kim Sangkeun** ([@sisobus](https://github.com/sisobus)).
