"""Source text → ``Grid`` parsing per SPEC.md §5.

Applies three pre-processing steps before gridification:

1. Strip a leading UTF-8 BOM (``U+FEFF``) if present.
2. Normalize line endings: ``\\r\\n`` and lone ``\\r`` become ``\\n``.
3. Strip a shebang line (``#!...\\n``) when it begins the file.

The resulting text is then split on ``\\n`` and each non-space codepoint
is stored sparsely at ``(x, y)``. ``x`` is the codepoint index into the
line (not byte offset); ``y`` is the line index from 0.

The watermark scanner (``easter.detect``) runs over the same normalized
text — see SPEC.md §5 last paragraph and §8.
"""

from __future__ import annotations

from .ir import SPACE, Grid

BOM = "\ufeff"


def normalize(source: str) -> str:
    """Return source after BOM, line-ending, and shebang normalization.

    This is the text the sisobus watermark scan runs against.
    """
    if source.startswith(BOM):
        source = source[1:]
    source = source.replace("\r\n", "\n").replace("\r", "\n")
    if source.startswith("#!"):
        nl = source.find("\n")
        source = "" if nl == -1 else source[nl + 1 :]
    return source


def parse(source: str) -> tuple[Grid, str]:
    """Parse source text into a ``Grid`` and the normalized source.

    The normalized source is returned so callers can run the watermark
    scan against the exact text SPEC §5 specifies.
    """
    text = normalize(source)
    lines = text.split("\n")
    # Trailing newlines do not create empty rows (SPEC §5).
    if lines and lines[-1] == "":
        lines = lines[:-1]
    cells: dict[tuple[int, int], int] = {}
    for y, line in enumerate(lines):
        for x, ch in enumerate(line):
            cp = ord(ch)
            if cp == SPACE:
                continue
            cells[(x, y)] = cp
    return Grid(cells=cells), text
