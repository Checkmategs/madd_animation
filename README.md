# madd_animation

Pixel ambient FHD loops — grayscale, **square pixels**, seamless 2.5s previews.

## Live

https://checkmategs.github.io/madd_animation/

## Local

```bash
python3 -m http.server 8770
# http://localhost:8770

node render.mjs           # rebuild MP4 (+ GIF locally)
node check-loops.mjs      # assert t=0 ≡ t=1
```

## Download

- **Download MP4** — pre-rendered FHD file from `out/`
- **Download GIF** — encoded in the browser from the same engine (seamless loop)
