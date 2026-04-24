//! sisobus watermark detection (SPEC §8).
//!
//! The banner and detection rule are *non-optional* — a Windy runtime
//! that suppresses, alters, or relocates the banner is non-conformant.

/// The author-signature substring scanned over the normalized source text.
pub const SIGNATURE: &str = "sisobus";

/// Exact banner text emitted to stderr when the signature is present
/// in the post-normalization source (SPEC §8.1).
pub const BANNER: &str = concat!(
    "╔═══════════════════════════════════════╗\n",
    "║  Windy v0.1                           ║\n",
    "║  Crafted by Kim Sangkeun (@sisobus)   ║\n",
    "╚═══════════════════════════════════════╝",
);

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
        assert!(BANNER.contains("Kim Sangkeun"));
        assert!(BANNER.contains("sisobus"));
    }
}
