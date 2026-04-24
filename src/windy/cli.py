"""Windy command-line interface.

Exposes ``windy run``, ``windy compile``, ``windy debug``, ``windy version``.

In v0.1, ``run`` is the real interpreter. ``debug`` and ``compile`` are
still stubs — they land in the following milestones (see CLAUDE.md
"다음 단계" items 7 and 8).
"""

from __future__ import annotations

import sys
from pathlib import Path

import typer
from rich.console import Console

from windy import __version__
from windy.debugger import debug_source
from windy.vm import run_source
from windy.wasm import WasmCompileError, compile_to_wasm

app = typer.Typer(
    name="windy",
    help="Windy — a 2D esolang where code flows like wind.",
    no_args_is_help=True,
    add_completion=False,
)

_stdout = Console()
_stderr = Console(stderr=True)


@app.command()
def run(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
    seed: int | None = typer.Option(None, help="Seed for ~ (turbulence) RNG."),
    max_steps: int | None = typer.Option(None, help="Halt after N executed steps."),
) -> None:
    """Run a Windy program on the bytecode VM."""
    source = file.read_text(encoding="utf-8")
    exit_code = run_source(
        source,
        seed=seed,
        max_steps=max_steps,
        stdin=sys.stdin,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    sys.stdout.flush()
    raise typer.Exit(exit_code)


@app.command("compile")
def compile_(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
    output: Path = typer.Option(..., "-o", "--output", help="Output .wasm or .wat path."),
    seed: int | None = typer.Option(None, help="Seed for ~ during precomputation."),
) -> None:
    """Compile a Windy program to WebAssembly.

    v0.1 uses ahead-of-time output baking — see src/windy/wasm.py for scope.
    """
    source = file.read_text(encoding="utf-8")
    try:
        written = compile_to_wasm(source, output, seed=seed)
    except WasmCompileError as exc:
        _stderr.print(f"[red]compile failed:[/] {exc}")
        raise typer.Exit(code=1) from None
    _stderr.print(f"wrote [green]{written}[/]")


@app.command()
def debug(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
) -> None:
    """Step through a Windy program interactively."""
    source = file.read_text(encoding="utf-8")
    exit_code = debug_source(source)
    raise typer.Exit(exit_code)


@app.command()
def version() -> None:
    """Print the Windy version."""
    _stdout.print(f"Windy {__version__}")


if __name__ == "__main__":
    app()
