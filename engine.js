/** Shared pixel ambient engine — browser + Node */

export const GRID_W = 96;
export const GRID_H = 54;
export const CELL = 20; // 96*20=1920, 54*20=1080
export const OUT_W = GRID_W * CELL;
export const OUT_H = GRID_H * CELL;
export const FPS = 12;
export const DURATION = 2.5; // seconds
export const FRAME_COUNT = Math.round(FPS * DURATION);

export const VARIANT_IDS = [
  'dust',
  'drift',
  'lattice',
  'orbit',
  'rain',
  'wave',
  'spiral',
  'pulse',
  'scan',
  'tunnel',
  'constellation',
  'cascade',
  'bars',
  'stacked',
  'linechart',
  'area',
  'histogram',
  'candles',
  'scatter',
  'radar',
  'pistons',
  'ripple',
  'tide',
  'checker',
  'zipper',
  'beacon',
  'mosaic',
  'diamond',
  'swarm',
];

export const VARIANT_META = {
  dust: { title: 'Dust', blurb: 'Near 1:1 reference — sparse flicker' },
  drift: { title: 'Drift', blurb: 'Same field, slow grid wrap' },
  lattice: { title: 'Lattice', blurb: 'Sparse geometric pulse grid' },
  orbit: { title: 'Orbit', blurb: 'Pixel rings around empty center' },
  rain: { title: 'Rain', blurb: 'Sparse digital rain columns' },
  wave: { title: 'Wave', blurb: 'Sine ribbon of pixels' },
  spiral: { title: 'Spiral', blurb: 'Archimedean pixel spiral' },
  pulse: { title: 'Pulse', blurb: 'Expanding square rings' },
  scan: { title: 'Scan', blurb: 'Soft horizontal scan sweep' },
  tunnel: { title: 'Tunnel', blurb: 'Perspective pixel frames' },
  constellation: { title: 'Constellation', blurb: 'Stars with rare pixel links' },
  cascade: { title: 'Cascade', blurb: 'Staggered falling dashes' },
  bars: { title: 'Bars', blurb: 'Animated bar chart' },
  stacked: { title: 'Stacked', blurb: 'Stacked bar segments' },
  linechart: { title: 'Line', blurb: 'Pixel line chart + dots' },
  area: { title: 'Area', blurb: 'Sparse filled area chart' },
  histogram: { title: 'Histo', blurb: 'Dense histogram columns' },
  candles: { title: 'Candles', blurb: 'OHLC candle sticks' },
  scatter: { title: 'Scatter', blurb: 'Drifting scatter plot' },
  radar: { title: 'Radar', blurb: 'Spider / radar outline' },
  pistons: { title: 'Pistons', blurb: 'Dense block grid — depth wave' },
  ripple: { title: 'Ripple', blurb: 'Radial height ripple on blocks' },
  tide: { title: 'Tide', blurb: 'Horizontal tide of block heights' },
  checker: { title: 'Checker', blurb: 'Flipping checkerboard field' },
  zipper: { title: 'Zipper', blurb: 'Alternating row slides' },
  beacon: { title: 'Beacon', blurb: 'Rotating lighthouse sweep' },
  mosaic: { title: 'Mosaic', blurb: 'Tiled blocks with phased flash' },
  diamond: { title: 'Diamond', blurb: 'Expanding diamond rings' },
  swarm: { title: 'Swarm', blurb: 'Packed pixel flocks wrapping' },
};

/** Mulberry32 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Soft brightness bias toward top-left (reference feel) */
function cornerBias(x, y) {
  const nx = x / (GRID_W - 1);
  const ny = y / (GRID_H - 1);
  const d = Math.hypot(nx, ny) / Math.SQRT2;
  return 0.55 + 0.45 * (1 - d);
}

function wrap(v, max) {
  return ((v % max) + max) % max;
}

function setMax(grid, x, y, v) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return;
  const i = y * GRID_W + x;
  if (v > grid[i]) grid[i] = v;
}

function buildDustField(seed = 1) {
  const rand = mulberry32(seed);
  const particles = [];
  const count = 118;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.floor(rand() * GRID_W),
      y: Math.floor(rand() * GRID_H),
      base: 0.18 + rand() * 0.72,
      phase: rand(),
      twinkle: 0.35 + rand() * 0.55,
      buddy: rand() < 0.22,
      bx: rand() < 0.5 ? 1 : 0,
      by: rand() < 0.5 ? 1 : 0,
    });
  }
  return particles;
}

