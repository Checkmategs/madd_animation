import {
  GRID_W,
  GRID_H,
  OUT_W,
  OUT_H,
  clearGrid,
  paintDriftBg,
  gridToRgb,
  upscaleNearest,
} from "./render.js";

/**
 * @param {{ canvas: HTMLCanvasElement, bar: HTMLElement, games: import('./games/types.js').Game[], defaultId?: string }} opts
 */
export function startShell({ canvas, bar, games, defaultId = "space" }) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const ids = games.map((g) => g.id);

  const params = new URLSearchParams(location.search);
  let gameId = params.get("g") || defaultId;
  if (!byId.has(gameId)) gameId = ids[0];

  let game = byId.get(gameId);
  game.reset();

  let paused = false;
  const keys = {
    a: false,
    d: false,
    w: false,
    s: false,
    wPressed: false,
    sPressed: false,
  };

  const ctx = canvas.getContext("2d", { alpha: false });
  const img = ctx.createImageData(OUT_W, OUT_H);
  const grid = new Float32Array(GRID_W * GRID_H);
  const rgb = new Uint8ClampedArray(GRID_W * GRID_H * 3);

  canvas.tabIndex = 0;

  const meta = document.createElement("div");
  meta.className = "meta";
  const blurb = document.createElement("span");
  blurb.className = "blurb";
  const hint = document.createElement("span");
  hint.className = "blurb";
  const statusEl = document.createElement("span");
  statusEl.className = "blurb";
  meta.append(blurb, hint, statusEl);
  bar.appendChild(meta);

  const gameButtons = [];
  for (const g of games) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = g.title;
    b.dataset.id = g.id;
    b.addEventListener("click", () => switchGame(g.id));
    bar.appendChild(b);
    gameButtons.push(b);
  }

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.textContent = "Pause";
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    syncUi();
    canvas.focus();
  });
  bar.appendChild(pauseBtn);

  const restartBtn = document.createElement("button");
  restartBtn.type = "button";
  restartBtn.textContent = "Restart";
  restartBtn.addEventListener("click", () => {
    paused = false;
    game.reset();
    syncUi();
    canvas.focus();
  });
  bar.appendChild(restartBtn);

  function syncUrl() {
    const q = new URLSearchParams();
    q.set("g", gameId);
    history.replaceState(null, "", `?${q}`);
  }

  function syncUi() {
    for (const b of gameButtons) {
      b.classList.toggle("active", b.dataset.id === gameId);
    }
    blurb.textContent = game.blurb;
    hint.textContent = game.controlsHint;
    const hud = game.getHud();
    if (paused) statusEl.textContent = "Paused";
    else if (hud.status === "over") statusEl.textContent = "Game over — W or Restart";
    else {
      const lives = hud.lives != null ? ` · lives ${hud.lives}` : "";
      statusEl.textContent = `score ${hud.score} · lv ${hud.level}${lives}`;
    }
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  function switchGame(id) {
    if (!byId.has(id)) return;
    gameId = id;
    game = byId.get(id);
    paused = false;
    game.reset();
    syncUrl();
    syncUi();
    canvas.focus();
  }

  syncUrl();
  syncUi();

  function onKey(e, down) {
    const code = e.code;
    if (code === "KeyA") keys.a = down;
    else if (code === "KeyD") keys.d = down;
    else if (code === "KeyW") {
      if (down && !keys.w) keys.wPressed = true;
      keys.w = down;
    } else if (code === "KeyS") {
      if (down && !keys.s) keys.sPressed = true;
      keys.s = down;
    } else if (code === "KeyP" && down) {
      paused = !paused;
      syncUi();
      e.preventDefault();
      return;
    } else return;
    e.preventDefault();
  }

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  canvas.addEventListener("pointerdown", () => canvas.focus());

  let last = performance.now();
  const t0 = last;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const timeSec = (now - t0) / 1000;

    const hudBefore = game.getHud();
    if (hudBefore.status === "over" && keys.wPressed) {
      game.reset();
      paused = false;
    }

    if (!paused && game.getHud().status !== "over") {
      game.update(dt, keys);
    }

    keys.wPressed = false;
    keys.sPressed = false;

    clearGrid(grid);
    game.draw(grid, GRID_W, GRID_H);
    paintDriftBg(grid, timeSec);
    gridToRgb(grid, rgb);
    upscaleNearest(rgb, img.data);
    ctx.putImageData(img, 0, 0);

    const hud = game.getHud();
    let statusText;
    if (paused) statusText = "Paused";
    else if (hud.status === "over") statusText = "Game over — W or Restart";
    else {
      const lives = hud.lives != null ? ` · lives ${hud.lives}` : "";
      statusText = `score ${hud.score} · lv ${hud.level}${lives}`;
    }
    if (statusEl.textContent !== statusText) statusEl.textContent = statusText;

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  canvas.focus();
}
