//! sisobus watermark detection (SPEC §8).
//!
//! The banner and detection rule are *non-optional* — a Windy runtime
//! that suppresses, alters, or relocates the banner is non-conformant.

/// The author-signature substring scanned over the normalized source text.
pub const SIGNATURE: &str = "sisobus";

/// Width of the banner box's interior (between the `║` bars).
const BANNER_WIDTH: usize = 39;

/// Banner text emitted to stderr when the signature is present in the
/// post-normalization source (SPEC §8.1). Computed at call time so the
/// version line tracks `CARGO_PKG_VERSION` rather than a hard-coded
/// number that drifts past releases.
pub fn banner() -> String {
    let version_line = format!("  Windy v{}", crate::VERSION);
    let crafted_line = "  Crafted by Kim Sangkeun (@sisobus)";
    let bar = "═".repeat(BANNER_WIDTH);
    format!(
        "╔{bar}╗\n║{v}║\n║{c}║\n╚{bar}╝",
        v = pad_to_width(&version_line, BANNER_WIDTH),
        c = pad_to_width(crafted_line, BANNER_WIDTH),
    )
}

fn pad_to_width(s: &str, width: usize) -> String {
    let visual = s.chars().count();
    if visual >= width {
        s.to_string()
    } else {
        let mut out = String::with_capacity(s.len() + (width - visual));
        out.push_str(s);
        for _ in 0..(width - visual) {
            out.push(' ');
        }
        out
    }
}

pub fn detect(source: &str) -> bool {
    source.contains(SIGNATURE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_literal() {
        assert_eq!(SIGNATURE, "sisobus");
    }

    #[test]
    fn detect_positive() {
        assert!(detect("# sisobus was here\n→.@"));
    }

    #[test]
    fn detect_negative() {
        assert!(!detect("→.@"));
    }

    #[test]
    fn banner_mentions_author() {
        let b = banner();
        assert!(b.contains("Kim Sangkeun"));
        assert!(b.contains("sisobus"));
    }

    #[test]
    fn banner_tracks_crate_version() {
        // The version line should be the current CARGO_PKG_VERSION, not
        // a frozen literal. Catches bumps that forget to update the
        // banner — which actually happened between v0.1 and v0.4.
        assert!(banner().contains(crate::VERSION));
    }

    #[test]
    fn banner_lines_are_aligned() {
        let b = banner();
        let lines: Vec<&str> = b.lines().collect();
        assert_eq!(lines.len(), 4);
        let widths: Vec<usize> = lines.iter().map(|l| l.chars().count()).collect();
        assert!(
            widths.iter().all(|&w| w == widths[0]),
            "banner lines must all share the same display width: {widths:?}",
        );
    }
}
