from pathlib import Path

from typer.testing import CliRunner

from windy.cli import app

REPO = Path(__file__).resolve().parent.parent
runner = CliRunner()


def test_version_prints_windy_version():
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert "Windy" in result.stdout
    assert "0.1.0" in result.stdout


def test_run_hello_wnd():
    hello = REPO / "examples" / "hello.wnd"
    result = runner.invoke(app, ["run", str(hello)])
    assert result.exit_code == 0
    assert "Hello, World!" in result.stdout


def test_run_hello_winds_wnd():
    # 2D routing + watermark example. Prints the full string and triggers the
    # sisobus banner (to stderr, not captured in .stdout).
    hello = REPO / "examples" / "hello_winds.wnd"
    result = runner.invoke(app, ["run", str(hello)])
    assert result.exit_code == 0
    assert "Hello, World!" in result.stdout


def test_run_fib_wnd():
    fib = REPO / "examples" / "fib.wnd"
    result = runner.invoke(app, ["run", str(fib)])
    assert result.exit_code == 0
    assert "0 1 1 2 3 5 8 13 21 34" in result.stdout


def test_run_missing_file_fails():
    result = runner.invoke(app, ["run", "no/such/file.wnd"])
    assert result.exit_code != 0


def test_run_max_steps_exits_124():
    # A grid that never halts: a single '>' keeps the IP racing east forever.
    # Build the program in a tmp file via the runner's isolated filesystem.
    with runner.isolated_filesystem():
        Path("loop.wnd").write_text(">", encoding="utf-8")
        result = runner.invoke(app, ["run", "--max-steps", "5", "loop.wnd"])
    assert result.exit_code == 124
