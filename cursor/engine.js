/** Pixel cursor interactive engine — particle sim on coarse grid */

export const GRID_W = 96;
export const GRID_H = 54;
export const CELL = 20;
export const OUT_W = GRID_W * CELL;
export const OUT_H = GRID_H * CELL;

export const VARIANT_IDS = [
  'trail',
  'snake',
  'magnet',
  'orbit',
  'gather',
  'wake',
  'repel',
  'cross',
  'spark',
];

export const VARIANT_META = {
  trail: { title: 'Trail', blurb: 'Lagging swarm; tip is 4 pure whites' },
  snake: { title: 'Snake', blurb: 'Chain follows tip; head is white' },
  magnet: { title: 'Magnet', blurb: 'Field dust; only tip sticks white' },
  orbit: { title: 'Orbit', blurb: 'Tip whites orbit the cursor' },
  gather: { title: 'Gather', blurb: 'Pulls tip whites; rest stay dust' },
  wake: { title: 'Wake', blurb: 'Sparse wake dots; tip stays white' },
  repel: { title: 'Repel', blurb: 'Dust flees; tip whites hold the center' },
  cross: { title: 'Cross', blurb: 'Four whites lock into a + at cursor' },
  spark: { title: 'Spark', blurb: 'Whites burst outward, then reform' },
};

/** Default UI / physics knobs */
export const DEFAULT_OPTS = {
  tip: 4, // pure-white pixels at cursor (1–8)
  pull: 1, // attract radius / strength scale (0.35–2)
  snap: 1, // how snappy tip follows (0.35–2)
};

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

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(x) {
  return clamp(x, 0, 1);
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function setMax(grid, x, y, v) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= GRID_W || yi >= GRID_H) return;
  const i = yi * GRID_W + xi;
  if (v > grid[i]) grid[i] = v;
}

const COUNT_BY_VARIANT = {
  trail: 140,
  snake: 36,
  magnet: 150,
  orbit: 110,
  gather: 160,
  wake: 140,
  repel: 150,
  cross: 120,
  spark: 130,
};

export function createState(variant = 'trail', count) {
  const n = count ?? COUNT_BY_VARIANT[variant] ?? 140;
  const rand = mulberry32(0xc0f5e1 ^ (variant.length * 97));
  const particles = [];
  for (let i = 0; i < n; i++) {
    const restX = 2 + rand() * (GRID_W - 4);
    const restY = 2 + rand() * (GRID_H - 4);
    particles.push({
      x: restX,
      y: restY,
      vx: 0,
      vy: 0,
      restX,
      restY,
      base: 0.28 + rand() * 0.42,
      phase: rand(),
      lag: 0.05 + rand() * 0.25,
      angle: rand() * Math.PI * 2,
      stuck: 0,
      tip: false,
    });
  }
  return {
    particles,
    wake: new Float32Array(GRID_W * GRID_H),
    history: [],
    variant,
    sparkT: 0,
  };
}

export function resetState(state, variant) {
  const next = createState(variant);
  state.particles = next.particles;
  state.wake = next.wake;
  state.history.length = 0;
  state.variant = variant;
  state.sparkT = 0;
}

function springToward(p, tx, ty, stiffness, damping) {
  p.vx += (tx - p.x) * stiffness;
  p.vy += (ty - p.y) * stiffness;
  p.vx *= damping;
  p.vy *= damping;
  p.x += p.vx;
  p.y += p.vy;
}

function easeToRest(p, strength, damping) {
  springToward(p, p.restX, p.restY, strength, damping);
}

function idleDrift(p, t, amp = 0.35) {
  p.x += Math.sin(t * 1.3 + p.phase * 6.28) * amp * 0.02;
  p.y += Math.cos(t * 1.1 + p.phase * 4.1) * amp * 0.02;
}

function pushHistory(state, pointer, maxLen = 48) {
  if (!pointer.active) return;
  const last = state.history[state.history.length - 1];
  if (last && dist2(last.x, last.y, pointer.x, pointer.y) < 0.04) return;
  state.history.push({ x: pointer.x, y: pointer.y });
  while (state.history.length > maxLen) state.history.shift();
}

function historyPoint(state, lag01) {
  if (state.history.length === 0) return null;
  const idx = Math.max(
    0,
    Math.floor((1 - clamp01(lag01)) * (state.history.length - 1))
  );
  return state.history[idx];
}

