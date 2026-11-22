# Twilight arcade assets

All images in `sprites/` are separate PNGs with transparent backgrounds.
Both original sheets are included under `source-sheets/`.

## Pickups
256 × 256 px, centered anchor (128, 128). Cyan and lime indicate bonuses.
Magenta diamonds indicate temporary hazards. Game effect tokens:

- `b` Brake — bonus-brake.png
- `c` Charge — bonus-charge.png
- `m` Half Size — hazard-half-size.png
- `l` Reverse — hazard-reverse.png
- `w` Warp — hazard-warp.png
- `u` Rush — hazard-rush.png

## Characters
352 × 640 px, bottom-center anchor at (176, 632). Use alpha bounds for
collision dimensions if needed. Each is a single stride pose.

- Normie — enemy-normie.png
- Neighbour — enemy-neighbour.png
- Office Commuter — enemy-office.png
- Residents’ Chair — enemy-residents-chair.png
- Club Promoter — enemy-promoter.png
- Noise Inspector — enemy-noise-inspector.png
