"""Opcode definitions for Windy v0.1.

Grid cells are raw Unicode codepoints at rest; at parse time the compiler
pre-decodes each cell into an ``Op`` value for fast dispatch in the VM.

See SPEC.md §4 for full semantics.
"""

from enum import IntEnum


class Op(IntEnum):
    """All Windy opcodes, pre-decoded from grid characters."""

    # Flow control
    NOP = 0            # space, ·
    HALT = 1           # @
    TRAMPOLINE = 2     # # — skip next cell

    # Wind (direction)
    MOVE_E = 10        # →  (alias: >)
    MOVE_NE = 11       # ↗
    MOVE_N = 12        # ↑  (alias: ^)
    MOVE_NW = 13       # ↖
    MOVE_W = 14        # ←  (alias: <)
    MOVE_SW = 15       # ↙
    MOVE_S = 16        # ↓  (alias: v)
    MOVE_SE = 17       # ↘
    TURBULENCE = 18    # ~ — random 8-direction

    # Literals
    PUSH_DIGIT = 20    # 0..9; digit value carried in the cell itself
    STR_MODE = 21      # " — toggle string mode

    # Arithmetic & logic
    ADD = 30           # +
    SUB = 31           # -
    MUL = 32           # *
    DIV = 33           # / (floor division; div-by-zero → 0)
    MOD = 34           # %
    NOT = 35           # !
    GT = 36            # `  (strictly greater than)

    # Stack
    DUP = 40           # :
    DROP = 41          # $
    SWAP = 42          # \

    # Branching
    IF_H = 50          # _  horizontal if
    IF_V = 51          # |  vertical if

    # I/O
    PUT_NUM = 60       # .
    PUT_CHR = 61       # ,
    GET_NUM = 62       # &
    GET_CHR = 63       # ?

    # Grid memory (self-modification)
    GRID_GET = 70      # g
    GRID_PUT = 71      # p

    # Fallback
    UNKNOWN = 255      # unrecognized glyph (treated as NOP + warning)


#: Primary + ASCII-alias character → opcode mapping.
#: Digits 0–9 are handled specially (PUSH_DIGIT with the digit value as operand).
CHAR_TO_OP: dict[str, Op] = {
    " ": Op.NOP, "·": Op.NOP,
    "@": Op.HALT,
    "#": Op.TRAMPOLINE,

    "→": Op.MOVE_E, ">": Op.MOVE_E,
    "↗": Op.MOVE_NE,
    "↑": Op.MOVE_N, "^": Op.MOVE_N,
    "↖": Op.MOVE_NW,
    "←": Op.MOVE_W, "<": Op.MOVE_W,
    "↙": Op.MOVE_SW,
    "↓": Op.MOVE_S, "v": Op.MOVE_S,
    "↘": Op.MOVE_SE,
    "~": Op.TURBULENCE,

    '"': Op.STR_MODE,

    "+": Op.ADD,
    "-": Op.SUB,
    "*": Op.MUL,
    "/": Op.DIV,
    "%": Op.MOD,
    "!": Op.NOT,
    "`": Op.GT,

    ":": Op.DUP,
    "$": Op.DROP,
    "\\": Op.SWAP,

    "_": Op.IF_H,
    "|": Op.IF_V,

    ".": Op.PUT_NUM,
    ",": Op.PUT_CHR,
    "&": Op.GET_NUM,
    "?": Op.GET_CHR,

    "g": Op.GRID_GET,
    "p": Op.GRID_PUT,
}
