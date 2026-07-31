/** Shared grayscale grid + upscale for pixel-games — matches ambient square cells */

export const GRID_W = 96;
export const GRID_H = 54;
export const CELL = 20; // 96*20=1920, 54*20=1080 — square logical pixels
export const OUT_W = GRID_W * CELL;
export const OUT_H = GRID_H * CELL;

export function clearGrid(grid) {
  grid.fill(0);
}

export function setCell(grid, x, y, v) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= GRID_W || yi >= GRID_H) return;
  const i = yi * GRID_W + xi;
  if (v > grid[i]) grid[i] = v;
}

/** Force-write a cell (for solid game sprites — mid grayscale, not max-with-bg) */
export function plotCell(grid, x, y, v) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= GRID_W || yi >= GRID_H) return;
  grid[yi * GRID_W + xi] = v;
}

/**
 * Deterministic per-cell brightness so neighbors don't melt into one strip.
 * @param {number} base mid gray 0..1
 */
export function shade(base, x, y, salt = 0) {
  const h =
    ((Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 127412617)) >>>
      0) %
    1000;
  const t = h / 1000;
  return Math.min(0.7, Math.max(0.14, base * (0.7 + t * 0.55)));
}

/** One-pixel-tall span with varied cell brightness */
export function plotRow(grid, x, y, w, base, salt = 0) {
  for (let i = 0; i < w; i++) {
    plotCell(grid, x + i, y, shade(base, x + i, y, salt));
  }
}

export function fillRect(grid, x, y, w, h, v) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) plotCell(grid, x + i, y + j, shade(v, x + i, y + j));
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(v, n) {
  return ((v % n) + n) % n;
}

/** Sparse drifting dust — ambient-style, dim so gameplay stays readable */
const BG_PARTICLES = (() => {
  const rand = mulberry32(0xb6a0);
  const list = [];
  for (let i = 0; i < 140; i++) {
    list.push({
      x: Math.floor(rand() * GRID_W),
      y: Math.floor(rand() * GRID_H),
      base: 0.12 + rand() * 0.35,
      phase: rand(),
      twinkle: 0.4 + rand() * 0.5,
      buddy: rand() < 0.2,
      bx: rand() < 0.5 ? 1 : 0,
      by: rand() < 0.5 ? 1 : 0,
    });
  }
  return list;
})();

/**
 * Paint slow-drifting dust only into empty cells (never punch through sprites).
 * Brightness stays in soft mid-gray — ambient feel, not white.
 */
export function paintDriftBg(grid, timeSec) {
  const t = timeSec * 0.04;
  const driftX = t * GRID_W;
  const driftY = t * GRID_H * 0.55;
  const twoPi = Math.PI * 2;
  for (const p of BG_PARTICLES) {
    const x = Math.floor(wrap(p.x + driftX, GRID_W));
    const y = Math.floor(wrap(p.y + driftY, GRID_H));
    const flick = 0.55 + 0.45 * Math.sin(twoPi * (t * 3 + p.phase));
    // Cap ~0.22 so dust stays darker than gameplay
    const bri = Math.min(0.22, p.base * p.twinkle * flick * 0.55);
    paintBgDot(grid, x, y, bri);
    if (p.buddy) {
      paintBgDot(
        grid,
        Math.floor(wrap(x + p.bx, GRID_W)),
        Math.floor(wrap(y + p.by, GRID_H)),
        bri * 0.7
      );
    }
  }
}

function paintBgDot(grid, x, y, v) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const i = y * GRID_W + x;
  if (grid[i] === 0 && v > 0) grid[i] = v;
}

export function gridToRgb(grid, rgb, bg = 6) {
  const n = GRID_W * GRID_H;
  for (let i = 0; i < n; i++) {
    const b = grid[i];
    const val = b <= 0 ? bg : Math.round(bg + b * (255 - bg));
    const o = i * 3;
    rgb[o] = val;
    rgb[o + 1] = val;
    rgb[o + 2] = val;
  }
}

export function upscaleNearest(rgbLow, rgbaOut) {
  for (let y = 0; y < OUT_H; y++) {
    const sy = (y / CELL) | 0;
    for (let x = 0; x < OUT_W; x++) {
      const sx = (x / CELL) | 0;
      const si = (sy * GRID_W + sx) * 3;
      const v = rgbLow[si];
      const di = (y * OUT_W + x) * 4;
      rgbaOut[di] = v;
      rgbaOut[di + 1] = v;
      rgbaOut[di + 2] = v;
      rgbaOut[di + 3] = 255;
    }
  }
}

/** 3×5 digits, rows as bitmasks */
const DIGITS = [
  [0b111, 0b101, 0b101, 0b101, 0b111],
  [0b010, 0b110, 0b010, 0b010, 0b111],
  [0b111, 0b001, 0b111, 0b100, 0b111],
  [0b111, 0b001, 0b111, 0b001, 0b111],
  [0b101, 0b101, 0b111, 0b001, 0b001],
  [0b111, 0b100, 0b111, 0b001, 0b111],
  [0b111, 0b100, 0b111, 0b101, 0b111],
  [0b111, 0b001, 0b001, 0b001, 0b001],
  [0b111, 0b101, 0b111, 0b101, 0b111],
  [0b111, 0b101, 0b111, 0b001, 0b111],
];

export function blitDigit(grid, digit, x, y, v = 0.55) {
  const d = DIGITS[digit | 0];
  if (!d) return;
  for (let row = 0; row < 5; row++) {
    const bits = d[row];
    for (let col = 0; col < 3; col++) {
      if (bits & (1 << (2 - col))) {
        plotCell(grid, x + col, y + row, shade(v, x + col, y + row, digit + 1));
      }
    }
  }
}

export function blitNumber(grid, n, x, y, v = 0.55, pad = 1) {
  const s = String(Math.max(0, n | 0));
  let cx = x;
  for (const ch of s) {
    blitDigit(grid, ch.charCodeAt(0) - 48, cx, y, v);
    cx += 3 + pad;
  }
}
