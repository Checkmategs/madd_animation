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
];

export const VARIANT_META = {
  trail: { title: 'Trail', blurb: 'Swarm lags behind the cursor' },
  snake: { title: 'Snake', blurb: 'Linked pixel chain follows the tip' },
  magnet: { title: 'Magnet', blurb: 'Nearby pixels stick to the cursor' },
  orbit: { title: 'Orbit', blurb: 'Stuck pixels circle the cursor' },
  gather: { title: 'Gather', blurb: 'Cursor gathers dust; leave to release' },
  wake: { title: 'Wake', blurb: 'Brightness wake; pixels stream into it' },
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

/**
 * @typedef {{ x: number, y: number, active: boolean }} Pointer
 * @typedef {{
 *   particles: Particle[],
 *   wake: Float32Array,
 *   history: {x:number,y:number}[],
 *   variant: string,
 * }} SimState
 * @typedef {{
 *   x: number, y: number, vx: number, vy: number,
 *   restX: number, restY: number,
 *   base: number, phase: number, lag: number,
 *   angle: number, stuck: number,
 * }} Particle
 */

const COUNT_BY_VARIANT = {
  trail: 150,
  snake: 42,
  magnet: 160,
  orbit: 120,
  gather: 170,
  wake: 150,
};

export function createState(variant = 'trail', count) {
  const n = count ?? COUNT_BY_VARIANT[variant] ?? 150;
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
      base: 0.35 + rand() * 0.55,
      phase: rand(),
      lag: 0.04 + rand() * 0.22,
      angle: rand() * Math.PI * 2,
      stuck: 0,
    });
  }
  return {
    particles,
    wake: new Float32Array(GRID_W * GRID_H),
    history: [],
    variant,
  };
}

export function resetState(state, variant) {
  const next = createState(variant);
  state.particles = next.particles;
  state.wake = next.wake;
  state.history.length = 0;
  state.variant = variant;
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

function cursorLift(grid, pointer, radius = 5, peak = 0.22) {
  if (!pointer.active) return;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(pointer.x - radius));
  const x1 = Math.min(GRID_W - 1, Math.ceil(pointer.x + radius));
  const y0 = Math.max(0, Math.floor(pointer.y - radius));
  const y1 = Math.min(GRID_H - 1, Math.ceil(pointer.y + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = dist2(x, y, pointer.x, pointer.y);
      if (d2 > r2) continue;
      const w = 1 - Math.sqrt(d2) / radius;
      setMax(grid, x, y, peak * w * w);
    }
  }
}

function stepTrail(state, pointer, t) {
  pushHistory(state, pointer);
  for (const p of state.particles) {
    if (pointer.active) {
      const hp = historyPoint(state, p.lag) || pointer;
      springToward(p, hp.x, hp.y, 0.12 + (1 - p.lag) * 0.1, 0.78);
    } else {
      easeToRest(p, 0.04, 0.86);
      idleDrift(p, t);
    }
  }
}

function stepSnake(state, pointer, t) {
  const parts = state.particles;
  if (pointer.active) {
    springToward(parts[0], pointer.x, pointer.y, 0.35, 0.72);
    for (let i = 1; i < parts.length; i++) {
      const prev = parts[i - 1];
      const p = parts[i];
      const spacing = 0.85;
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const d = Math.hypot(dx, dy) || 1;
      const tx = prev.x + (dx / d) * spacing;
      const ty = prev.y + (dy / d) * spacing;
      springToward(p, tx, ty, 0.28, 0.75);
    }
  } else {
    for (const p of parts) {
      easeToRest(p, 0.035, 0.88);
      idleDrift(p, t, 0.25);
    }
  }
}

function stepMagnet(state, pointer, t) {
  const radius = 14;
  const r2 = radius * radius;
  for (const p of state.particles) {
    if (pointer.active) {
      const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 0.001;
        const pull = clamp(1 - d / radius, 0, 1);
        p.stuck = Math.min(1, p.stuck + 0.08 * pull);
        const stickR = 1.2 + (1 - p.stuck) * 3;
        const ang = Math.atan2(p.y - pointer.y, p.x - pointer.x);
        const tx = pointer.x + Math.cos(ang) * stickR * (1 - p.stuck * 0.7);
        const ty = pointer.y + Math.sin(ang) * stickR * (1 - p.stuck * 0.7);
        springToward(p, tx, ty, 0.18 + p.stuck * 0.2, 0.7);
      } else {
        p.stuck *= 0.92;
        easeToRest(p, 0.03, 0.9);
        idleDrift(p, t, 0.3);
      }
    } else {
      p.stuck *= 0.9;
      easeToRest(p, 0.045, 0.86);
      idleDrift(p, t);
    }
  }
}

function stepOrbit(state, pointer, t) {
  const n = state.particles.length;
  for (let i = 0; i < n; i++) {
    const p = state.particles[i];
    if (pointer.active) {
      const ring = 2 + (i % 5) * 1.35;
      p.angle += 0.04 + (i % 7) * 0.006;
      const tx = pointer.x + Math.cos(p.angle) * ring;
      const ty = pointer.y + Math.sin(p.angle) * ring;
      const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
      const capture = d2 < 18 * 18 || p.stuck > 0.2;
      if (capture) {
        p.stuck = Math.min(1, p.stuck + 0.06);
        springToward(p, tx, ty, 0.22, 0.76);
      } else {
        easeToRest(p, 0.03, 0.9);
        idleDrift(p, t, 0.25);
      }
    } else {
      p.stuck *= 0.88;
      easeToRest(p, 0.04, 0.86);
      idleDrift(p, t);
    }
  }
}

