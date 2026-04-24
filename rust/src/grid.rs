//! Sparse grid and instruction pointer (SPEC §3.1, §3.2).
//!
//! Cell values are `BigInt` — the grid stores arbitrary-precision
//! integers per SPEC §3.1 ("G : ℤ × ℤ → ℤ"). Coordinates are `i64`;
//! this is a pragmatic departure from SPEC (which implies arbitrary-
//! precision coords), justified by: no realistic Windy program comes
//! near `i64` bounds, and unboxed `Copy` coords make the VM inner loop
//! substantially cheaper. If a Windy program ever needs BigInt coords
//! we'll know because it'll fail a conformance test — at which point
//! we upgrade.

use num_bigint::BigInt;
use std::collections::HashMap;

/// ASCII space (NOP) — the default value of every unpopulated cell.
pub const SPACE: u32 = 0x20;

#[derive(Debug, Clone, Default)]
pub struct Grid {
    pub cells: HashMap<(i64, i64), BigInt>,
}

impl Grid {
    pub fn new() -> Self {
        Self::default()
    }

    /// Read a cell; absent cells return `SPACE` (NOP) per SPEC §3.1.
    pub fn get(&self, x: i64, y: i64) -> BigInt {
        self.cells
            .get(&(x, y))
            .cloned()
            .unwrap_or_else(|| BigInt::from(SPACE))
    }

    /// Write a cell; writing `SPACE` deletes the entry so the map stays sparse.
    pub fn put(&mut self, x: i64, y: i64, value: BigInt) {
        if value == BigInt::from(SPACE) {
            self.cells.remove(&(x, y));
        } else {
            self.cells.insert((x, y), value);
        }
    }
}

/// Instruction pointer: position `(x, y)` and direction `(dx, dy)`.
/// Initial value is `(0, 0)` going east (SPEC §3.2).
#[derive(Debug, Clone, Copy)]
pub struct Ip {
    pub x: i64,
    pub y: i64,
    pub dx: i64,
    pub dy: i64,
}

impl Default for Ip {
    fn default() -> Self {
        Self { x: 0, y: 0, dx: 1, dy: 0 }
    }
}

impl Ip {
    pub fn advance(&mut self) {
        self.x += self.dx;
        self.y += self.dy;
    }

    pub fn set_dir(&mut self, dx: i64, dy: i64) {
        self.dx = dx;
        self.dy = dy;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_missing_cell_is_space() {
        let g = Grid::new();
        assert_eq!(g.get(7, -3), BigInt::from(SPACE));
    }

    #[test]
    fn grid_put_and_get_roundtrip() {
        let mut g = Grid::new();
        g.put(2, 5, BigInt::from(b'@'));
        assert_eq!(g.get(2, 5), BigInt::from(b'@'));
    }

    #[test]
    fn grid_put_space_is_sparse() {
        let mut g = Grid::new();
        g.put(0, 0, BigInt::from(b'@'));
        g.put(0, 0, BigInt::from(SPACE));
        assert!(!g.cells.contains_key(&(0, 0)));
        assert_eq!(g.get(0, 0), BigInt::from(SPACE));
    }

    #[test]
    fn ip_advances_by_direction() {
        let mut ip = Ip::default();
        ip.advance();
        assert_eq!((ip.x, ip.y), (1, 0));
        ip.set_dir(0, 1);
        ip.advance();
        assert_eq!((ip.x, ip.y), (1, 1));
    }
}
