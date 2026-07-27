#!/usr/bin/env node
/**
 * Offline render: PPM frames (low-res) → ffmpeg nearest upscale → GIF + MP4
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  VARIANT_IDS,
  GRID_W,
  GRID_H,
  FRAME_COUNT,
  FPS,
  paintFrame,
  gridToRgb,
} from "./engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "out");
const FRAMES_ROOT = join(__dirname, "frames");

function writePpm(path, rgb) {
  const header = Buffer.from(`P6\n${GRID_W} ${GRID_H}\n255\n`, "ascii");
  return writeFile(path, Buffer.concat([header, Buffer.from(rgb)]));
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

async function renderVariant(id) {
  const dir = join(FRAMES_ROOT, id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const grid = new Float32Array(GRID_W * GRID_H);
  const rgb = new Uint8ClampedArray(GRID_W * GRID_H * 3);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const tNorm = i / FRAME_COUNT;
    paintFrame(id, grid, tNorm);
    gridToRgb(grid, rgb);
    const name = `frame_${String(i).padStart(4, "0")}.ppm`;
    await writePpm(join(dir, name), rgb);
  }

  const pattern = join(dir, "frame_%04d.ppm");
  const gifPath = join(OUT_DIR, `${id}.gif`);
  const mp4Path = join(OUT_DIR, `${id}.mp4`);

  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    pattern,
    "-vf",
    "scale=1920:1080:flags=neighbor,split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=full[p];[s1][p]paletteuse=dither=none:new=1",
    "-loop",
    "0",
    gifPath,
  ]);

  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    pattern,
    "-vf",
    "scale=1920:1080:flags=neighbor",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  return { gifPath, mp4Path };
}

await mkdir(OUT_DIR, { recursive: true });
const only = process.argv[2];
const ids = only ? [only] : VARIANT_IDS;
if (only && !VARIANT_IDS.includes(only)) {
  console.error(`Unknown variant "${only}". Use: ${VARIANT_IDS.join(", ")}`);
  process.exit(1);
}

for (const id of ids) {
  console.log(`\n→ Rendering ${id} (${FRAME_COUNT} frames @ ${FPS}fps)…`);
  const { gifPath, mp4Path } = await renderVariant(id);
  console.log(`✓ ${gifPath}`);
  console.log(`✓ ${mp4Path}`);
}

console.log("\nDone.");
