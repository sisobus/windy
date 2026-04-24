from io import StringIO

from windy.vm import EXIT_MAX_STEPS, EXIT_OK, run_source


def _run(source: str, stdin: str = "") -> tuple[int, str, str]:
    out, err, inp = StringIO(), StringIO(), StringIO(stdin)
    code = run_source(source, stdin=inp, stdout=out, stderr=err)
    return code, out.getvalue(), err.getvalue()


def test_halt_returns_zero():
    code, out, _ = _run("@")
    assert code == EXIT_OK
    assert out == ""


def test_hello_world():
    code, out, _ = _run('"!dlroW ,olleH",,,,,,,,,,,,,@')
    assert code == EXIT_OK
    assert out == "Hello, World!"


def test_digit_push_and_put_num_includes_trailing_space():
    # PUT_NUM emits the decimal repr followed by a single space (SPEC §4).
    _, out, _ = _run("34+.@")
    assert out == "7 "


def test_sub_argument_order():
    # SPEC §4.1: "3 4 -" pops b=4, a=3, pushes a - b = -1.
    _, out, _ = _run("34-.@")
    assert out == "-1 "


def test_div_by_zero_pushes_zero():
    _, out, _ = _run("50/.@")
    assert out == "0 "


def test_mod_by_zero_pushes_zero():
    _, out, _ = _run("50%.@")
    assert out == "0 "


def test_stack_underflow_yields_zero():
    _, out, _ = _run(".@")
    assert out == "0 "


def test_not_of_zero_is_one():
    _, out, _ = _run("0!.@")
    assert out == "1 "


def test_not_of_nonzero_is_zero():
    _, out, _ = _run("5!.@")
    assert out == "0 "


def test_gt_true_pushes_one():
    _, out, _ = _run("53`.@")
    assert out == "1 "


def test_gt_false_pushes_zero():
    _, out, _ = _run("35`.@")
    assert out == "0 "


def test_dup_duplicates_top():
    # Push 7, DUP, print twice.
    _, out, _ = _run("7:..@")
    assert out == "7 7 "


def test_swap_reverses_top_two():
    # Push 1 2, SWAP, print → 1 then 2.
    _, out, _ = _run("12\\..@")
    assert out == "1 2 "


def test_drop_discards_top():
    _, out, _ = _run("12$.@")
    assert out == "1 "


def test_trampoline_skips_next_cell():
    # '#' skips '@' (the cell immediately east), IP reaches '5', prints, halts.
    _, out, _ = _run("#@5.@")
    assert out == "5 "


def test_string_mode_pushes_codepoints():
    _, out, _ = _run('"A",@')
    assert out == "A"


def test_string_mode_suppresses_opcodes():
    # '+' inside string mode is codepoint 43, not ADD.
    _, out, _ = _run('"+".@')
    assert out == "43 "


def test_if_h_zero_goes_east_nonzero_goes_west():
    # Stack 0 → IF_H east → next cell '.' prints 0 (underflow), then @ halts.
    _, out, _ = _run("0_.@")
    assert out == "0 "


def test_if_v_routes_vertically():
    # Row 0: "1v  "  — push 1, go south
    # Row 1: " |  " — IF_V with 1 (nonzero) → north
    # Row 2: "  @ " — unreachable because we head back north
    # Actually IF_V with 1 on stack goes north, straight back into 'v' which
    # redirects south again → infinite ping-pong. Use cap to prove routing.
    # Cleaner: flip polarity. Push 0 so IF_V goes south.
    # Row 0: "0v"
    # Row 1: " |"
    # Row 2: " @"
    src = "0v\n |\n @"
    code, out, _ = _run(src)
    assert code == EXIT_OK
    assert out == ""


def test_put_chr_emits_unicode():
    _, out, _ = _run('"가",@')
    assert out == "가"


def test_grid_get_reads_existing_cell():
    # Push x=4, y=0, GRID_GET → pushes codepoint at (4, 0) = '@'.
    _, out, _ = _run("40g,@")
    assert out == "@"


def test_grid_put_then_grid_get_roundtrip():
    # Use string mode to push v=33 ('!'), write at (5, 5), read back, print.
    _, out, _ = _run('"!"55p55g,@')
    assert out == "!"


def test_grid_put_self_modifies_for_halt():
    # Overwrite the cell immediately east of 'p' with '@' so the IP halts
    # deterministically — proves the VM re-decodes cells after GRID_PUT.
    # Stack setup: v=64 ('@'), x=7, y=0. After 'p', cell (7,0) is '@'.
    # '88*' pushes 64. '70' pushes 7, 0. Then 'p'. Cells (6,0)=' ' (NOP),
    # (7,0) will be '@' after the write.
    #  col: 0 1 2 3 4 5 6 7
    #        8 8 * 7 0 p   X
    code, out, err = _run("88*70p X")
    # The 'X' (col 7) was overwritten to '@' — program halts cleanly.
    assert code == EXIT_OK
    assert out == ""
    # No unknown-glyph warning, because 'X' was never decoded (it was rewritten
    # before the IP reached it).
    assert "unknown glyph" not in err


def test_max_steps_returns_124():
    # IP walks east forever over implicit spaces; max_steps caps the run.
    out, err = StringIO(), StringIO()
    code = run_source("    ", max_steps=3, stdout=out, stderr=err)
    assert code == EXIT_MAX_STEPS


def test_unknown_glyph_warned_once():
    # Two identical unknown glyphs → one warning, not two.
    _, _, err = _run("ZZ@")
    assert err.count("unknown glyph") == 1


def test_unknown_glyph_warn_distinct_chars():
    _, _, err = _run("ZY@")
    assert err.count("unknown glyph") == 2


def test_sisobus_banner_on_stderr_when_watermark_present():
    _, out, err = _run('"sisobus"@')
    assert "Kim Sangkeun" in err
    assert "Kim Sangkeun" not in out


def test_no_banner_without_watermark():
    _, _, err = _run("@")
    assert "Kim Sangkeun" not in err


def test_turbulence_deterministic_with_seed():
    # Same seed + same source = same output. The source routes '~' into a
    # print path that depends on which direction the RNG picked; we just need
    # two identical runs to agree.
    src = "~.@\n.@\n.@"
    a_out = StringIO()
    b_out = StringIO()
    run_source(src, seed=42, stdout=a_out, stderr=StringIO(), max_steps=50)
    run_source(src, seed=42, stdout=b_out, stderr=StringIO(), max_steps=50)
    assert a_out.getvalue() == b_out.getvalue()