function buildOrbitRings(seed = 4) {
  const rand = mulberry32(seed);
  const rings = [];
  const cx = (GRID_W - 1) / 2;
  const cy = (GRID_H - 1) / 2;
  const radii = [6, 11, 17, 23];
  for (const r of radii) {
    const n = Math.max(8, Math.floor(r * 1.35));
    const particles = [];
    for (let i = 0; i < n; i++) {
      if (rand() < 0.18) continue;
      particles.push({
        angle0: (i / n) * Math.PI * 2 + rand() * 0.08,
        base: 0.25 + rand() * 0.65,
        phase: rand(),
      });
    }
    rings.push({
      r,
      // Integer revolutions per loop → seamless at t=0≡t=1
      speed: (1 + Math.floor(rand() * 2)) * (rand() < 0.5 ? 1 : -1),
      particles,
      cx,
      cy,
    });
  }
  return rings;
}

function buildRain(seed = 0xa11) {
  const rand = mulberry32(seed);
  const cols = [];
  for (let i = 0; i < 28; i++) {
    cols.push({
      x: Math.floor(rand() * GRID_W),
      revs: 1 + Math.floor(rand() * 2),
      len: 2 + Math.floor(rand() * 5),
      phase: rand(),
      base: 0.35 + rand() * 0.55,
      gap: 4 + Math.floor(rand() * 10),
    });
  }
  return cols;
}

function buildConstellation(seed = 0xc055) {
  const rand = mulberry32(seed);
  const stars = [];
  const n = 42;
  for (let i = 0; i < n; i++) {
    stars.push({
      x: Math.floor(rand() * GRID_W),
      y: Math.floor(rand() * GRID_H),
      base: 0.3 + rand() * 0.65,
      phase: rand(),
    });
  }
  const links = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const d = Math.hypot(dx, dy);
      if (d > 4 && d < 11 && rand() < 0.14) {
        links.push({ a: i, b: j, phase: rand() });
      }
    }
  }
  return { stars, links };
}

function buildCascade(seed = 0xcadc) {
  const rand = mulberry32(seed);
  const dashes = [];
  for (let i = 0; i < 36; i++) {
    dashes.push({
      x: Math.floor(rand() * GRID_W),
      y0: Math.floor(rand() * GRID_H),
      len: 1 + Math.floor(rand() * 3),
      revs: 1 + Math.floor(rand() * 2),
      phase: rand(),
      base: 0.25 + rand() * 0.6,
      horizontal: rand() < 0.25,
    });
  }
  return dashes;
}

const CACHE = {
  dust: null,
  orbit: null,
  rain: null,
  constellation: null,
  cascade: null,
};

function getDust() {
  if (!CACHE.dust) CACHE.dust = buildDustField(0xd051);
  return CACHE.dust;
}

function getOrbit() {
  if (!CACHE.orbit) CACHE.orbit = buildOrbitRings(0xb17);
  return CACHE.orbit;
}

function getRain() {
  if (!CACHE.rain) CACHE.rain = buildRain(0xa11);
  return CACHE.rain;
}

function getConstellation() {
  if (!CACHE.constellation) CACHE.constellation = buildConstellation(0xc055);
  return CACHE.constellation;
}

function getCascade() {
  if (!CACHE.cascade) CACHE.cascade = buildCascade(0xcadc);
  return CACHE.cascade;
}

function paintLine(grid, x0, y0, x1, y1, bri) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const xEnd = Math.round(x1);
  const yEnd = Math.round(y1);
  const dx = Math.abs(xEnd - x);
  const dy = Math.abs(yEnd - y);
  const sx = x < xEnd ? 1 : -1;
  const sy = y < yEnd ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    setMax(grid, x, y, bri);
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Paint one frame into a Float32Array length GRID_W*GRID_H (brightness 0..1)
 */
