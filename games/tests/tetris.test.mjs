import assert from "node:assert/strict";
import { collides, clearLines, BOARD_W, BOARD_H } from "../games/tetris.js";

const empty = () => Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(0));

const board = empty();
const piece = [
  [1, 1],
  [1, 1],
]; // O
assert.equal(collides(board, piece, 0, 0), false);
assert.equal(collides(board, piece, -1, 0), true);

const full = empty();
full[BOARD_H - 1] = Array(BOARD_W).fill(1);
const { lines, board: next } = clearLines(full);
assert.equal(lines, 1);
assert.ok(next[BOARD_H - 1].every((c) => c === 0));
console.log("tetris.test.mjs OK");
