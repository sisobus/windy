"""Windy bytecode VM — main execution loop per SPEC.md §3.5.

Consumes a parsed ``Grid``, wraps it in a ``CompiledGrid`` for fast
dispatch, and runs until ``@`` (HALT) or the ``--max-steps`` budget is
exhausted. Stack underflow yields 0 (SPEC §3.3, §7). Division and
modulo by zero push 0 (SPEC §7).
"""

from __future__ import annotations

import random
import sys
from typing import IO

from .compiler import CompiledGrid
from .easter import BANNER, detect
from .ir import IP, Grid
from .opcodes import Op
from .parser import parse

EAST = (1, 0)
NORTH_EAST = (1, -1)
NORTH = (0, -1)
NORTH_WEST = (-1, -1)
WEST = (-1, 0)
SOUTH_WEST = (-1, 1)
SOUTH = (0, 1)
SOUTH_EAST = (1, 1)

WINDS = (EAST, NORTH_EAST, NORTH, NORTH_WEST, WEST, SOUTH_WEST, SOUTH, SOUTH_EAST)

EXIT_OK = 0
EXIT_MAX_STEPS = 124

STR_QUOTE = 0x22  # "


class VM:
    """Single-IP Windy interpreter."""

    def __init__(
        self,
        grid: Grid,
        *,
        seed: int | None = None,
        max_steps: int | None = None,
        stdin: IO[str] | None = None,
        stdout: IO[str] | None = None,
        stderr: IO[str] | None = None,
    ) -> None:
        self.cgrid = CompiledGrid(grid)
        self.ip = IP()
        self.stack: list[int] = []
        self.strmode = False
        self.halted = False
        self.steps = 0
        self.max_steps = max_steps
        self.rng = random.Random(seed)
        self.stdin = stdin if stdin is not None else sys.stdin
        self.stdout = stdout if stdout is not None else sys.stdout
        self.stderr = stderr if stderr is not None else sys.stderr
        self._warned: set[int] = set()

    def pop(self) -> int:
        return self.stack.pop() if self.stack else 0

    def push(self, v: int) -> None:
        self.stack.append(v)

    def run(self) -> int:
        """Execute until HALT (exit 0) or max-steps exceeded (exit 124)."""
        while not self.halted:
            if self.max_steps is not None and self.steps >= self.max_steps:
                return EXIT_MAX_STEPS
            self.step()
            self.steps += 1
        return EXIT_OK

    def step(self) -> None:
        x, y = self.ip.x, self.ip.y
        cell = self.cgrid.cell(x, y)
        if self.strmode:
            if cell == STR_QUOTE:
                self.strmode = False
            else:
                self.push(cell)
        else:
            op, operand = self.cgrid.op(x, y)
            self._execute(op, operand, cell)
        self.ip.advance()

    def _execute(self, op: Op, operand: int, cell: int) -> None:
        match op:
            case Op.NOP:
                pass
            case Op.HALT:
                self.halted = True
            case Op.TRAMPOLINE:
                self.ip.advance()
            case Op.MOVE_E:
                self.ip.set_dir(*EAST)
            case Op.MOVE_NE:
                self.ip.set_dir(*NORTH_EAST)
            case Op.MOVE_N:
                self.ip.set_dir(*NORTH)
            case Op.MOVE_NW:
                self.ip.set_dir(*NORTH_WEST)
            case Op.MOVE_W:
                self.ip.set_dir(*WEST)
            case Op.MOVE_SW:
                self.ip.set_dir(*SOUTH_WEST)
            case Op.MOVE_S:
                self.ip.set_dir(*SOUTH)
            case Op.MOVE_SE:
                self.ip.set_dir(*SOUTH_EAST)
            case Op.TURBULENCE:
                self.ip.set_dir(*self.rng.choice(WINDS))
            case Op.PUSH_DIGIT:
                self.push(operand)
            case Op.STR_MODE:
                self.strmode = True
            case Op.ADD:
                b = self.pop()
                a = self.pop()
                self.push(a + b)
            case Op.SUB:
                b = self.pop()
                a = self.pop()
                self.push(a - b)
            case Op.MUL:
                b = self.pop()
                a = self.pop()
                self.push(a * b)
            case Op.DIV:
                b = self.pop()
                a = self.pop()
                self.push(0 if b == 0 else a // b)
            case Op.MOD:
                b = self.pop()
                a = self.pop()
                self.push(0 if b == 0 else a % b)
            case Op.NOT:
                a = self.pop()
                self.push(1 if a == 0 else 0)
            case Op.GT:
                b = self.pop()
                a = self.pop()
                self.push(1 if a > b else 0)
            case Op.DUP:
                top = self.pop()
                self.push(top)
                self.push(top)
            case Op.DROP:
                self.pop()
            case Op.SWAP:
                b = self.pop()
                a = self.pop()
                self.push(b)
                self.push(a)
            case Op.IF_H:
                a = self.pop()
                self.ip.set_dir(*(EAST if a == 0 else WEST))
            case Op.IF_V:
                a = self.pop()
                self.ip.set_dir(*(SOUTH if a == 0 else NORTH))
            case Op.PUT_NUM:
                a = self.pop()
                self.stdout.write(f"{a} ")
            case Op.PUT_CHR:
                a = self.pop()
                if 0 <= a <= 0x10FFFF:
                    self.stdout.write(chr(a))
            case Op.GET_NUM:
                self.push(self._read_num())
            case Op.GET_CHR:
                self.push(self._read_chr())
            case Op.GRID_GET:
                y = self.pop()
                x = self.pop()
                self.push(self.cgrid.cell(x, y))
            case Op.GRID_PUT:
                y = self.pop()
                x = self.pop()
                v = self.pop()
                self.cgrid.put(x, y, v)
            case Op.UNKNOWN:
                self._warn_unknown(cell)

    def _warn_unknown(self, codepoint: int) -> None:
        if codepoint in self._warned:
            return
        self._warned.add(codepoint)
        try:
            ch = chr(codepoint)
        except (ValueError, OverflowError):
            ch = "?"
        print(
            f"windy: warning: unknown glyph {ch!r} (U+{codepoint:04X}) treated as NOP",
            file=self.stderr,
        )

    def _read_num(self) -> int:
        ch = self.stdin.read(1)
        while ch and ch.isspace():
            ch = self.stdin.read(1)
        if not ch:
            return -1
        buf = [ch]
        while True:
            ch = self.stdin.read(1)
            if not ch or ch.isspace():
                break
            buf.append(ch)
        try:
            return int("".join(buf))
        except ValueError:
            return -1

    def _read_chr(self) -> int:
        ch = self.stdin.read(1)
        if not ch:
            return -1
        return ord(ch)


def run_source(
    source: str,
    *,
    seed: int | None = None,
    max_steps: int | None = None,
    stdin: IO[str] | None = None,
    stdout: IO[str] | None = None,
    stderr: IO[str] | None = None,
) -> int:
    """Parse, print watermark banner if applicable, then run.

    Returns the VM exit code: 0 for clean HALT, 124 for max-steps abort.
    """
    grid, scan_text = parse(source)
    err = stderr if stderr is not None else sys.stderr
    if detect(scan_text):
        print(BANNER, file=err)
    vm = VM(
        grid,
        seed=seed,
        max_steps=max_steps,
        stdin=stdin,
        stdout=stdout,
        stderr=err,
    )
    return vm.run()