export function paintFrame(variant, grid, tNorm) {
  grid.fill(0);
  const t = ((tNorm % 1) + 1) % 1;
  const twoPi = Math.PI * 2;
  const cx = (GRID_W - 1) / 2;
  const cy = (GRID_H - 1) / 2;

  if (variant === 'dust' || variant === 'drift') {
    const particles = getDust();
    // Full-grid wrap → t=0 ≡ t=1
    const driftX = variant === 'drift' ? t * GRID_W : 0;
    const driftY = variant === 'drift' ? t * GRID_H : 0;

    for (const p of particles) {
      const x = Math.floor(wrap(p.x + driftX, GRID_W));
      const y = Math.floor(wrap(p.y + driftY, GRID_H));
      const flick = 0.55 + 0.45 * Math.sin(twoPi * (t + p.phase));
      const flick2 =
        variant === 'dust'
          ? 0.7 + 0.3 * Math.sin(twoPi * (t * 2 + p.phase * 3))
          : 1;
      let bri = p.base * p.twinkle * flick * flick2 * cornerBias(x, y);
      bri = clamp01(bri);
      setMax(grid, x, y, bri);
      if (p.buddy) {
        setMax(
          grid,
          Math.floor(wrap(x + p.bx, GRID_W)),
          Math.floor(wrap(y + p.by, GRID_H)),
          bri * 0.75
        );
      }
    }
    return;
  }

  if (variant === 'lattice') {
    const stepX = 6;
    const stepY = 6;
    const ox = 2;
    const oy = 3;
    for (let y = oy; y < GRID_H; y += stepY) {
      for (let x = ox; x < GRID_W; x += stepX) {
        const phase = (x * 0.07 + y * 0.11) % 1;
        const pulse = 0.5 + 0.5 * Math.sin(twoPi * (t + phase));
        const arm = (x + y) % 12 === 0;
        let bri = (0.15 + 0.7 * pulse) * cornerBias(x, y);
        if (arm) bri = Math.min(1, bri * 1.25);
        if (pulse < 0.28) bri *= 0.15;
        setMax(grid, x, y, clamp01(bri));
        if (arm) {
          setMax(grid, wrap(x + 1, GRID_W), y, clamp01(bri * 0.55));
          setMax(grid, x, wrap(y + 1, GRID_H), clamp01(bri * 0.55));
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = wrap(ox + i * 5 + t * GRID_W, GRID_W);
      const y = wrap(oy + i * 3, GRID_H);
      const pulse = 0.4 + 0.6 * Math.sin(twoPi * (t + i * 0.13));
      if (pulse > 0.55) {
        setMax(grid, Math.floor(x), y, clamp01(0.35 * pulse * cornerBias(x, y)));
      }
    }
    return;
  }

  if (variant === 'orbit') {
    const rings = getOrbit();
    for (const ring of rings) {
      for (const p of ring.particles) {
        const ang = p.angle0 + twoPi * t * ring.speed;
        const fx = ring.cx + Math.cos(ang) * ring.r;
        const fy = ring.cy + Math.sin(ang) * ring.r * 0.72;
        const x = Math.floor(wrap(Math.round(fx), GRID_W));
        const y = Math.floor(wrap(Math.round(fy), GRID_H));
        const flick = 0.6 + 0.4 * Math.sin(twoPi * (t + p.phase));
        setMax(grid, x, y, clamp01(p.base * flick * cornerBias(x, y)));
      }
    }
    setMax(grid, Math.floor(GRID_W / 2), Math.floor(GRID_H / 2), 0.2 + 0.15 * Math.sin(twoPi * t));
    return;
  }

  if (variant === 'rain') {
    const cols = getRain();
    for (const c of cols) {
      const head = wrap(c.phase * GRID_H + t * c.revs * GRID_H, GRID_H);
      for (let k = 0; k < c.len; k++) {
        const y = Math.floor(wrap(head - k * (1 + (c.gap % 3 === 0 ? 1 : 0)), GRID_H));
        const fade = 1 - k / (c.len + 0.5);
        const bri = clamp01(c.base * fade * (0.7 + 0.3 * Math.sin(twoPi * (t + c.phase))));
        setMax(grid, c.x, y, bri * cornerBias(c.x, y));
      }
      // rare sparkle droplet (period-1 in t)
      if ((c.x + Math.floor(t * 7)) % 7 === 0) {
        setMax(grid, wrap(c.x + 1, GRID_W), Math.floor(head), clamp01(c.base * 0.45));
      }
    }
    return;
  }

  if (variant === 'wave') {
    const amp = 7;
    const mid = cy;
    for (let x = 0; x < GRID_W; x++) {
      const phase = x / GRID_W;
      const yMain = mid + Math.sin(twoPi * (phase * 2 + t)) * amp;
      const y2 = mid + Math.sin(twoPi * (phase * 2 + t) + 1.2) * (amp * 0.55);
      for (const [yy, mul] of [
        [yMain, 1],
        [y2, 0.55],
      ]) {
        const y = Math.round(yy);
        const bri = clamp01((0.35 + 0.5 * (0.5 + 0.5 * Math.sin(twoPi * (phase + t)))) * mul);
        setMax(grid, x, y, bri * cornerBias(x, y));
        if (x % 5 === 0) setMax(grid, x, wrap(y + 1, GRID_H), bri * 0.35);
      }
    }
    // sparse glitter above/below wave
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(wrap(i * 5 + t * GRID_W, GRID_W));
      const y = Math.floor(wrap(mid + Math.sin(twoPi * (i * 0.1 + t)) * 16 + i, GRID_H));
      const on = 0.5 + 0.5 * Math.sin(twoPi * (t + i * 0.07));
      if (on > 0.65) setMax(grid, x, y, 0.4 * on * cornerBias(x, y));
    }
    return;
  }

  if (variant === 'spiral') {
    const turns = 3;
    const maxR = 28;
    const n = 160;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const ang = twoPi * (u * turns + t);
      const r = u * maxR;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r * 0.62);
      const bri = clamp01(0.2 + 0.75 * (1 - u) * (0.55 + 0.45 * Math.sin(twoPi * (t + u))));
      setMax(grid, x, y, bri * cornerBias(Math.max(0, x), Math.max(0, y)));
    }
    // counter-spiral sparse
    for (let i = 0; i < 50; i++) {
      const u = i / 50;
      const ang = -twoPi * (u * 2 + t);
      const r = 4 + u * 22;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r * 0.62);
      const on = 0.5 + 0.5 * Math.sin(twoPi * (t * 2 + u));
      if (on > 0.4) setMax(grid, x, y, 0.45 * on);
    }
    return;
  }

  if (variant === 'pulse') {
    const maxR = 30;
    for (let k = 0; k < 5; k++) {
      const r = wrap(t * maxR + k * (maxR / 5), maxR);
      const bri = clamp01(0.85 * (1 - r / maxR) + 0.1);
      // square ring
      const x0 = Math.round(cx - r);
      const x1 = Math.round(cx + r);
      const y0 = Math.round(cy - r * 0.6);
      const y1 = Math.round(cy + r * 0.6);
      for (let x = x0; x <= x1; x++) {
        if ((x + Math.floor(r)) % 2 === 0) {
          setMax(grid, x, y0, bri * cornerBias(clampCoord(x, GRID_W), clampCoord(y0, GRID_H)));
          setMax(grid, x, y1, bri * 0.85);
        }
      }
      for (let y = y0; y <= y1; y++) {
        if ((y + Math.floor(r)) % 2 === 0) {
          setMax(grid, x0, y, bri * 0.9);
          setMax(grid, x1, y, bri * 0.75);
        }
      }
    }
    setMax(grid, Math.floor(cx), Math.floor(cy), 0.35 + 0.25 * Math.sin(twoPi * t));
    return;
  }

  if (variant === 'scan') {
    const bandY = wrap(t * GRID_H, GRID_H);
    // ambient dust
    const dust = getDust();
    for (let i = 0; i < dust.length; i += 3) {
      const p = dust[i];
      const flick = 0.4 + 0.3 * Math.sin(twoPi * (t + p.phase));
      setMax(grid, p.x, p.y, clamp01(p.base * 0.35 * flick));
    }
    // scan band
    for (let yOff = -2; yOff <= 2; yOff++) {
      const y = Math.floor(wrap(bandY + yOff, GRID_H));
      const fall = 1 - Math.abs(yOff) / 3;
      for (let x = 0; x < GRID_W; x++) {
        if ((x + Math.floor(bandY)) % 3 === 0) continue; // dashed (tied to band, seamless)
        const bri = clamp01((0.25 + 0.7 * fall) * (0.7 + 0.3 * Math.sin(x * 0.2 + t * twoPi)));
        setMax(grid, x, y, bri);
      }
    }
    // vertical tick marks
    for (let i = 0; i < 8; i++) {
      const x = Math.floor((i + 0.5) * (GRID_W / 8));
      setMax(grid, x, Math.floor(bandY), 1);
      setMax(grid, x, Math.floor(wrap(bandY + 1, GRID_H)), 0.5);
    }
    return;
  }

  if (variant === 'tunnel') {
    const layers = 8;
    for (let i = 0; i < layers; i++) {
      const u = (i / layers + t) % 1;
      const scale = 0.12 + u * 0.88;
      const halfW = (GRID_W * 0.48 * scale) | 0;
      const halfH = (GRID_H * 0.48 * scale) | 0;
      const bri = clamp01((1 - u) * 0.9);
      const x0 = Math.round(cx - halfW);
      const x1 = Math.round(cx + halfW);
      const y0 = Math.round(cy - halfH);
      const y1 = Math.round(cy + halfH);
      const step = u < 0.4 ? 1 : 2;
      for (let x = x0; x <= x1; x += step) {
        setMax(grid, x, y0, bri);
        setMax(grid, x, y1, bri * 0.85);
      }
      for (let y = y0; y <= y1; y += step) {
        setMax(grid, x0, y, bri * 0.9);
        setMax(grid, x1, y, bri * 0.8);
      }
    }
    // vanishing sparks
    for (let i = 0; i < 12; i++) {
      const ang = twoPi * (i / 12 + t);
      const r = 3 + ((i * 3 + t * 18) % 18);
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * r * 0.55);
      setMax(grid, x, y, 0.55 * (0.5 + 0.5 * Math.sin(twoPi * (t + i * 0.1))));
    }
    return;
  }

  if (variant === 'constellation') {
    const { stars, links } = getConstellation();
    for (const link of links) {
      const pulse = 0.5 + 0.5 * Math.sin(twoPi * (t + link.phase));
      if (pulse < 0.35) continue;
      const a = stars[link.a];
      const b = stars[link.b];
      paintLine(grid, a.x, a.y, b.x, b.y, 0.22 * pulse);
    }
    for (const s of stars) {
      const flick = 0.55 + 0.45 * Math.sin(twoPi * (t + s.phase));
      const bri = clamp01(s.base * flick * cornerBias(s.x, s.y));
      setMax(grid, s.x, s.y, bri);
      if (flick > 0.85) {
        setMax(grid, wrap(s.x + 1, GRID_W), s.y, bri * 0.4);
        setMax(grid, s.x, wrap(s.y + 1, GRID_H), bri * 0.4);
      }
    }
    return;
  }

  if (variant === 'cascade') {
    const dashes = getCascade();
    for (const d of dashes) {
      const extent = d.horizontal ? GRID_W : GRID_H;
      const pos = wrap(d.y0 + t * d.revs * extent, extent);
      const flick = 0.6 + 0.4 * Math.sin(twoPi * (t + d.phase));
      for (let k = 0; k < d.len; k++) {
        const bri = clamp01(d.base * flick * (1 - k / (d.len + 1)));
        if (d.horizontal) {
          const x = Math.floor(wrap(pos - k, GRID_W));
          setMax(grid, x, Math.floor(d.y0 % GRID_H), bri * cornerBias(x, d.y0 % GRID_H));
        } else {
          const y = Math.floor(wrap(pos - k, GRID_H));
          setMax(grid, d.x, y, bri * cornerBias(d.x, y));
        }
      }
    }
    return;
  }

  // --- chart-like variants ---
  const chartBottom = GRID_H - 4;
  const chartTop = 6;
  const chartH = chartBottom - chartTop;

  if (variant === 'bars') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = 16;
    const gap = 2;
    const barW = 3;
    const total = n * (barW + gap);
    const x0 = Math.floor((GRID_W - total) / 2);
    for (let i = 0; i < n; i++) {
      const phase = i / n;
      const hNorm = 0.22 + 0.7 * (0.5 + 0.5 * Math.sin(twoPi * (t + phase * 0.85)));
      const h = Math.max(1, Math.round(hNorm * chartH));
      const x = x0 + i * (barW + gap);
      for (let bx = 0; bx < barW; bx++) {
        for (let dy = 0; dy < h; dy++) {
          // hollow-ish: only edges + sparse fill
          const y = chartBottom - 1 - dy;
          const edge = bx === 0 || bx === barW - 1 || dy === h - 1 || dy % 3 === 0;
          if (!edge) continue;
          const bri = clamp01(0.35 + 0.55 * (dy / h) * (0.7 + 0.3 * Math.sin(twoPi * (t + phase))));
          setMax(grid, x + bx, y, bri);
        }
      }
    }
    return;
  }

  if (variant === 'stacked') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = 12;
    const gap = 3;
    const barW = 4;
    const total = n * (barW + gap);
    const x0 = Math.floor((GRID_W - total) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (barW + gap);
      let yCursor = chartBottom - 1;
      for (let seg = 0; seg < 3; seg++) {
        const phase = (i * 0.07 + seg * 0.33 + t) % 1;
        const hNorm = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(twoPi * phase));
        const h = Math.max(1, Math.round(hNorm * chartH));
        const briBase = 0.3 + seg * 0.22;
        for (let dy = 0; dy < h; dy++) {
          const y = yCursor - dy;
          if (y < chartTop) break;
          for (let bx = 0; bx < barW; bx++) {
            if (bx > 0 && bx < barW - 1 && dy > 0 && dy < h - 1 && dy % 2 === 1) continue;
            setMax(grid, x + bx, y, clamp01(briBase * (0.75 + 0.25 * (dy / h))));
          }
        }
        yCursor -= h + 1; // 1px gap between stacks
      }
    }
    return;
  }

  if (variant === 'linechart') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = 24;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = 6 + Math.round(u * (GRID_W - 13));
      const yNorm =
        0.5 +
        0.35 * Math.sin(twoPi * (u * 1.5 + t)) +
        0.12 * Math.sin(twoPi * (u * 3.2 - t));
      const y = chartBottom - 1 - Math.round(clamp01(yNorm) * (chartH - 2));
      pts.push({ x, y });
    }
    for (let i = 0; i < pts.length - 1; i++) {
      paintLine(grid, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 0.55);
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pulse = 0.6 + 0.4 * Math.sin(twoPi * (t + i * 0.05));
      setMax(grid, p.x, p.y, clamp01(0.9 * pulse));
      if (i % 3 === 0) {
        setMax(grid, p.x, wrap(p.y - 1, GRID_H), 0.35);
        setMax(grid, wrap(p.x + 1, GRID_W), p.y, 0.3);
      }
    }
    return;
  }

  if (variant === 'area') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = GRID_W - 12;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = 6 + i;
      const yNorm =
        0.35 +
        0.4 * Math.sin(twoPi * (u + t)) +
        0.15 * Math.sin(twoPi * (u * 2.5 - t));
      const yTop = chartBottom - 1 - Math.round(clamp01(yNorm) * (chartH - 2));
      // sparse fill under curve
      for (let y = yTop; y < chartBottom; y++) {
        const depth = (y - yTop) / Math.max(1, chartBottom - yTop);
        if ((x + y + Math.floor(t * 3)) % 3 !== 0) continue;
        setMax(grid, x, y, clamp01(0.15 + 0.45 * (1 - depth)));
      }
      setMax(grid, x, yTop, 0.75);
    }
    return;
  }

  if (variant === 'histogram') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = 32;
    const barW = 2;
    const gap = 1;
    const total = n * (barW + gap);
    const x0 = Math.floor((GRID_W - total) / 2);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      // bell-ish envelope that breathes
      const envelope = Math.exp(-Math.pow((u - 0.5) * 3.2, 2));
      const noise = 0.5 + 0.5 * Math.sin(twoPi * (t * 2 + u * 4));
      const hNorm = 0.15 + envelope * (0.55 + 0.25 * noise);
      const h = Math.max(1, Math.round(hNorm * chartH));
      const x = x0 + i * (barW + gap);
      for (let bx = 0; bx < barW; bx++) {
        for (let dy = 0; dy < h; dy++) {
          if (dy % 2 === 1 && dy < h - 1) continue;
          const y = chartBottom - 1 - dy;
          setMax(grid, x + bx, y, clamp01(0.3 + 0.55 * (dy / h)));
        }
      }
    }
    return;
  }

  if (variant === 'candles') {
    paintChartAxes(grid, chartTop, chartBottom);
    const n = 14;
    const gap = 3;
    const bodyW = 3;
    const total = n * (bodyW + gap);
    const x0 = Math.floor((GRID_W - total) / 2);
    for (let i = 0; i < n; i++) {
      const phase = i / n;
      const mid =
        0.45 +
        0.25 * Math.sin(twoPi * (t + phase * 0.9)) +
        0.1 * Math.sin(twoPi * (t * 2 + phase * 2));
      const spread = 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(twoPi * (t * 2 + phase)));
      const openN = clamp01(mid - spread * 0.4);
      const closeN = clamp01(mid + spread * 0.45 * Math.sin(twoPi * (t + phase)));
      const highN = clamp01(Math.max(openN, closeN) + spread * 0.5);
      const lowN = clamp01(Math.min(openN, closeN) - spread * 0.5);
      const yOpen = chartBottom - 1 - Math.round(openN * (chartH - 2));
      const yClose = chartBottom - 1 - Math.round(closeN * (chartH - 2));
      const yHigh = chartBottom - 1 - Math.round(highN * (chartH - 2));
      const yLow = chartBottom - 1 - Math.round(lowN * (chartH - 2));
      const x = x0 + i * (bodyW + gap);
      const wickX = x + 1;
      paintLine(grid, wickX, yHigh, wickX, yLow, 0.4);
      const yA = Math.min(yOpen, yClose);
      const yB = Math.max(yOpen, yClose);
      for (let y = yA; y <= yB; y++) {
        for (let bx = 0; bx < bodyW; bx++) {
          if (bx > 0 && bx < bodyW - 1 && y > yA && y < yB) continue;
          setMax(grid, x + bx, y, 0.7);
        }
      }
    }
    return;
  }

  if (variant === 'scatter') {
    paintChartAxes(grid, chartTop, chartBottom);
    const pts = getScatter();
    for (const p of pts) {
      const x = Math.floor(wrap(p.x + Math.sin(twoPi * (t + p.phase)) * p.ampX, GRID_W - 8) + 4);
      const y = Math.floor(
        clampCoord(p.y + Math.cos(twoPi * (t + p.phase * 1.3)) * p.ampY, chartBottom)
      );
      if (y < chartTop || y >= chartBottom) continue;
      const flick = 0.55 + 0.45 * Math.sin(twoPi * (t * 2 + p.phase));
      setMax(grid, x, y, clamp01(p.base * flick));
      if (flick > 0.8) setMax(grid, wrap(x + 1, GRID_W), y, p.base * 0.35);
    }
    // faint regression line
    const y0 = chartBottom - 1 - Math.round((0.35 + 0.1 * Math.sin(twoPi * t)) * chartH);
    const y1 = chartBottom - 1 - Math.round((0.65 + 0.1 * Math.cos(twoPi * t)) * chartH);
    paintLine(grid, 6, y0, GRID_W - 7, y1, 0.2);
    return;
  }

  if (variant === 'radar') {
    const axes = 6;
    const maxR = 18;
    const levels = 3;
    // grid rings (polygon)
    for (let lv = 1; lv <= levels; lv++) {
      const r = (maxR * lv) / levels;
      const poly = [];
      for (let i = 0; i < axes; i++) {
        const ang = -Math.PI / 2 + (twoPi * i) / axes;
        poly.push({
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r * 0.75,
        });
      }
      for (let i = 0; i < axes; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % axes];
        paintLine(grid, a.x, a.y, b.x, b.y, 0.18);
      }
    }
    // axis spokes
    for (let i = 0; i < axes; i++) {
      const ang = -Math.PI / 2 + (twoPi * i) / axes;
      paintLine(
        grid,
        cx,
        cy,
        cx + Math.cos(ang) * maxR,
        cy + Math.sin(ang) * maxR * 0.75,
        0.22
      );
    }
    // data polygon
    const data = [];
    for (let i = 0; i < axes; i++) {
      const ang = -Math.PI / 2 + (twoPi * i) / axes;
      const rNorm =
        0.35 + 0.5 * (0.5 + 0.5 * Math.sin(twoPi * (t + i / axes)));
      const r = maxR * rNorm;
      data.push({
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r * 0.75,
      });
    }
    for (let i = 0; i < axes; i++) {
      const a = data[i];
      const b = data[(i + 1) % axes];
      paintLine(grid, a.x, a.y, b.x, b.y, 0.7);
      setMax(grid, Math.round(a.x), Math.round(a.y), 0.95);
    }
    return;
  }

  if (variant === 'pistons' || variant === 'ripple' || variant === 'tide') {
    paintBlockField(grid, t, variant);
    return;
  }

  if (variant === 'checker') {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const cell = ((x >> 1) + (y >> 1)) & 1;
        const phase = ((x >> 1) * 0.07 + (y >> 1) * 0.11) % 1;
        const flip = 0.5 + 0.5 * Math.sin(twoPi * (t + phase + (cell ? 0.5 : 0)));
        if (flip < 0.42) continue;
        const bri = clamp01(0.2 + 0.7 * flip) * cornerBias(x, y);
        setMax(grid, x, y, bri);
      }
    }
    return;
  }

  if (variant === 'zipper') {
    for (let y = 0; y < GRID_H; y++) {
      const dir = y % 2 === 0 ? 1 : -1;
      const shift = t * GRID_W * dir;
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(wrap(i * 7 + y * 3 + shift, GRID_W));
        const pulse = 0.5 + 0.5 * Math.sin(twoPi * (t + i * 0.08 + y * 0.03));
        if (pulse < 0.35) continue;
        setMax(grid, x, y, clamp01(0.35 + 0.55 * pulse) * cornerBias(x, y));
        setMax(grid, wrap(x + 1, GRID_W), y, clamp01(0.2 * pulse));
      }
    }
    return;
  }

  if (variant === 'beacon') {
    const ang = twoPi * t;
    const beamW = 0.12;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const dx = x - cx;
        const dy = (y - cy) / 0.75;
        const a = Math.atan2(dy, dx);
        let d = Math.abs(((a - ang + Math.PI) % twoPi) - Math.PI);
        d = Math.min(d, twoPi - d);
        if (d > beamW) continue;
        const fall = 1 - d / beamW;
        const r = Math.hypot(dx, dy);
        const bri = clamp01(fall * (0.35 + 0.55 * (1 - r / 55)));
        setMax(grid, x, y, bri);
      }
    }
    setMax(grid, Math.floor(cx), Math.floor(cy), 0.9);
    setMax(grid, Math.floor(cx) + 1, Math.floor(cy), 0.55);
    setMax(grid, Math.floor(cx), Math.floor(cy) + 1, 0.55);
    return;
  }

  if (variant === 'mosaic') {
    const tile = 4;
    const cols = Math.ceil(GRID_W / tile);
    const rows = Math.ceil(GRID_H / tile);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const phase = ((tx * 0.17 + ty * 0.23) % 1);
        const on = 0.5 + 0.5 * Math.sin(twoPi * (t + phase));
        if (on < 0.55) continue;
        const bri = clamp01(0.25 + 0.65 * on);
        const x0 = tx * tile;
        const y0 = ty * tile;
        for (let ly = 0; ly < tile - 1; ly++) {
          for (let lx = 0; lx < tile - 1; lx++) {
            setMax(grid, x0 + lx, y0 + ly, bri * cornerBias(x0 + lx, y0 + ly));
          }
        }
      }
    }
    return;
  }

  if (variant === 'diamond') {
    const maxR = 40;
    for (let k = 0; k < 4; k++) {
      const r = wrap(t * maxR + k * (maxR / 4), maxR);
      const bri = clamp01(0.9 * (1 - r / maxR) + 0.12);
      for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
        const j = Math.round(r - Math.abs(i));
        const points = [
          [cx + i, cy + j * 0.65],
          [cx + i, cy - j * 0.65],
        ];
        for (const [px, py] of points) {
          setMax(grid, Math.round(px), Math.round(py), bri);
        }
      }
    }
    setMax(grid, Math.floor(cx), Math.floor(cy), 0.45 + 0.3 * Math.sin(twoPi * t));
    return;
  }

  if (variant === 'swarm') {
    const flocks = getSwarm();
    for (const f of flocks) {
      const ox = wrap(f.x + t * f.revsX * GRID_W, GRID_W);
      const oy = wrap(f.y + t * f.revsY * GRID_H, GRID_H);
      for (const p of f.members) {
        const x = Math.floor(wrap(ox + p.dx + Math.sin(twoPi * (t + p.phase)) * p.wobble, GRID_W));
        const y = Math.floor(wrap(oy + p.dy + Math.cos(twoPi * (t + p.phase)) * p.wobble, GRID_H));
        const flick = 0.55 + 0.45 * Math.sin(twoPi * (t * 2 + p.phase));
        setMax(grid, x, y, clamp01(p.base * flick) * cornerBias(x, y));
      }
    }
    return;
  }

  throw new Error(`Unknown variant: ${variant}`);
}

