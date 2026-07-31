import { plotCell, plotRow, shade } from "../render.js";

const PLAY_L = 8;
const PLAY_R = 88;
const PLAY_T = 7;
const PLAY_B = 51;
const PADDLE_Y = 49;
const PADDLE_W = 10;
const PADDLE_H = 1; // never taller than 1px

const BRI = {
  paddle: 0.5,
  ball: 0.48,
  brick: [0.28, 0.38, 0.48],
};

function makeBricks(level) {
  const bricks = [];
  const cols = 10;
  const rows = 5;
  const bw = 6;
  const bh = 1;
  const startX = 14;
  const startY = 10;
  for (let r = 0; r < rows; r++) {
    const hp = Math.min(3, 1 + ((rows - 1 - r + (level - 1)) % 3));
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: startX + c * (bw + 1),
        y: startY + r * 2, // 1px brick + 1px gap
        w: bw,
        h: bh,
        hp,
        salt: r * 17 + c * 3 + level,
      });
    }
  }
  return bricks;
}

export function createBreakout() {
  let paddleX = 43;
  let ballX = 48;
  let ballY = PADDLE_Y - 1;
  let vx = 0;
  let vy = 0;
  let stuck = true;
  let bricks = [];
  let lives = 3;
  let level = 1;
  let score = 0;
  let status = "play";
  let speed = 38;

  function resetBall() {
    stuck = true;
    ballX = paddleX + PADDLE_W / 2;
    ballY = PADDLE_Y - 1;
    vx = 0;
    vy = 0;
  }

  function hardReset() {
    lives = 3;
    level = 1;
    score = 0;
    status = "play";
    speed = 38;
    paddleX = 43;
    bricks = makeBricks(level);
    resetBall();
  }

  function launch() {
    if (!stuck || status === "over") return;
    stuck = false;
    const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  }

  function bouncePaddle() {
    const hit = (ballX - paddleX) / PADDLE_W;
    const angle = -Math.PI / 2 + (hit - 0.5) * 1.2;
    const sp = Math.hypot(vx, vy) || speed;
    vx = Math.cos(angle) * sp;
    vy = Math.sin(angle) * sp;
    if (vy > 0) vy = -vy;
    ballY = PADDLE_Y - 1;
  }

  hardReset();

  return {
    id: "breakout",
    title: "Breakout",
    blurb: "Bounce the ball; bricks take 1–3 hits",
    controlsHint: "A/D paddle · W launch · P pause",
    reset: hardReset,
    update(dt, keys) {
      if (status === "over") return;

      if (keys.a) paddleX -= 48 * dt;
      if (keys.d) paddleX += 48 * dt;
      paddleX = Math.max(PLAY_L, Math.min(PLAY_R - PADDLE_W, paddleX));

      if (stuck) {
        ballX = paddleX + PADDLE_W / 2;
        ballY = PADDLE_Y - 1;
        if (keys.wPressed) launch();
        return;
      }

      ballX += vx * dt;
      ballY += vy * dt;

      if (ballX < PLAY_L) {
        ballX = PLAY_L;
        vx = Math.abs(vx);
      } else if (ballX > PLAY_R) {
        ballX = PLAY_R;
        vx = -Math.abs(vx);
      }
      if (ballY < PLAY_T) {
        ballY = PLAY_T;
        vy = Math.abs(vy);
      }

      if (
        ballY >= PADDLE_Y - 0.5 &&
        ballY <= PADDLE_Y + PADDLE_H &&
        ballX >= paddleX &&
        ballX <= paddleX + PADDLE_W &&
        vy > 0
      ) {
        bouncePaddle();
      }

      if (ballY > PLAY_B) {
        lives -= 1;
        if (lives <= 0) status = "over";
        else resetBall();
        return;
      }

      for (const b of bricks) {
        if (b.hp <= 0) continue;
        if (
          ballX >= b.x &&
          ballX < b.x + b.w &&
          ballY >= b.y - 0.35 &&
          ballY < b.y + b.h + 0.35
        ) {
          const prevHp = b.hp;
          b.hp -= 1;
          score += 10 * prevHp * level;
          const dl = ballX - b.x;
          const dr = b.x + b.w - ballX;
          const dtb = Math.abs(ballY - b.y);
          const db = Math.abs(b.y + b.h - ballY);
          const m = Math.min(dl, dr, dtb, db);
          if (m === dl || m === dr) vx *= -1;
          else vy *= -1;
          break;
        }
      }

      if (bricks.every((b) => b.hp <= 0)) {
        level += 1;
        speed *= 1.08;
        bricks = makeBricks(level);
        resetBall();
      }
    },
    draw(grid) {
      plotRow(grid, paddleX | 0, PADDLE_Y, PADDLE_W, BRI.paddle, 11);
      plotCell(grid, ballX | 0, ballY | 0, shade(BRI.ball, ballX | 0, ballY | 0, 7));

      for (const b of bricks) {
        if (b.hp <= 0) continue;
        const v = BRI.brick[Math.min(3, Math.max(1, b.hp)) - 1];
        plotRow(grid, b.x, b.y, b.w, v, b.salt);
      }
    },
    getHud() {
      return { score, level, lives, status };
    },
  };
}
