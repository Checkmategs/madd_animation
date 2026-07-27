#!/usr/bin/env node
/** Assert paintFrame(t=0) ≈ paintFrame(t=1) for every variant. */
import { VARIANT_IDS, GRID_W, GRID_H, paintFrame } from "./engine.js";

const a = new Float32Array(GRID_W * GRID_H);
const b = new Float32Array(GRID_W * GRID_H);
let failed = 0;

for (const id of VARIANT_IDS) {
  paintFrame(id, a, 0);
  paintFrame(id, b, 1);
  let max = 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > max) max = d;
    sum += d;
  }
  const mean = sum / a.length;
  const ok = max < 1e-6;
  console.log(
    `${ok ? "✓" : "✗"} ${id.padEnd(14)} maxΔ=${max.toFixed(6)} meanΔ=${mean.toFixed(6)}`
  );
  if (!ok) failed++;
}

if (failed) {
  console.error(`\n${failed} variant(s) not seamless.`);
  process.exit(1);
}
console.log("\nAll variants seamless at t=0 ≡ t=1.");
