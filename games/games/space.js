import { plotCell, plotRow, shade } from "../render.js";

const PLAY_L = 4;
const PLAY_R = 92;
const SHIP_Y = 48;
const SHIP_W = 5;

const BRI = {
  ship: 0.52,
  alien: 0.4,
  shelterHi: 0.34,
  shelterLo: 0.22,
  bullet: 0.48,
  alienBullet: 0.42,
};

function makeWave(level) {
  const rows = Math.min(5, 3 + Math.floor((level - 1) / 2));
  const cols = Math.min(10, 8 + Math.floor((level - 1) / 3));
  const aliens = [];
  const startX = 8;
  const startY = 8;
  const gapX = 8;
  const gapY = 3; // 1px aliens + gaps
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      aliens.push({
        alive: true,
        x: startX + c * gapX,
        y: startY + r * gapY,
        salt: r * 13 + c * 5,
      });
    }
  }
  return aliens;
}

function makeShelters() {
  const shelters = [];
  const bases = [14, 34, 54, 74];
  for (const bx of bases) {
    for (let dx = 0; dx < 6; dx++) {
      if (dx === 2 || dx === 3) continue; // gap under
      shelters.push({ x: bx + dx, y: 42, hp: 2, salt: bx + dx });
    }
  }
  return shelters;
}

function drawAlien(grid, x, y, salt) {
  plotRow(grid, x, y, 3, BRI.alien, salt);
}

function drawShip(grid, x, y) {
  plotRow(grid, x, y, SHIP_W, BRI.ship, 19);
}

export function createSpace() {
  let shipX = 45;
  /** @type {{x:number,y:number}[]} */
  let bullets = [];
  /** @type {{x:number,y:number}[]} */
  let alienBullets = [];
  /** @type {{alive:boolean,x:number,y:number,salt:number}[]} */
  let aliens = [];
  /** @type {{x:number,y:number,hp:number,salt:number}[]} */
  let shelters = [];
  let dir = 1;
  let stepTimer = 0;
  let shootCd = 0;
  let alienShootTimer = 0;
  let lives = 3;
  let level = 1;
  let score = 0;
  let status = "play";

  function stepInterval() {
    return Math.max(0.15, 0.55 - level * 0.04);
  }

  function resetWave() {
    aliens = makeWave(level);
    shelters = makeShelters();
    bullets = [];
    alienBullets = [];
    dir = 1;
    stepTimer = 0;
    shootCd = 0;
    alienShootTimer = 0.8;
    shipX = 45;
  }

  function hardReset() {
    lives = 3;
    level = 1;
    score = 0;
    status = "play";
    resetWave();
  }

  function hitShelter(x, y) {
    const xi = x | 0;
    const yi = y | 0;
    for (const s of shelters) {
      if (s.hp > 0 && s.x === xi && s.y === yi) {
        s.hp -= 1;
        return true;
      }
    }
    return false;
  }

  function aliveAliens() {
    return aliens.filter((a) => a.alive);
  }

  return {
    id: "space",
    title: "Space",
    blurb: "Invaders march; clear waves, duck behind shelters",
    controlsHint: "A/D move · W shoot · P pause",
    reset: hardReset,
    update(dt, keys) {
      if (status === "over") return;

      if (keys.a) shipX -= 32 * dt;
      if (keys.d) shipX += 32 * dt;
      shipX = Math.max(PLAY_L, Math.min(PLAY_R - SHIP_W, shipX));

      shootCd = Math.max(0, shootCd - dt);
      if (keys.wPressed && shootCd <= 0 && bullets.length < 2) {
        bullets.push({ x: shipX + 2, y: SHIP_Y - 1 });
        shootCd = 0.22;
      }

      for (const b of bullets) b.y -= 40 * dt;
      bullets = bullets.filter((b) => {
        if (b.y < 6) return false;
        if (hitShelter(b.x, b.y)) return false;
        for (const a of aliens) {
          if (!a.alive) continue;
          if (b.x >= a.x && b.x < a.x + 3 && (b.y | 0) === (a.y | 0)) {
            a.alive = false;
            score += 10 * level;
            return false;
          }
        }
        return true;
      });

      stepTimer += dt;
      if (stepTimer >= stepInterval()) {
        stepTimer = 0;
        let hitEdge = false;
        for (const a of aliveAliens()) {
          const nx = a.x + dir * 2;
          if (nx < PLAY_L || nx + 3 > PLAY_R) hitEdge = true;
        }
        if (hitEdge) {
          dir *= -1;
          for (const a of aliens) {
            if (a.alive) a.y += 2;
          }
        } else {
          for (const a of aliens) {
            if (a.alive) a.x += dir * 2;
          }
        }
      }

      alienShootTimer -= dt;
      if (alienShootTimer <= 0) {
        alienShootTimer = Math.max(0.45, 1.2 - level * 0.08);
        const cols = new Map();
        for (const a of aliveAliens()) {
          const cx = a.x | 0;
          const prev = cols.get(cx);
          if (!prev || a.y > prev.y) cols.set(cx, a);
        }
        const bottoms = [...cols.values()];
        if (bottoms.length) {
          const shooter = bottoms[(Math.random() * bottoms.length) | 0];
          alienBullets.push({ x: shooter.x + 1, y: shooter.y + 1 });
        }
      }

      for (const b of alienBullets) b.y += 28 * dt;
      alienBullets = alienBullets.filter((b) => {
        if (b.y > 52) return false;
        if (hitShelter(b.x, b.y)) return false;
        if (
          b.x >= shipX &&
          b.x < shipX + SHIP_W &&
          (b.y | 0) === SHIP_Y
        ) {
          lives -= 1;
          bullets = [];
          alienBullets = [];
          shipX = 45;
          if (lives <= 0) status = "over";
          return false;
        }
        return true;
      });

      for (const a of aliveAliens()) {
        if (a.y >= SHIP_Y) {
          status = "over";
          lives = 0;
          break;
        }
      }

      if (status === "play" && aliveAliens().length === 0) {
        level += 1;
        score += 50 * level;
        resetWave();
      }
    },
    draw(grid) {
      drawShip(grid, shipX | 0, SHIP_Y);

      for (const a of aliens) {
        if (!a.alive) continue;
        drawAlien(grid, a.x | 0, a.y | 0, a.salt);
      }

      for (const s of shelters) {
        if (s.hp <= 0) continue;
        const base = s.hp >= 2 ? BRI.shelterHi : BRI.shelterLo;
        plotCell(grid, s.x, s.y, shade(base, s.x, s.y, s.salt));
      }

      for (const b of bullets) {
        plotCell(grid, b.x | 0, b.y | 0, shade(BRI.bullet, b.x | 0, b.y | 0, 3));
      }
      for (const b of alienBullets) {
        plotCell(grid, b.x | 0, b.y | 0, shade(BRI.alienBullet, b.x | 0, b.y | 0, 5));
      }
    },
    getHud() {
      return { score, level, lives, status };
    },
  };
}
