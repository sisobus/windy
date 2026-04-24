"""Interactive step debugger for Windy.

Renders a viewport of the grid (with the IP highlighted), the stack, the
run-time state, and captured program output, pausing for command input
between steps.

Commands:

  Enter / s / step    advance one step
  c / cont / run      run until HALT or the built-in safety cap
  q / quit            exit the debugger

``debug_source`` is the library entry point. It accepts an ``input_fn``
hook so tests can drive it without a tty.
"""

from __future__ import annotations

import sys
from collections.abc import Callable
from io import StringIO
from typing import IO

from rich.console import Console, Group
from rich.panel import Panel
from rich.text import Text

from .compiler import CompiledGrid
from .easter import BANNER, detect
from .ir import IP
from .opcodes import Op
from .parser import parse
from .vm import VM

VIEWPORT_COLS = 60
VIEWPORT_ROWS = 13
RUN_SAFETY_CAP = 10_000_000

DIR_NAMES: dict[tuple[int, int], str] = {
    (1, 0): "→ east",
    (1, -1): "↗ ne",
    (0, -1): "↑ north",
    (-1, -1): "↖ nw",
    (-1, 0): "← west",
    (-1, 1): "↙ sw",
    (0, 1): "↓ south",
    (1, 1): "↘ se",
}


def _render_grid(cgrid: CompiledGrid, ip: IP) -> Text:
    """Viewport of the grid centered on the IP, with the IP cell highlighted."""
    x0 = ip.x - VIEWPORT_COLS // 2
    y0 = ip.y - VIEWPORT_ROWS // 2
    text = Text()
    for y in range(y0, y0 + VIEWPORT_ROWS):
        for x in range(x0, x0 + VIEWPORT_COLS):
            cp = cgrid.cell(x, y)
            try:
                ch = chr(cp)
            except (ValueError, OverflowError):
                ch = "?"
            if ch in ("\n", "\r", "\t") or not ch.isprintable():
                ch = " "
            if x == ip.x and y == ip.y:
                text.append(ch, style="bold reverse magenta")
            else:
                text.append(ch)
        text.append("\n")
    return text


def _render_stack(stack: list[int]) -> Text:
    if not stack:
        return Text("(empty)", style="dim")
    text = Text()
    for v in reversed(stack[-20:]):
        text.append(f"{v}\n")
    if len(stack) > 20:
        text.append(f"... (+{len(stack) - 20} below)\n", style="dim")
    return text


def _render_status(vm: VM) -> Text:
    text = Text()
    text.append(f"step:   {vm.steps}\n")
    text.append(f"ip:     ({vm.ip.x}, {vm.ip.y})\n")
    text.append(f"dir:    {DIR_NAMES.get((vm.ip.dx, vm.ip.dy), '?')}\n")
    text.append(f"strmod: {'on' if vm.strmode else 'off'}\n")
    text.append(f"halted: {'yes' if vm.halted else 'no'}\n")
    cp = vm.cgrid.cell(vm.ip.x, vm.ip.y)
    try:
        ch = chr(cp)
    except (ValueError, OverflowError):
        ch = "?"
    op, operand = vm.cgrid.op(vm.ip.x, vm.ip.y)
    text.append(f"cell:   {ch!r} (U+{cp:04X})\n")
    text.append(f"op:     {op.name}")
    if op is Op.PUSH_DIGIT:
        text.append(f"  (value={operand})")
    return text


def _render_frame(console: Console, vm: VM, output: str) -> None:
    grid_panel = Panel(_render_grid(vm.cgrid, vm.ip), title="grid", border_style="blue")
    status_panel = Panel(_render_status(vm), title="state", border_style="yellow")
    stack_panel = Panel(_render_stack(vm.stack), title="stack", border_style="cyan")
    out_panel = Panel(Text(output or "(no output)"), title="stdout", border_style="green")
    console.print(grid_panel)
    console.print(Group(status_panel, stack_panel))
    console.print(out_panel)


def debug_source(
    source: str,
    *,
    stdin: IO[str] | None = None,
    console: Console | None = None,
    input_fn: Callable[[], str] | None = None,
) -> int:
    """Step-debug a Windy program. Returns the final VM exit code.

    ``input_fn`` lets callers (and tests) feed commands without a tty.
    """
    grid, scan_text = parse(source)
    console = console or Console()
    if detect(scan_text):
        print(BANNER, file=sys.stderr)

    output_buf = StringIO()
    vm = VM(
        grid,
        stdin=stdin if stdin is not None else sys.stdin,
        stdout=output_buf,
        stderr=sys.stderr,
    )

    prompt = input_fn or (lambda: console.input("[bold]> [/]"))
    console.print(
        Text(
            "windy debugger — [Enter]/s: step,  c: run-to-halt,  q: quit",
            style="dim",
        )
    )

    while True:
        _render_frame(console, vm, output_buf.getvalue())
        if vm.halted:
            console.print(Text("program halted", style="bold green"))
            return 0
        try:
            cmd = prompt().strip().lower()
        except (EOFError, KeyboardInterrupt):
            return 0

        if cmd in ("", "s", "step"):
            vm.step()
            vm.steps += 1
        elif cmd in ("c", "cont", "continue", "r", "run"):
            remaining = RUN_SAFETY_CAP
            while not vm.halted and remaining > 0:
                vm.step()
                vm.steps += 1
                remaining -= 1
            _render_frame(console, vm, output_buf.getvalue())
            if not vm.halted:
                console.print(Text("run budget exhausted", style="bold red"))
                return 124
            console.print(Text("program halted", style="bold green"))
            return 0
        elif cmd in ("q", "quit", "exit"):
            return 0
        else:
            console.print(Text(f"unknown command: {cmd!r}", style="red"))
