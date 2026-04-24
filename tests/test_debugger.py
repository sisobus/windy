from io import StringIO

from rich.console import Console

from windy.debugger import debug_source


def _console() -> Console:
    # Force a width so the viewport renders deterministically in tests.
    return Console(file=StringIO(), force_terminal=False, width=80, no_color=True)


def test_quit_returns_zero():
    code = debug_source("@", console=_console(), input_fn=iter(["q"]).__next__)
    assert code == 0


def test_step_then_quit():
    # Source: '5.@' — step once (5 pushed), quit before printing.
    code = debug_source(
        "5.@",
        console=_console(),
        input_fn=iter(["s", "q"]).__next__,
    )
    assert code == 0


def test_continue_runs_to_halt():
    # Enter "c" to run-to-halt; hello prints then program halts, returning 0.
    code = debug_source(
        '"A",@',
        console=_console(),
        input_fn=iter(["c"]).__next__,
    )
    assert code == 0


def test_halt_detected_after_single_step():
    # Before any input the IP just sits on '@'; one step executes HALT and
    # the debugger returns on the next iteration without asking again.
    code = debug_source("@", console=_console(), input_fn=iter(["s"]).__next__)
    assert code == 0


def test_unknown_command_is_surfaced_not_fatal():
    # Follow an unknown command with 'c' to exit cleanly.
    code = debug_source(
        "5.@",
        console=_console(),
        input_fn=iter(["nope", "c"]).__next__,
    )
    assert code == 0


def test_run_budget_caps_at_124():
    # Infinite NOP walk east; continue command should hit safety cap. We
    # shrink the cap via monkey-patching for the test.
    from windy import debugger

    original = debugger.RUN_SAFETY_CAP
    debugger.RUN_SAFETY_CAP = 10
    try:
        code = debug_source(
            ">",
            console=_console(),
            input_fn=iter(["c"]).__next__,
        )
        assert code == 124
    finally:
        debugger.RUN_SAFETY_CAP = original