const CACHE_SWARM = { flocks: null };

function getSwarm() {
  if (!CACHE_SWARM.flocks) {
    const rand = mulberry32(0x5a12);
    const flocks = [];
    for (let i = 0; i < 5; i++) {
      const members = [];
      for (let j = 0; j < 16; j++) {
        members.push({
          dx: Math.floor(rand() * 7) - 3,
          dy: Math.floor(rand() * 5) - 2,
          base: 0.35 + rand() * 0.55,
          phase: rand(),
          wobble: 0.4 + rand() * 1.2,
        });
      }
      flocks.push({
        x: rand() * GRID_W,
        y: rand() * GRID_H,
        revsX: (1 + Math.floor(rand() * 2)) * (rand() < 0.5 ? 1 : -1),
        revsY: (rand() < 0.5 ? 1 : -1),
        members,
      });
    }
    CACHE_SWARM.flocks = flocks;
  }
  return CACHE_SWARM.flocks;
}

/** Dense square tiles; luminance = “height” (block-piston reference). */
function paintBlockField(grid, t, mode) {
  const twoPi = Math.PI * 2;
  const block = 2; // square pixels/tiles
  const gap = 1;
  const stride = block + gap;
  const cols = Math.floor((GRID_W + gap) / stride);
  const rows = Math.floor((GRID_H + gap) / stride);
  const originX = Math.floor((GRID_W - (cols * stride - gap)) / 2);
  const originY = Math.floor((GRID_H - (rows * stride - gap)) / 2);
  const maxR = Math.hypot(cols / 2, rows / 2) || 1;

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let h;
      if (mode === 'pistons') {
        const wave =
          0.5 +
          0.5 *
            Math.sin(
              twoPi * (t - (bx / cols) * 0.9 + (by / rows) * 0.08)
            );
        const secondary =
          0.5 + 0.5 * Math.sin(twoPi * (t * 2 + bx * 0.07 + by * 0.11));
        h = clamp01(wave * 0.82 + secondary * 0.18);
      } else if (mode === 'ripple') {
        const dx = bx + 0.5 - cols / 2;
        const dy = by + 0.5 - rows / 2;
        const r = Math.hypot(dx, dy) / maxR;
        h = 0.5 + 0.5 * Math.sin(twoPi * (t - r * 1.25));
      } else {
        // tide — horizontal wrap with soft vertical bend
        const bend = 0.12 * Math.sin((by / Math.max(1, rows - 1)) * Math.PI);
        h = 0.5 + 0.5 * Math.sin(twoPi * (t - bx / cols + bend));
      }

      const base = 0.12 + 0.78 * h;
      const x0 = originX + bx * stride;
      const y0 = originY + by * stride;
      for (let ly = 0; ly < block; ly++) {
        for (let lx = 0; lx < block; lx++) {
          setMax(grid, x0 + lx, y0 + ly, base);
        }
      }
    }
  }
}

