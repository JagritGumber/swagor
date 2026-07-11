---
name: color-ramps
description: Selbo design system color ramps, spacing/gap ramps, font ramp, and usage rules. Reference for consistent token choice across the landing page and app UI.
metadata:
  audience: design, engineering
  scope: selbo-design-system
---

## Color system

### Landing page (brand surface — dark)
| Token | OKLCH | Usage |
|-------|-------|-------|
| `--surface-page` | `oklch(0.08 0.01 250)` | #0a0e14 — page canvas |
| `--text-heading` | `oklch(1 0 0)` | #ffffff — headings, nav text |
| `--text-body` | `oklch(0.58 0.03 250)` | #8892a4 — body, muted labels |
| `--accent-cyan` | `oklch(0.7 0.18 220)` | #00d4ff — CTAs, highlights, links |
| `--accent-cyan-pressed` | `oklch(0.6 0.22 220)` | #00b8e6 — hover state |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Section dividers |
| `--border-accent` | `rgba(0,212,255,0.3)` | Tagline, badge borders |

### Chart / Portfolio (product surface — light)
| Token | Hex | Usage |
|-------|-----|-------|
| `--surface-body` | `#ECF1F8` | Page canvas |
| `--surface-header` | `#FFFFFF` | Top header |
| `--surface-widget` | `#FFFFFF` | Widget card |
| `--text-primary` | `#00234E` | Headings, data values |
| `--text-secondary` | `#00234E` | Body, context |
| `--accent-blue` | `#004293` | Brand accent, badges |
| `--positive` | `#00B86B` | Upward drift |
| `--negative` | `#E54040` | Downward drift |

Full color system is documented in `start/` Tailwind tokens.

## Font ramp

| Element | Size | Weight | Ramp step |
|---------|------|--------|-----------|
| h1 (hero) | 48px | 700 | 48 |
| h2 (section) | 32px | 600 | 32 |
| Body | 16px | 400 | 16 |
| Small / label | 14px | 500 | 14 |
| Micro / badge | 11px | 600 | 11 |
| Tagline | 11px | 600 | 11 |

Steps correspond to: 64, 48, 32, 24, 16, 14, 11.  
Use the nearest step. Do not interpolate arbitrary sizes.

## Gap ramp

| Level | Value | Where |
|-------|-------|-------|
| Section | 48px | Between major sections (hero → features → footer) |
| Group | 24px | Between related content groups |
| Cluster | 16px | Between related elements in a group |
| Tight | 8px | Between tightly-coupled elements (heading → subtitle) |

### Hero content vertical gaps (applied)
| Edge | Gap |
|------|-----|
| tagline → title | 16 (cluster) |
| title → description | 8 (tight) |
| description → actions | 16 (cluster) |
| actions → trust | 16 (cluster) |

## Typography families

| Role | Family |
|------|--------|
| UI (landing + app) | `Inter`, system-ui, sans-serif |
| Data (app only) | `JetBrains Mono`, ui-monospace, monospace |

Inter is the single family for UI. No pairing needed.

## Contrast verification

### Landing page
- `#ffffff` on `#0a0e14` — ~15.5:1 (AAA)
- `#8892a4` on `#0a0e14` — ~4.7:1 (AA body)
- `#00d4ff` on `#0a0e14` — ~5.2:1 (AA large text)

### Portfolio page
- `#00234E` on `#FFFFFF` — ~16:1 (AAA)
- `#00234E` on `#ECF1F8` — ~14:1 (AAA)
- `#004293` on `#FFFFFF` — ~8:1 (AAA)
- `#00B86B` on `#FFFFFF` — ~3.5:1 (AA large only — acceptable for data indicators)
- `#E54040` on `#FFFFFF` — ~4:1 (AA large only)

## Button padding rule

- y-padding divisible by 4
- x-padding = 2× y-padding
- Examples: 14×28, 16×32, 12×24

## Spacing

- `12px` nav gap (logo + badge)
- `32px` nav link gap
- `16px` button gap
- `48px` horizontal page padding (max-width 1280px)
- `60px 48px 80px` hero section padding (top, sides, bottom)
- Section border-top: `1px solid rgba(255, 255, 255, 0.06)`