function tipCount(opts) {
  return Math.round(clamp(opts.tip ?? 4, 1, 8));
}

function pullR(opts, base) {
  return base * (opts.pull ?? 1);
}

function snapK(opts, base) {
  return base * (opts.snap ?? 1);
}

/** Mark closest N particles as tip; clear others. */
function assignTips(state, pointer, opts) {
  const n = tipCount(opts);
  for (const p of state.particles) p.tip = false;
  if (!pointer.active) return [];

  const scored = state.particles.map((p, i) => ({
    i,
    d2: dist2(p.x, p.y, pointer.x, pointer.y),
    stuck: p.stuck,
  }));
  scored.sort((a, b) => b.stuck - a.stuck || a.d2 - b.d2);
  const tips = [];
  for (let k = 0; k < Math.min(n, scored.length); k++) {
    const p = state.particles[scored[k].i];
    p.tip = true;
    tips.push(p);
  }
  return tips;
}

function holdTipOffsets(tips, pointer, opts, t, mode) {
  const n = tips.length || 1;
  const k = snapK(opts, 0.32);
  for (let i = 0; i < tips.length; i++) {
    const p = tips[i];
    p.stuck = 1;
    let ox = 0;
    let oy = 0;
    if (mode === 'cross') {
      const dirs = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ];
      const d = dirs[i % dirs.length];
      ox = d[0];
      oy = d[1];
    } else if (mode === 'orbit') {
      p.angle += 0.05 * (opts.snap ?? 1);
      const r = 1.15 + (i % 3) * 0.15;
      ox = Math.cos(p.angle) * r;
      oy = Math.sin(p.angle) * r;
    } else if (mode === 'cluster') {
      // distinct grid cells in a 2×2 (or extended) block
      ox = (i % 2);
      oy = ((i / 2) | 0);
    } else {
      ox = (i % 2);
      oy = ((i / 2) | 0);
    }
    springToward(p, pointer.x + ox, pointer.y + oy, k, 0.7);
  }
}

function stepTrail(state, pointer, t, opts) {
  pushHistory(state, pointer);
  // non-tips follow history but keep clear of tip zone
  for (const p of state.particles) {
    if (pointer.active) {
      const hp = historyPoint(state, Math.min(0.95, p.lag + 0.15)) || pointer;
      springToward(p, hp.x, hp.y, 0.05 * (opts.snap ?? 1), 0.84);
      p.stuck = Math.min(1, p.stuck + 0.02);
    } else {
      easeToRest(p, 0.04, 0.86);
      idleDrift(p, t);
      p.stuck *= 0.85;
    }
  }
  const tips = assignTips(state, pointer, opts);
  for (const p of state.particles) {
    if (p.tip || !pointer.active) continue;
    const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
    if (d2 < 3.5 * 3.5) {
      const ang = Math.atan2(p.y - pointer.y, p.x - pointer.x || 0.01);
      springToward(
        p,
        pointer.x + Math.cos(ang) * 5,
        pointer.y + Math.sin(ang) * 5,
        0.12,
        0.8
      );
    }
  }
  if (pointer.active) holdTipOffsets(tips, pointer, opts, t, 'cluster');
  else for (const p of state.particles) if (p.tip) easeToRest(p, 0.05, 0.85);
}

function stepSnake(state, pointer, t, opts) {
  const parts = state.particles;
  for (const p of parts) p.tip = false;
  const nTip = tipCount(opts);
  if (pointer.active) {
    springToward(parts[0], pointer.x, pointer.y, snapK(opts, 0.38), 0.7);
    for (let i = 1; i < parts.length; i++) {
      const prev = parts[i - 1];
      const p = parts[i];
      const spacing = 0.9;
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      springToward(
        p,
        prev.x + (dx / d) * spacing,
        prev.y + (dy / d) * spacing,
        0.28,
        0.75
      );
    }
    for (let i = 0; i < Math.min(nTip, parts.length); i++) {
      parts[i].tip = true;
      parts[i].stuck = 1;
    }
  } else {
    for (const p of parts) {
      p.tip = false;
      p.stuck *= 0.85;
      easeToRest(p, 0.035, 0.88);
      idleDrift(p, t, 0.25);
    }
  }
}

