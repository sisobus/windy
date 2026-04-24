"""Shared conformance harness — Python side.

Reads ``conformance/cases.json`` and drives each case through the Python
VM. The Rust integration test at ``rust/tests/conformance.rs`` reads the
same file and MUST agree on every case.

The contract is byte-exact stdout + exit code. Stderr is checked with
substring matches only (banners and warnings are allowed to vary in
detail across implementations; presence is what counts).
"""

from __future__ import annotations

import json
from io import StringIO
from pathlib import Path

import pytest

from windy.vm import run_source

REPO = Path(__file__).resolve().parent.parent
CASES = json.loads((REPO / "conformance" / "cases.json").read_text(encoding="utf-8"))["cases"]


def _load_source(case: dict) -> str:
    if "source" in case:
        return case["source"]
    path = REPO / case["source_file"]
    return path.read_text(encoding="utf-8")


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_conformance(case: dict) -> None:
    source = _load_source(case)
    stdin = StringIO(case.get("stdin", ""))
    stdout = StringIO()
    stderr = StringIO()
    exit_code = run_source(
        source,
        seed=case.get("seed"),
        max_steps=case.get("max_steps"),
        stdin=stdin,
        stdout=stdout,
        stderr=stderr,
    )
    assert stdout.getvalue() == case["expected_stdout"]
    assert exit_code == case.get("expected_exit", 0)
    for expected_substr in case.get("expected_stderr_contains", []):
        assert expected_substr in stderr.getvalue(), (
            f"stderr missing {expected_substr!r}; got {stderr.getvalue()!r}"
        )
