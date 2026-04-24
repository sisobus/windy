from windy.opcodes import CHAR_TO_OP, Op


def test_halt_mapped():
    assert CHAR_TO_OP["@"] is Op.HALT


def test_unicode_arrow_primary():
    assert CHAR_TO_OP["→"] is Op.MOVE_E
    assert CHAR_TO_OP["↘"] is Op.MOVE_SE


def test_ascii_alias_equivalent_to_unicode():
    assert CHAR_TO_OP[">"] is CHAR_TO_OP["→"]
    assert CHAR_TO_OP["<"] is CHAR_TO_OP["←"]
    assert CHAR_TO_OP["^"] is CHAR_TO_OP["↑"]
    assert CHAR_TO_OP["v"] is CHAR_TO_OP["↓"]


def test_digits_not_in_table():
    # Digits are handled specially as PUSH_DIGIT with the digit value.
    for d in "0123456789":
        assert d not in CHAR_TO_OP


def test_grid_memory_ops_present():
    assert CHAR_TO_OP["g"] is Op.GRID_GET
    assert CHAR_TO_OP["p"] is Op.GRID_PUT
