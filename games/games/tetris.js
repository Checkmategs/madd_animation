import { plotCell, shade } from "../render.js";

export const BOARD_W = 10;
export const BOARD_H = 20;

/** Each board cell = 2×2 grid pixels — fills most of the 96×54 field */
const CELL = 2;
const ORIGIN_X = ((96 - BOARD_W * CELL) / 2) | 0; // 38
const ORIGIN_Y = ((54 - BOARD_H * CELL) / 2) | 0; // 7

const BRI = {
  locked: 0.42,
  active: 0.52,
  ghost: 0.16,
};

const SHAPES = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
  ],
  O: [
    [
      [1, 1],
      [1, 1],
    ],
  ],
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
  ],
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
};

const BAG = ["I", "O", "T", "S", "Z", "J", "L"];

export function collides(board, matrix, ox, oy) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

export function clearLines(board) {
  const next = board.filter((row) => row.some((c) => !c));
  const lines = BOARD_H - next.length;
  while (next.length < BOARD_H) next.unshift(Array(BOARD_W).fill(0));
  return { board: next, lines };
}

function emptyBoard() {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(0));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createTetris() {
  let board = emptyBoard();
  let bag = [];
  let piece = null;
  let rot = 0;
  let px = 0;
  let py = 0;
  let dropTimer = 0;
  let moveTimer = 0;
  let holdDir = 0;
  let score = 0;
  let level = 1;
  let linesCleared = 0;
  let status = "play";

  function gravity() {
    return Math.max(0.08, 0.6 - (level - 1) * 0.05);
  }

  function nextType() {
    if (!bag.length) bag = shuffle(BAG);
    return bag.pop();
  }

  function matrixOf(type, r) {
    const frames = SHAPES[type];
    return frames[r % frames.length];
  }

  function spawn() {
    const type = nextType();
    rot = 0;
    const m = matrixOf(type, rot);
    px = ((BOARD_W - m[0].length) / 2) | 0;
    py = 0;
    piece = { type };
    if (collides(board, m, px, py)) {
      status = "over";
      piece = null;
    }
  }

  function hardReset() {
    board = emptyBoard();
    bag = [];
    score = 0;
    level = 1;
    linesCleared = 0;
    status = "play";
    dropTimer = 0;
    moveTimer = 0;
    holdDir = 0;
    spawn();
  }

  function tryMove(dx, dy) {
    if (!piece) return false;
    const m = matrixOf(piece.type, rot);
    if (!collides(board, m, px + dx, py + dy)) {
      px += dx;
      py += dy;
      return true;
    }
    return false;
  }

  function tryRotate() {
    if (!piece) return;
    const frames = SHAPES[piece.type];
    const nextRot = (rot + 1) % frames.length;
    const m = matrixOf(piece.type, nextRot);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(board, m, px + kick, py)) {
        rot = nextRot;
        px += kick;
        return;
      }
    }
  }

  function merge() {
    const m = matrixOf(piece.type, rot);
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const by = py + y;
        const bx = px + x;
        if (by >= 0 && by < BOARD_H && bx >= 0 && bx < BOARD_W) board[by][bx] = 1;
      }
    }
    const cleared = clearLines(board);
    board = cleared.board;
    if (cleared.lines) {
      const table = [0, 100, 300, 500, 800];
      score += (table[cleared.lines] || 800) * level;
      linesCleared += cleared.lines;
      level = 1 + ((linesCleared / 10) | 0);
    }
    spawn();
  }

  function ghostY() {
    if (!piece) return py;
    const m = matrixOf(piece.type, rot);
    let gy = py;
    while (!collides(board, m, px, gy + 1)) gy += 1;
    return gy;
  }

  function drawCell(grid, bx, by, v, salt = 0) {
    const gx = ORIGIN_X + bx * CELL;
    const gy = ORIGIN_Y + by * CELL;
    for (let j = 0; j < CELL; j++) {
      for (let i = 0; i < CELL; i++) {
        plotCell(grid, gx + i, gy + j, shade(v, gx + i, gy + j, salt + bx * 7 + by * 13));
      }
    }
  }

  function drawMatrix(grid, m, ox, oy, v, salt = 0) {
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) drawCell(grid, ox + x, oy + y, v, salt);
      }
    }
  }

  hardReset();

  return {
    id: "tetris",
    title: "Tetris",
    blurb: "Clear lines; level rises every 10",
    controlsHint: "A/D move · W rotate · S soft drop · P pause",
    reset: hardReset,
    update(dt, keys) {
      if (status === "over" || !piece) return;

      const dir = keys.a ? -1 : keys.d ? 1 : 0;
      if (dir !== 0) {
        if (dir !== holdDir) {
          holdDir = dir;
          tryMove(dir, 0);
          moveTimer = 0.18;
        } else {
          moveTimer -= dt;
          if (moveTimer <= 0) {
            tryMove(dir, 0);
            moveTimer = 0.1;
          }
        }
      } else {
        holdDir = 0;
        moveTimer = 0;
      }

      if (keys.wPressed) tryRotate();

      let interval = gravity();
      if (keys.s) interval = Math.min(interval, 0.05);

      dropTimer += dt;
      while (dropTimer >= interval) {
        dropTimer -= interval;
        if (!tryMove(0, 1)) {
          merge();
          break;
        }
        if (keys.s) score += 1;
      }
    },
    draw(grid) {
      for (let y = 0; y < BOARD_H; y++) {
        for (let x = 0; x < BOARD_W; x++) {
          if (board[y][x]) drawCell(grid, x, y, BRI.locked, 40);
        }
      }

      if (piece) {
        const m = matrixOf(piece.type, rot);
        drawMatrix(grid, m, px, ghostY(), BRI.ghost, 9);
        drawMatrix(grid, m, px, py, BRI.active, piece.type.charCodeAt(0));
      }
    },
    getHud() {
      return { score, level, lives: null, status };
    },
  };
}
