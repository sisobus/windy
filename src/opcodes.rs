//! Opcode enum and cell → opcode decoding (SPEC §4).

use num_bigint::BigInt;
use num_traits::ToPrimitive;

/// All Windy opcodes plus the internal `Unknown` fallback. 35 opcodes
/// total: 33 flow / wind / arithmetic / stack / branch / I/O / grid
/// ops plus GUST and CALM, which drive the wind-speed mechanic
/// (SPEC §3.7).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    // Flow
    Nop,
    Halt,
    Trampoline,
    Split,
    // Winds
    MoveE, MoveNe, MoveN, MoveNw, MoveW, MoveSw, MoveS, MoveSe,
    Turbulence,
    // Literals
    PushDigit,
    StrMode,
    // Arithmetic
    Add, Sub, Mul, Div, Mod, Not, Gt,
    // Stack
    Dup, Drop, Swap,
    // Branch
    IfH, IfV,
    // I/O
    PutNum, PutChr, GetNum, GetChr,
    // Grid memory
    GridGet, GridPut,
    // v1.0: wind speed (SPEC §3.7)
    Gust,
    Calm,
    // Fallback for glyphs outside the op table
    Unknown,
}

impl Op {
    pub fn name(&self) -> &'static str {
        match self {
            Op::Nop => "NOP",
            Op::Halt => "HALT",
            Op::Trampoline => "TRAMPOLINE",
            Op::Split => "SPLIT",
            Op::MoveE => "MOVE_E",
            Op::MoveNe => "MOVE_NE",
            Op::MoveN => "MOVE_N",
            Op::MoveNw => "MOVE_NW",
            Op::MoveW => "MOVE_W",
            Op::MoveSw => "MOVE_SW",
            Op::MoveS => "MOVE_S",
            Op::MoveSe => "MOVE_SE",
            Op::Turbulence => "TURBULENCE",
            Op::PushDigit => "PUSH_DIGIT",
            Op::StrMode => "STR_MODE",
            Op::Add => "ADD",
            Op::Sub => "SUB",
            Op::Mul => "MUL",
            Op::Div => "DIV",
            Op::Mod => "MOD",
            Op::Not => "NOT",
            Op::Gt => "GT",
            Op::Dup => "DUP",
            Op::Drop => "DROP",
            Op::Swap => "SWAP",
            Op::IfH => "IF_H",
            Op::IfV => "IF_V",
            Op::PutNum => "PUT_NUM",
            Op::PutChr => "PUT_CHR",
            Op::GetNum => "GET_NUM",
            Op::GetChr => "GET_CHR",
            Op::GridGet => "GRID_GET",
            Op::GridPut => "GRID_PUT",
            Op::Gust => "GUST",
            Op::Calm => "CALM",
            Op::Unknown => "UNKNOWN",
        }
    }
}

/// Map a primary glyph (or ASCII alias) to its opcode.
/// Digits are *not* in this table — the VM detects them as a range in
/// [`decode_cell`] and carries the digit value as the operand.
fn char_to_op(c: char) -> Option<Op> {
    Some(match c {
        ' ' | '·' => Op::Nop,
        '@' => Op::Halt,
        '#' => Op::Trampoline,
        't' => Op::Split,
        '→' | '>' => Op::MoveE,
        '↗' => Op::MoveNe,
        '↑' | '^' => Op::MoveN,
        '↖' => Op::MoveNw,
        '←' | '<' => Op::MoveW,
        '↙' => Op::MoveSw,
        '↓' | 'v' => Op::MoveS,
        '↘' => Op::MoveSe,
        '~' => Op::Turbulence,
        '"' => Op::StrMode,
        '+' => Op::Add,
        '-' => Op::Sub,
        '*' => Op::Mul,
        '/' => Op::Div,
        '%' => Op::Mod,
        '!' => Op::Not,
        '`' => Op::Gt,
        ':' => Op::Dup,
        '$' => Op::Drop,
        '\\' => Op::Swap,
        '_' => Op::IfH,
        '|' => Op::IfV,
        '.' => Op::PutNum,
        ',' => Op::PutChr,
        '&' => Op::GetNum,
        '?' => Op::GetChr,
        'g' => Op::GridGet,
        'p' => Op::GridPut,
        '≫' => Op::Gust,
        '≪' => Op::Calm,
        _ => return None,
    })
}

/// Decode a cell's integer value into `(Op, operand)`.
///
/// The operand is the digit value `0..=9` for `PushDigit` and `0` for every
/// other opcode. Out-of-range or invalid codepoints decode to `Unknown`.
pub fn decode_cell(cell: &BigInt) -> (Op, u32) {
    let cp = match cell.to_u32() {
        Some(v) if v <= 0x10FFFF => v,
        _ => return (Op::Unknown, 0),
    };
    if (0x30..=0x39).contains(&cp) {
        return (Op::PushDigit, cp - 0x30);
    }
    if cp == 0x20 {
        return (Op::Nop, 0);
    }
    let ch = match char::from_u32(cp) {
        Some(c) => c,
        None => return (Op::Unknown, 0),
    };
    match char_to_op(ch) {
        Some(op) => (op, 0),
        None => (Op::Unknown, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bi(n: u32) -> BigInt {
        BigInt::from(n)
    }

    #[test]
    fn decode_digit_carries_value() {
        assert_eq!(decode_cell(&bi(b'5' as u32)), (Op::PushDigit, 5));
        assert_eq!(decode_cell(&bi(b'0' as u32)), (Op::PushDigit, 0));
        assert_eq!(decode_cell(&bi(b'9' as u32)), (Op::PushDigit, 9));
    }

    #[test]
    fn decode_known_glyph() {
        assert_eq!(decode_cell(&bi(b'@' as u32)), (Op::Halt, 0));
        assert_eq!(decode_cell(&bi('→' as u32)), (Op::MoveE, 0));
    }

    #[test]
    fn decode_ascii_alias_matches_unicode() {
        assert_eq!(decode_cell(&bi(b'>' as u32)), (Op::MoveE, 0));
        assert_eq!(decode_cell(&bi(b'v' as u32)), (Op::MoveS, 0));
    }

    #[test]
    fn decode_space_is_nop() {
        assert_eq!(decode_cell(&bi(0x20)), (Op::Nop, 0));
    }

    #[test]
    fn decode_unknown_glyph() {
        // 'Z' is not in the op table.
        assert_eq!(decode_cell(&bi(b'Z' as u32)), (Op::Unknown, 0));
    }

    #[test]
    fn decode_out_of_range_is_unknown() {
        let big = BigInt::from(u64::MAX) * BigInt::from(1_000_000);
        assert_eq!(decode_cell(&big), (Op::Unknown, 0));
    }

    #[test]
    fn decode_gust_calm() {
        assert_eq!(decode_cell(&bi('≫' as u32)), (Op::Gust, 0));
        assert_eq!(decode_cell(&bi('≪' as u32)), (Op::Calm, 0));
    }
}
