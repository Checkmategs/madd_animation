# madd_animation

Pixel ambient FHD loops — grayscale, **square pixels**, seamless previews.

## Live

- Ambient: https://checkmategs.github.io/madd_animation/
- Cursor interactive: https://checkmategs.github.io/madd_animation/cursor/
- Games: https://checkmategs.github.io/madd_animation/games/

## Controls

- Pick a variant
- Set **Speed** (0.5×–2×) — updates the live preview
- **Download GIF** / **Download MP4** — encoded at the selected speed

## Local

```bash
python3 -m http.server 8770
node render.mjs
node check-loops.mjs
```