function stepGather(state, pointer, t) {
  const radius = 16;
  const r2 = radius * radius;
  for (const p of state.particles) {
    if (pointer.active) {
      const d2 = dist2(p.x, p.y, pointer.x, pointer.y);
      if (d2 < r2) {
        p.stuck = Math.min(1, p.stuck + 0.1);
        const jitter = (1 - p.stuck) * 2.5;
        const tx = pointer.x + Math.sin(p.phase * 40 + t * 3) * jitter;
        const ty = pointer.y + Math.cos(p.phase * 30 + t * 2.4) * jitter;
        springToward(p, tx, ty, 0.2, 0.74);
      } else if (p.stuck > 0.15) {
        // already gathered — keep clinging while cursor active
        const tx = pointer.x + Math.sin(p.phase * 20) * 1.4;
        const ty = pointer.y + Math.cos(p.phase * 17) * 1.4;
        springToward(p, tx, ty, 0.16, 0.78);
      } else {
        easeToRest(p, 0.025, 0.92);
        idleDrift(p, t, 0.4);
      }
    } else {
      p.stuck *= 0.85;
      easeToRest(p, 0.055, 0.84);
      idleDrift(p, t);
    }
  }
}

function stepWake(state, pointer, t, dt) {
  const wake = state.wake;
  // decay
  for (let i = 0; i < wake.length; i++) wake[i] *= 0.92;

  if (pointer.active) {
    const rad = 3.2;
    const x0 = Math.max(0, Math.floor(pointer.x - rad));
    const x1 = Math.min(GRID_W - 1, Math.ceil(pointer.x + rad));
    const y0 = Math.max(0, Math.floor(pointer.y - rad));
    const y1 = Math.min(GRID_H - 1, Math.ceil(pointer.y + rad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - pointer.x, y - pointer.y);
        if (d > rad) continue;
        const i = y * GRID_W + x;
        wake[i] = Math.min(1, wake[i] + (1 - d / rad) * 0.55);
      }
    }
  }

  for (const p of state.particles) {
    // sample wake gradient (cheap finite difference)
    const xi = clamp(Math.round(p.x), 1, GRID_W - 2);
    const yi = clamp(Math.round(p.y), 1, GRID_H - 2);
    const gx =
      wake[yi * GRID_W + (xi + 1)] - wake[yi * GRID_W + (xi - 1)];
    const gy =
      wake[(yi + 1) * GRID_W + xi] - wake[(yi - 1) * GRID_W + xi];
    const w = wake[yi * GRID_W + xi];

    if (w > 0.05 || Math.hypot(gx, gy) > 0.01) {
      p.vx += gx * 2.4;
      p.vy += gy * 2.4;
      if (pointer.active) {
        p.vx += (pointer.x - p.x) * 0.02;
        p.vy += (pointer.y - p.y) * 0.02;
      }
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;
    } else {
      easeToRest(p, 0.03, 0.9);
      idleDrift(p, t, 0.35);
    }
  }
}

/** Advance simulation by dt seconds (clamped). */
export function step(state, pointer, dt, timeSec) {
  const d = clamp(dt, 0, 0.05);
  const t = timeSec;
  // scale forces roughly independent of frame rate via fixed-ish steps
  void d;

  switch (state.variant) {
    case 'trail':
      stepTrail(state, pointer, t);
      break;
    case 'snake':
      stepSnake(state, pointer, t);
      break;
    case 'magnet':
      stepMagnet(state, pointer, t);
      break;
    case 'orbit':
      stepOrbit(state, pointer, t);
      break;
    case 'gather':
      stepGather(state, pointer, t);
      break;
    case 'wake':
      stepWake(state, pointer, t, d);
      break;
    default:
      stepTrail(state, pointer, t);
  }

  for (const p of state.particles) {
    p.x = clamp(p.x, -2, GRID_W + 1);
    p.y = clamp(p.y, -2, GRID_H + 1);
  }
}

/** Paint brightness grid [0..1] from state. */
export function paint(state, grid, pointer, timeSec) {
  grid.fill(0);
  const t = timeSec;
  const twoPi = Math.PI * 2;

  if (state.variant === 'wake') {
    for (let i = 0; i < state.wake.length; i++) {
      if (state.wake[i] > 0.02) grid[i] = Math.max(grid[i], state.wake[i] * 0.45);
    }
  }

  cursorLift(grid, pointer);

  for (const p of state.particles) {
    const flick = 0.75 + 0.25 * Math.sin(twoPi * (t * 0.35 + p.phase));
    let bri = p.base * flick;
    if (pointer.active) {
      const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      bri *= 1 + clamp(1 - d / 10, 0, 1) * 0.35;
    }
    if (p.stuck > 0) bri = Math.min(1, bri + p.stuck * 0.15);
    setMax(grid, p.x, p.y, clamp01(bri));
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
