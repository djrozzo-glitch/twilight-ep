# Twilight game assets

- **Background** — `backgrounds/london-alley.webp` (1122 × 1402). Keep the alley centered when cropping.
- **DJ** — `dj-idle.png` and `dj-hit.png` share the same framing. Anchor both frames at bottom center and align the deck's collision line once.
- **Clubbers** — `clubber-vip.png`, `clubber-influencer.png`, `clubber-puffer.png` and `clubber-lime.png`. Anchor at bottom center. These are single stride poses. A walking cycle can use additional frames.
- **Projectile** — `vinyl.png` and `vinyl-charged.png`. Anchor and rotate around the center.
- **Bonuses and effects** — `bonus-dubplate.png`, `bonus-stack.png`, `bonus-rewind.png`, and `fx-impact.png`. Center the impact on the contact point.
- **Source sheets** — Two RGBA sheets, each 1254 × 1254. Column boundaries at x=418 and x=836. Row divider at y=605 for characters and y=627 for items. Files in `sprites/` are already sliced with transparent padding.

The art pack is separate from the game code.
