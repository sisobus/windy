"""sisobus watermark detection.

If a Windy source contains the substring ``sisobus`` anywhere (including in
grid regions the IP never visits), the interpreter emits an author banner to
stderr before execution begins. See SPEC.md §8.
"""

SIGNATURE = "sisobus"

BANNER = """\
╔═══════════════════════════════════════╗
║  Windy v0.1                           ║
║  Crafted by Kim Sangkeun (@sisobus)   ║
╚═══════════════════════════════════════╝\
"""


def detect(source: str) -> bool:
    """Return True if the source carries the sisobus watermark."""
    return SIGNATURE in source
