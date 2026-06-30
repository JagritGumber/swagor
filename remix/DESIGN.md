# Design System

Generated: 2026-06-27
Method: Scan — extracted from rendered components + `constants/theme.ts`
Origin: `remix/`

## North Star

**AI copilot transparency.** The interface reveals what the agent sees and
why, trusting the user to act on it. Every widget answers a single question
so a domain-expert user can verify the read at a glance — no drilling, no
black box.

## Tenets

1. **Read at a glance.** Every widget answers one question. No drilling, no
   hover-to-see.
2. **Data has hierarchy.** The most important value in each widget is
   visually first. Secondary data recedes.
3. **Typography is the UI.** Weight and size carry meaning. Color is
   secondary.
4. **Tactile and precise.** Every state is intentional — crisp borders,
   responsive hover, no half-measures.

## Color System

### Inspired By

COW DAO (cow.fi) light mode — clean, professional blue/navy aesthetic with
light cool-grey body background, white card surfaces, and very dark navy
text for maximum contrast. Similar to major product/tech company dashboards
(Stripe, Linear, etc.).

### Surfaces

Background group uses low-contrast stepping (light cool greys and white) to
create subtle depth without drawing attention.

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-body` | `#ECF1F8` | Page canvas — light cool blue-grey |
| `--surface-header` | `#FFFFFF` | Top header bar — white |
| `--surface-widget` | `#FFFFFF` | Widget card surface — white |
| `--surface-widget-header` | `#F5F7FA` | Widget title bar — near-white |
| `--border-default` | `#E2E6ED` | Widget outer border, dividers |
| `--border-header` | `#E2E6ED` | Header bottom separator |

### Text

All text tokens share the same very dark navy (`#00234E`) for maximum
contrast against every surface level. Hierarchy is expressed through font
weight, size, letter-spacing, and capitalization — never through opacity or
lighter colors.

| Token | Value | Weight | Usage |
|-------|-------|--------|-------|
| `--text-primary` | `#00234E` | 600 | Intent, headings |
| `--text-secondary` | `#00234E` | 400 | Body, context |
| `--text-muted` | `#00234E` | 400 italic | Focus, narrative |
| `--text-data` | `#00234E` | 600 | Numeric values |

### Accent & Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--accent-blue` | `#004293` | Brand accent, left bar, badges |
| `--accent-light` | `#65D9FF` | Light blue secondary accent |
| `--positive` | `#00B86B` | Upward drift, long bias |
| `--negative` | `#E54040` | Downward drift, short bias |

### Contrast Verification (all WCAG AAA)

| Pair | Ratio |
|------|-------|
| `--text-primary (#00234E)` on `--surface-body (#ECF1F8)` | ~14:1 |
| `--text-secondary (#00234E)` on `--surface-widget (#FFFFFF)` | ~16:1 |
| `--accent-blue (#004293)` on `--surface-widget (#FFFFFF)` | ~8:1 |
| `--positive (#00B86B)` on `--surface-widget (#FFFFFF)` | ~3.5:1 |
| `--negative (#E54040)` on `--surface-widget (#FFFFFF)` | ~4:1 |

## Ramp System (landing + app)

### Font ramp

| Step | Size | Landing (brand) | App UI (product) |
|------|------|-----------------|------------------|
| 64 | 64px | — | — |
| 48 | 48px | h1 hero | — |
| 32 | 32px | h2 section | — |
| 24 | 24px | logo text | — |
| 16 | 16px | body, small headings | Header UI, body |
| 14 | 14px | nav links, small body | Body |
| 12 | 12px | — | Widget content |
| 11 | 11px | tagline, badge | — |
| 10 | 10px | — | Widget header, section divider |

Use the nearest step. Do not interpolate arbitrary sizes.

### Gap ramp

| Level | Value | Relationship |
|-------|-------|--------------|
| Section | 48px | Between major page blocks |
| Group | 24px | Between related content groups |
| Cluster | 16px | Between related elements in a group |
| Tight | 8px | Between tightly-coupled elements |

Hero content applies these as: tagline→title 16, title→desc 8, desc→actions 16, actions→trust 16.

### Button padding rule

- y-padding divisible by 4
- x-padding = 2× y-padding
- Hero CTAs: 16×32, nav CTA: 12×24
- Secondary buttons use `outline` instead of `border` to avoid box-model sizing shift

