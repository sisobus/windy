from windy.parser import normalize, parse


def test_normalize_strips_bom():
    assert normalize("﻿→.@") == "→.@"


def test_normalize_crlf_to_lf():
    assert normalize("a\r\nb\rc") == "a\nb\nc"


def test_normalize_strips_shebang():
    # Shebang consumes up to and including the first newline.
    assert normalize("#!/usr/bin/env windy\n→.@\n") == "→.@\n"


def test_normalize_shebang_without_newline():
    # A shebang that is the whole file erases everything.
    assert normalize("#!/usr/bin/env windy") == ""


def test_normalize_preserves_non_shebang_hash():
    # A '#' that is not followed by '!' is the TRAMPOLINE opcode, not a shebang.
    assert normalize("#→.@") == "#→.@"


def test_parse_basic_grid_layout():
    grid, _ = parse("→@\nABC")
    # Spaces are sparse — arrow and @ on row 0, three letters on row 1.
    assert grid.get(0, 0) == ord("→")
    assert grid.get(1, 0) == ord("@")
    assert grid.get(0, 1) == ord("A")
    assert grid.get(2, 1) == ord("C")


def test_parse_missing_cell_is_space():
    grid, _ = parse("→@")
    assert grid.get(50, 50) == 0x20


def test_parse_stores_nothing_for_space():
    grid, _ = parse("→ @")
    # Space is sparse — not in the dict, but reads back as 0x20.
    assert (1, 0) not in grid.cells
    assert grid.get(1, 0) == 0x20


def test_parse_codepoint_index_not_byte_offset():
    # The multi-byte arrow is one column, not three.
    grid, _ = parse("→@")
    assert grid.get(0, 0) == ord("→")
    assert grid.get(1, 0) == ord("@")


def test_parse_returns_normalized_for_watermark():
    _, scan = parse("﻿#!/bin/windy\nsisobus\n→@")
    # BOM and shebang must be stripped so the scan text is clean.
    assert scan.startswith("sisobus")
    assert "﻿" not in scan


def test_parse_trailing_newline_no_empty_row():
    grid, _ = parse("→@\n")
    # Row 1 must not exist as a populated empty line.
    assert all(y == 0 for (_, y) in grid.cells)