function stepMagnetLike(state, pointer, t, opts, mode) {
  const radius = pullR(opts, mode === 'gather' ? 16 : 14);
  const r2 = radius * radius;
  for (const p of state.particles) {
    if (!pointer.active) {
      p.stuck *= 0.88;
      easeToRest(p, 0.045, 0.86);
      idleDrift(p, t);
      continue;
    }
    const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
    if (d2 < r2) {
      const d = Math.sqrt(d2) || 0.001;
      p.stuck = Math.min(1, p.stuck + 0.1 * (1 - d / radius));
    } else {
      p.stuck *= 0.92;
      easeToRest(p, 0.03, 0.9);
      idleDrift(p, t, 0.3);
    }
  }
  const tips = assignTips(state, pointer, opts);
  // non-tips: soft drift, do not clump into a gray blob at cursor
  for (const p of state.particles) {
    if (p.tip) continue;
    if (pointer.active && p.stuck > 0.2) {
      // gently peel away from tip zone
      const ang = Math.atan2(p.y - pointer.y, p.x - pointer.x);
      const keep = pullR(opts, 4.5);
      springToward(
        p,
        pointer.x + Math.cos(ang) * keep,
        pointer.y + Math.sin(ang) * keep,
        0.08,
        0.85
      );
      p.stuck *= 0.95;
    }
  }
  if (pointer.active) {
    holdTipOffsets(
      tips,
      pointer,
      opts,
      t,
      mode === 'orbit' ? 'orbit' : mode === 'gather' ? 'cluster' : 'cluster'
    );
  }
}

function stepWake(state, pointer, t, opts) {
  const wake = state.wake;
  for (let i = 0; i < wake.length; i++) wake[i] *= 0.9;

  if (pointer.active) {
    // sparse single-cell wake — no soft halo
    const xi = clamp(Math.round(pointer.x), 0, GRID_W - 1);
    const yi = clamp(Math.round(pointer.y), 0, GRID_H - 1);
    wake[yi * GRID_W + xi] = 1;
  }

  for (const p of state.particles) {
    const xi = clamp(Math.round(p.x), 1, GRID_W - 2);
    const yi = clamp(Math.round(p.y), 1, GRID_H - 2);
    const gx = wake[yi * GRID_W + (xi + 1)] - wake[yi * GRID_W + (xi - 1)];
    const gy = wake[(yi + 1) * GRID_W + xi] - wake[(yi - 1) * GRID_W + xi];
    const w = wake[yi * GRID_W + xi];
    if (w > 0.05 || Math.hypot(gx, gy) > 0.01) {
      p.vx += gx * 2.2 * (opts.pull ?? 1);
      p.vy += gy * 2.2 * (opts.pull ?? 1);
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
      p.stuck = Math.min(1, p.stuck + w * 0.2);
    } else {
      easeToRest(p, 0.03, 0.9);
      idleDrift(p, t, 0.35);
      p.stuck *= 0.9;
    }
  }
  const tips = assignTips(state, pointer, opts);
  if (pointer.active) holdTipOffsets(tips, pointer, opts, t, 'cluster');
}

function stepRepel(state, pointer, t, opts) {
  const radius = pullR(opts, 12);
  const r2 = radius * radius;
  for (const p of state.particles) {
    if (!pointer.active) {
      easeToRest(p, 0.04, 0.86);
      idleDrift(p, t);
      p.stuck *= 0.88;
      continue;
    }
    const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
    if (d2 < r2 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const force = (1 - d / radius) * 0.55 * (opts.snap ?? 1);
      p.vx += ((p.x - pointer.x) / d) * force;
      p.vy += ((p.y - pointer.y) / d) * force;
      p.vx *= 0.84;
      p.vy *= 0.84;
      p.x += p.vx;
      p.y += p.vy;
      p.stuck *= 0.9;
    } else {
      easeToRest(p, 0.025, 0.9);
      idleDrift(p, t, 0.3);
    }
  }
  // tip still locks to cursor as white anchors
  for (const p of state.particles) p.stuck = p.tip ? 1 : p.stuck;
  const tips = assignTips(state, pointer, { ...opts, tip: opts.tip });
  // prefer particles already near for tip assignment after repel
  if (pointer.active) holdTipOffsets(tips, pointer, opts, t, 'cluster');
}

