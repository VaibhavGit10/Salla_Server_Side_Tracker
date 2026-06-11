# MarketOne — Brand / App Icon

App icon for **MarketOne** (the Salla server-side conversion-tracking app).

## Concept — "Growth Pulse"
A bold upward signal arrow climbing over a faint analytics chart, anchored by a
glowing cyan **signal node** at its origin. It tells the product story: purchase
signals are recovered and routed server-side → conversions and **ROAS rise**.
Brand palette: magenta `#E01C7A` → violet `#762CF0` → blue `#1460FF`, with a
cyan `#0DCAF0` accent (matches the web app's `--accent`/`--blue`/`--cyan` tokens).

## Files

| File | Size | Format | Use |
|---|---|---|---|
| `marketone-salla-4096.png` | 4096² | PNG, **opaque, square** | **Salla Partner Portal — max HD upload** |
| `marketone-salla-2048.png` | 2048² | PNG, opaque, square | Salla upload (HD) |
| `marketone-salla-1024.png` | 1024² | PNG, opaque, square | Salla upload (standard) |
| `marketone-salla-512.png`  | 512²  | PNG, opaque, square | Salla upload (min recommended) |
| `marketone-icon-4096.png`  | 4096² | PNG, rounded, transparent | HD master / app stores that mask corners |
| `marketone-icon-1024/512/192.png` | — | PNG, rounded, transparent | Web app / PWA icons |
| `marketone-favicon.ico`    | 16/32/48/64 | ICO | Browser favicon |
| `marketone-icon.svg`       | vector | SVG | Scalable source / web favicon |
| `make_icon.py`             | — | script | Regenerate every file from one 8192² master |

## Uploading to Salla
On the app page (App Details), click **Edit App Icon** and upload
**`marketone-salla-512.png`** (or a larger `-1024`/`-4096` if the field accepts it).
These are square, opaque PNGs — Salla applies its own rounded corners, so no
transparency is needed. Keep under Salla's max upload size (≈2 MB; the 4096 file
is ~1.6 MB).

## Regenerate
```bash
cd brand
python3 make_icon.py        # needs Python 3 + Pillow + numpy
```
The script renders a single 8192×8192 supersampled master and downscales (LANCZOS)
to every size, so all outputs stay pixel-consistent. Edit colors/geometry at the
top of `make_icon.py`. `marketone-icon.svg` is the hand-authored vector twin.

## Wired into the web client
`web-client/public/` already uses these assets: `favicon.ico`, `logo192.png`,
`logo512.png`, `apple-touch-icon.png`, `marketone-icon.svg`, plus updated
`manifest.json` (name → *MarketOne*, theme `#7B2FF7`) and `index.html` title/meta.
