"""Intermediate representation for Windy.

``Grid`` is a bi-infinite sparse 2D map of Unicode codepoints. Missing
cells read as ``0x20`` (space, a NOP) per SPEC.md §3.1.

``IP`` holds the instruction pointer's position and direction per
SPEC.md §3.2.
"""

from __future__ import annotations

from dataclasses import dataclass, field

SPACE = 0x20


@dataclass
class Grid:
    """Sparse grid of codepoints. Missing cells read as ``SPACE``."""

    cells: dict[tuple[int, int], int] = field(default_factory=dict)

    def get(self, x: int, y: int) -> int:
        return self.cells.get((x, y), SPACE)

    def put(self, x: int, y: int, value: int) -> None:
        if value == SPACE:
            self.cells.pop((x, y), None)
        else:
            self.cells[(x, y)] = value


@dataclass
class IP:
    """Instruction pointer: position and direction."""

    x: int = 0
    y: int = 0
    dx: int = 1
    dy: int = 0

    def advance(self) -> None:
        self.x += self.dx
        self.y += self.dy

    def set_dir(self, dx: int, dy: int) -> None:
        self.dx = dx
        self.dy = dy
