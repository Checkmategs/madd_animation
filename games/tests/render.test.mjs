import assert from "node:assert/strict";
import {
  GRID_W,
  GRID_H,
  CELL,
  OUT_W,
  OUT_H,
  clearGrid,
  setCell,
  gridToRgb,
  upscaleNearest,
} from "../render.js";

assert.equal(GRID_W * CELL, OUT_W);
assert.equal(GRID_H * CELL, OUT_H);
assert.equal(OUT_W, 1920);
assert.equal(OUT_H, 1080);

const grid = new Float32Array(GRID_W * GRID_H);
clearGrid(grid);
setCell(grid, 0, 0, 1);
const rgb = new Uint8ClampedArray(GRID_W * GRID_H * 3);
gridToRgb(grid, rgb);
assert.ok(rgb[0] > 200);

const rgba = new Uint8ClampedArray(OUT_W * OUT_H * 4);
upscaleNearest(rgb, rgba);
assert.equal(rgba[3], 255);
assert.equal(rgba[0], rgb[0]);
console.log("render.test.mjs OK");
