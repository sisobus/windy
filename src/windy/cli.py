"""Windy command-line interface.

Exposes ``windy run``, ``windy compile``, ``windy debug``, ``windy version``.
All subcommands except ``version`` are stubs in v0.1-scaffold; implementations
land in a follow-up session.
"""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console

from windy import __version__

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
    _stderr.print("[yellow]run: not yet implemented[/] — see SPEC.md for v0.1 design.")
    raise typer.Exit(code=2)


@app.command("compile")
def compile_(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
    output: Path = typer.Option(..., "-o", "--output", help="Output .wasm path."),
) -> None:
    """Compile a Windy program to WebAssembly."""
    _stderr.print("[yellow]compile: not yet implemented[/]")
    raise typer.Exit(code=2)


@app.command()
def debug(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, readable=True),
) -> None:
    """Step through a Windy program interactively."""
    _stderr.print("[yellow]debug: not yet implemented[/]")
    raise typer.Exit(code=2)


@app.command()
def version() -> None:
    """Print the Windy version."""
    _stdout.print(f"Windy {__version__}")


if __name__ == "__main__":
    app()
