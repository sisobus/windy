from windy.compiler import CompiledGrid, decode_cell
from windy.ir import Grid
from windy.opcodes import Op


def test_decode_digit_carries_value():
    op, operand = decode_cell(ord("5"))
    assert op is Op.PUSH_DIGIT
    assert operand == 5


def test_decode_digit_zero_and_nine():
    assert decode_cell(ord("0")) == (Op.PUSH_DIGIT, 0)
    assert decode_cell(ord("9")) == (Op.PUSH_DIGIT, 9)


def test_decode_known_glyph():
    assert decode_cell(ord("@")) == (Op.HALT, 0)
    assert decode_cell(ord("→")) == (Op.MOVE_E, 0)


def test_decode_ascii_alias():
    # ASCII aliases decode to the same opcode as the Unicode primary.
    assert decode_cell(ord(">")) == (Op.MOVE_E, 0)
    assert decode_cell(ord("v")) == (Op.MOVE_S, 0)


def test_decode_space_is_nop():
    assert decode_cell(0x20) == (Op.NOP, 0)


def test_decode_unknown_carries_codepoint():
    op, operand = decode_cell(ord("Z"))
    assert op is Op.UNKNOWN
    assert operand == ord("Z")


def test_compiled_grid_caches_on_init():
    grid = Grid({(0, 0): ord("@"), (1, 0): ord("3")})
    cg = CompiledGrid(grid)
    assert cg.op(0, 0) == (Op.HALT, 0)
    assert cg.op(1, 0) == (Op.PUSH_DIGIT, 3)
    # Missing cells decode to NOP.
    assert cg.op(99, 99) == (Op.NOP, 0)


def test_compiled_grid_put_invalidates_cache():
    grid = Grid({(0, 0): ord("@")})
    cg = CompiledGrid(grid)
    assert cg.op(0, 0) == (Op.HALT, 0)
    cg.put(0, 0, ord("+"))
    assert cg.op(0, 0) == (Op.ADD, 0)
    assert cg.cell(0, 0) == ord("+")


def test_compiled_grid_put_space_clears_cache():
    grid = Grid({(0, 0): ord("@")})
    cg = CompiledGrid(grid)
    cg.put(0, 0, 0x20)
    assert cg.op(0, 0) == (Op.NOP, 0)
    assert (0, 0) not in cg.grid.cells
