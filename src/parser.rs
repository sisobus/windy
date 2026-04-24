//! Source text → `Grid` parsing per SPEC §5.
//!
//! Pre-processing order:
//!   1. Strip a leading UTF-8 BOM.
//!   2. Normalize line endings (`\r\n` and lone `\r` → `\n`).
//!   3. Strip a shebang line (`#!…\n`) when it begins the file.
//!
//! The returned tuple also yields the normalized source so the caller
//! (e.g. `easter::detect`) can run the watermark scan over the exact
//! text SPEC §5 specifies.

use crate::grid::{Grid, SPACE};
use num_bigint::BigInt;

const BOM: &str = "\u{feff}";

/// BOM-, line-ending-, and shebang-normalized source text.
pub fn normalize(source: &str) -> String {
    let trimmed = source.strip_prefix(BOM).unwrap_or(source);
    let normalized = trimmed.replace("\r\n", "\n").replace('\r', "\n");
    if let Some(rest) = normalized.strip_prefix("#!") {
        match rest.find('\n') {
            Some(nl) => rest[nl + 1..].to_string(),
            None => String::new(),
        }
    } else {
        normalized
    }
}

/// Build a `Grid` from source text; also return the normalized source
/// so the caller can scan it for the sisobus watermark.
pub fn parse(source: &str) -> (Grid, String) {
    let text = normalize(source);
    let mut lines: Vec<&str> = text.split('\n').collect();
    // SPEC §5: trailing newlines do not create empty rows.
    if matches!(lines.last(), Some(&"")) {
        lines.pop();
    }
    let mut grid = Grid::new();
    for (y, line) in lines.iter().enumerate() {
        for (x, ch) in line.chars().enumerate() {
            let cp = ch as u32;
            if cp == SPACE {
                continue;
            }
            grid.cells
                .insert((x as i64, y as i64), BigInt::from(cp));
        }
    }
    (grid, text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_strips_bom() {
        assert_eq!(normalize("\u{feff}→.@"), "→.@");
    }

    #[test]
    fn normalize_crlf_to_lf() {
        assert_eq!(normalize("a\r\nb\rc"), "a\nb\nc");
    }

    #[test]
    fn normalize_strips_shebang() {
        assert_eq!(normalize("#!/usr/bin/env windy\n→.@\n"), "→.@\n");
    }

    #[test]
    fn normalize_shebang_without_newline_clears_all() {
        assert_eq!(normalize("#!/usr/bin/env windy"), "");
    }

    #[test]
    fn normalize_preserves_non_shebang_hash() {
        assert_eq!(normalize("#→.@"), "#→.@");
    }

    #[test]
    fn parse_basic_layout() {
        let (g, _) = parse("→@\nABC");
        assert_eq!(g.get(0, 0), BigInt::from('→' as u32));
        assert_eq!(g.get(1, 0), BigInt::from('@' as u32));
        assert_eq!(g.get(0, 1), BigInt::from('A' as u32));
        assert_eq!(g.get(2, 1), BigInt::from('C' as u32));
    }

    #[test]
    fn parse_missing_cell_defaults_to_space() {
        let (g, _) = parse("→@");
        assert_eq!(g.get(50, 50), BigInt::from(SPACE));
    }

    #[test]
    fn parse_stores_nothing_for_space() {
        let (g, _) = parse("→ @");
        assert!(!g.cells.contains_key(&(1, 0)));
        assert_eq!(g.get(1, 0), BigInt::from(SPACE));
    }

    #[test]
    fn parse_codepoint_index_not_byte_offset() {
        // Multi-byte `→` must count as one column, not three.
        let (g, _) = parse("→@");
        assert_eq!(g.get(1, 0), BigInt::from('@' as u32));
    }

    #[test]
    fn parse_trailing_newline_no_empty_row() {
        let (g, _) = parse("→@\n");
        assert!(g.cells.keys().all(|&(_, y)| y == 0));
    }

    #[test]
    fn parse_returns_normalized_for_watermark_scan() {
        let (_, scan) = parse("\u{feff}#!/bin/windy\nsisobus\n→@");
        assert!(scan.starts_with("sisobus"));
        assert!(!scan.contains('\u{feff}'));
    }
}