function paintChartAxes(grid, top, bottom) {
  // baseline + left spine, sparse ticks
  for (let x = 4; x < GRID_W - 4; x++) {
    if (x % 4 === 0) setMax(grid, x, bottom, 0.28);
  }
  for (let y = top; y <= bottom; y++) {
    if (y % 5 === 0) setMax(grid, 4, y, 0.22);
  }
  setMax(grid, 4, bottom, 0.45);
}

const CACHE_SCATTER = { pts: null };

function getScatter() {
  if (!CACHE_SCATTER.pts) {
    const rand = mulberry32(0x5ca7);
    const pts = [];
    for (let i = 0; i < 48; i++) {
      pts.push({
        x: 8 + rand() * (GRID_W - 16),
        y: 10 + rand() * (GRID_H - 16),
        base: 0.35 + rand() * 0.55,
        phase: rand(),
        ampX: 1 + rand() * 3,
        ampY: 1 + rand() * 2.5,
      });
    }
    CACHE_SCATTER.pts = pts;
  }
  return CACHE_SCATTER.pts;
}

function clampCoord(v, max) {
  return Math.max(0, Math.min(max - 1, v));
}

/** Fill RGB Uint8ClampedArray (low-res GRID_W x GRID_H) */
export function gridToRgb(grid, rgb, bg = 6) {
  const n = GRID_W * GRID_H;
  for (let i = 0; i < n; i++) {
    const b = grid[i];
    const v = b <= 0 ? bg : Math.round(bg + b * (255 - bg));
    const o = i * 3;
    rgb[o] = v;
    rgb[o + 1] = v;
    rgb[o + 2] = v;
  }
}

/** Upscale nearest into ImageData-like rgba buffer OUT_W x OUT_H */
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
