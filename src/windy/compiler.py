"""Pre-decode ``Grid`` cells into ``(Op, operand)`` pairs.

Each Windy cell is a Unicode codepoint at rest. At compile time we walk
every populated cell once and produce an ``(Op, operand)`` pair for fast
dispatch in the VM:

- Digits ``0..9`` decode to ``(Op.PUSH_DIGIT, value)``.
- Recognized glyphs decode to ``(Op.<name>, 0)``.
- Everything else decodes to ``(Op.UNKNOWN, codepoint)`` — the VM emits a
  one-shot warning per unique codepoint and treats the cell as NOP.

``CompiledGrid`` wraps the source ``Grid`` and keeps the decode cache
coherent when ``GRID_PUT`` rewrites a cell at runtime.
"""

from __future__ import annotations

from .ir import SPACE, Grid
from .opcodes import CHAR_TO_OP, Op

DIGIT_0 = ord("0")
DIGIT_9 = ord("9")


def decode_cell(codepoint: int) -> tuple[Op, int]:
    """Decode a single cell codepoint into an ``(Op, operand)`` pair."""
    if DIGIT_0 <= codepoint <= DIGIT_9:
        return (Op.PUSH_DIGIT, codepoint - DIGIT_0)
    if codepoint == SPACE:
        return (Op.NOP, 0)
    try:
        ch = chr(codepoint)
    except (ValueError, OverflowError):
        return (Op.UNKNOWN, codepoint)
    op = CHAR_TO_OP.get(ch)
    if op is None:
        return (Op.UNKNOWN, codepoint)
    return (op, 0)


class CompiledGrid:
    """A ``Grid`` paired with a coherent opcode cache."""

    def __init__(self, grid: Grid) -> None:
        self.grid = grid
        self._cache: dict[tuple[int, int], tuple[Op, int]] = {
            pos: decode_cell(cp) for pos, cp in grid.cells.items()
        }

    def cell(self, x: int, y: int) -> int:
        return self.grid.get(x, y)

    def op(self, x: int, y: int) -> tuple[Op, int]:
        return self._cache.get((x, y), (Op.NOP, 0))

    def put(self, x: int, y: int, value: int) -> None:
        self.grid.put(x, y, value)
        pos = (x, y)
        if value == SPACE:
            self._cache.pop(pos, None)
        else:
            self._cache[pos] = decode_cell(value)