function stepCross(state, pointer, t, opts) {
  for (const p of state.particles) {
    p.tip = false;
    if (!pointer.active) {
      easeToRest(p, 0.04, 0.86);
      idleDrift(p, t);
      p.stuck *= 0.85;
    } else {
      easeToRest(p, 0.02, 0.92);
      idleDrift(p, t, 0.25);
      p.stuck *= 0.9;
    }
  }
  if (!pointer.active) return;
  // force first N particles into cross arms (pure tip)
  const n = tipCount(opts);
  const tips = state.particles.slice(0, n);
  for (const p of tips) {
    p.tip = true;
    p.stuck = 1;
  }
  holdTipOffsets(tips, pointer, opts, t, 'cross');
}

function stepSpark(state, pointer, t, opts) {
  if (pointer.active) {
    const last = state.history[state.history.length - 1];
    const moved =
      !last || dist2(last.x, last.y, pointer.x, pointer.y) > 0.35;
    pushHistory(state, pointer, 24);
    if (moved) state.sparkT = 0.35;
  } else {
    state.sparkT *= 0.9;
  }

  const tips = assignTips(state, pointer, opts);

  if (state.sparkT > 0.05 && pointer.active) {
    state.sparkT *= 0.92;
    for (const p of tips) {
      const ang = p.phase * Math.PI * 2 + t * 4;
      const speed = 1.8 * (opts.snap ?? 1) * state.sparkT;
      p.vx += Math.cos(ang) * speed;
      p.vy += Math.sin(ang) * speed;
      p.vx *= 0.88;
      p.vy *= 0.88;
      p.x += p.vx;
      p.y += p.vy;
      p.tip = true;
      p.stuck = 1;
    }
  } else if (pointer.active) {
    holdTipOffsets(tips, pointer, opts, t, 'cluster');
  }

  for (const p of state.particles) {
    if (p.tip) continue;
    if (pointer.active) {
      easeToRest(p, 0.02, 0.92);
      idleDrift(p, t, 0.4);
    } else {
      easeToRest(p, 0.045, 0.86);
      idleDrift(p, t);
    }
    p.stuck *= 0.9;
  }
}

/** Advance simulation. opts: { tip, pull, snap } */
export function step(state, pointer, dt, timeSec, opts = DEFAULT_OPTS) {
  const d = clamp(dt, 0, 0.05);
  const t = timeSec;
  void d;
  const o = { ...DEFAULT_OPTS, ...opts };

  switch (state.variant) {
    case 'trail':
      stepTrail(state, pointer, t, o);
      break;
    case 'snake':
      stepSnake(state, pointer, t, o);
      break;
    case 'magnet':
      stepMagnetLike(state, pointer, t, o, 'magnet');
      break;
    case 'orbit':
      stepMagnetLike(state, pointer, t, o, 'orbit');
      break;
    case 'gather':
      stepMagnetLike(state, pointer, t, o, 'gather');
      break;
    case 'wake':
      stepWake(state, pointer, t, o);
      break;
    case 'repel':
      stepRepel(state, pointer, t, o);
      break;
    case 'cross':
      stepCross(state, pointer, t, o);
      break;
    case 'spark':
      stepSpark(state, pointer, t, o);
      break;
    default:
      stepTrail(state, pointer, t, o);
  }

  for (const p of state.particles) {
    p.x = clamp(p.x, -2, GRID_W + 1);
    p.y = clamp(p.y, -2, GRID_H + 1);
  }
}

/** Paint brightness grid [0..1]. Tip particles are exactly 1.0 (pure white). */
export function paint(state, grid, pointer, timeSec) {
  grid.fill(0);
  const t = timeSec;
  const twoPi = Math.PI * 2;

  if (state.variant === 'wake') {
    // only hard sparks on wake cells — no soft gray disc
    for (let i = 0; i < state.wake.length; i++) {
      if (state.wake[i] > 0.55) grid[i] = Math.max(grid[i], 0.55);
    }
  }

  for (const p of state.particles) {
    if (p.tip) {
      setMax(grid, p.x, p.y, 1);
      continue;
    }
    const flick = 0.7 + 0.3 * Math.sin(twoPi * (t * 0.35 + p.phase));
    const bri = clamp01(p.base * flick);
    setMax(grid, p.x, p.y, bri);
  }
}

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