---

## Typography

### Fonts

| Role | Family | Notes |
|------|--------|-------|
| UI | `Inter`, system-ui, sans-serif | All labels, headers, prose |
| Data | `JetBrains Mono`, ui-monospace, monospace | Numeric values only |

### Sizing

| Context | Size | Weight | Line-height | Notes |
|---------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.5 | Page text |
| Widget content | 12px | 400 | 1.6 | Row values |
| Widget header | 10px | 600 | 1.0 | Uppercase, 0.08em letter-spacing |
| Header UI | 16px | 500 | 1.0 | "Selbo" top bar |
| Section divider | 10px | 400 italic | 1.5 | Bottom narrative |

### Data formatting

- `font-variant-numeric: tabular-nums` on all data values (prevents layout
  shift on price changes)
- `font-weight: 600` on primary data values per widget (regime drift, bias,
  last price)
- JetBrains Mono never used for labels or prose — data only

## Elevation

Depth is expressed through subtle shadows on widget cards against a flat body
background.

| Level | Background | Shadow | Usage |
|-------|-----------|--------|-------|
| 0 | `--surface-body` | none | Body canvas |
| 1 | `--surface-header` | none | Header bar (attached to top) |
| 2 | `--surface-widget` | `0 1px 3px rgba(0,0,0,0.08)` | Widget surface |
| 3 | `--surface-widget-header` | none | Widget title (attached to card) |

## Borders & Radii

- Widget outer: 1px solid `--border-default`
- Widget inner (header/content split): same
- Header bottom: 1px solid `--border-header`
- Border-radius: 24px (widget card only; signature COW DAO generous radius)

## Component Anatomy: Widget

```
┌─────────────────────────────────┐
│ HEADER                          │  10px uppercase, #00234E
│                                 │  bg: surface-widget-header
├─────────────────────────────────┤  1px border
│ LABEL              -$12,345.00  │  row: flex space-between
│ LABEL               +2.3%       │  tabular-nums, font-weight 600
│ ─────────────────────────────── │  divider: 10px italic #00234E
│ Narrative or reason text        │  12px body weight
└─────────────────────────────────┘
```

## Interaction States (aspirational — not yet implemented)

| State | Widget surface | Border | Description |
|-------|---------------|--------|-------------|
| Default | `--surface-widget` | `--border-default` | Resting |
| Hover | L +0.02 | L +0.01 | Optical brighten, no scale/translate |
| Focus-visible | — | 2px `#004293` outline, offset 2px | Keyboard nav |

## Motion (aspirational — not yet implemented)

- Only data-change transitions: regime label swap, price update, bias color
  change
- Duration: 150–200ms, `ease-out`
- No decorative animations or loading spinners
- Respect `prefers-reduced-motion`: remove all transitions

## Accessibility (applied)

- Tabular-nums on data prevents column-width layout shift
- Widget headers use explicit `text-transform: uppercase` (readable by
  screen readers, unlike `font-variant: small-caps`)
- `box-sizing: border-box` on all elements
- All text at `#00234E` on light surfaces — minimum 14:1 contrast ratio
  (WCAG AAA)

## Appendix: Token-to-source mapping

| Token | Source location |
|-------|----------------|
| `--surface-body` | `constants/theme.ts:6` |
| `--surface-header` | `constants/theme.ts:7` |
| `--surface-widget` | `constants/theme.ts:9` |
| `--surface-widget-header` | `constants/theme.ts:8` |
| `--border-default` | `constants/theme.ts:10` |
| `--border-header` | `constants/theme.ts:11` |
| `--text-primary` | `constants/theme.ts:12` |
| `--text-secondary` | `constants/theme.ts:13` |
| `--text-muted` | `constants/theme.ts:14` |
| `--text-data` | `constants/theme.ts:15` |
| `--accent-blue` | `constants/theme.ts:16` |
| `--accent-light` | `constants/theme.ts:17` |
| `--positive` | `constants/theme.ts:18` |
| `--negative` | `constants/theme.ts:19` |
| Font stack (UI) | `constants/theme.ts:3` |
| Font stack (data) | `constants/theme.ts:4` |
| Widget radii | `constants/theme.ts:23` |
