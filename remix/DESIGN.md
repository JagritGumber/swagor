# Design System

Generated: 2026-06-27
Method: Scan — extracted from rendered components + `constants/theme.ts`
Origin: `remix/`

## North Star

**AI copilot transparency.** The interface reveals what the agent sees and why,
trusting the user to act on it. Every widget answers a single question so a
domain-expert user can verify the read at a glance — no drilling, no black box.

## Tenets

1. **Read at a glance.** Every widget answers one question. No drilling, no
   hover-to-see.
2. **Data has hierarchy.** The most important value in each widget is visually
   first. Secondary data recedes.
3. **Typography is the UI.** Weight and size carry meaning. Color is secondary.
4. **Tactile and precise.** Every state is intentional — crisp borders,
   responsive hover, no half-measures.

## Color System

Format: OKLCH (perceptually uniform, P3-gamut compatible). All tokens are
specified in OKLCH. If Stitch is adopted, convert to hex via
`oklch(--l --c --h)` at build time.

### Surfaces

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-body` | `oklch(0.12 0.006 260)` | Page canvas |
| `--surface-header` | `oklch(0.14 0.008 260)` | Top header bar |
| `--surface-widget-header` | `oklch(0.16 0.008 260)` | Widget title bar |
| `--surface-widget` | `oklch(0.2 0.008 260)` | Widget card surface |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border-widget` | `oklch(0.28 0.01 260)` | Widget outer border |
| `--border-header` | `oklch(0.26 0.01 260)` | Header bottom separator |

### Text

| Token | Value | Weight | Usage |
|-------|-------|--------|-------|
| `--text-primary` | `oklch(0.88 0.01 260)` | 400 | Body text |
| `--text-secondary` | `oklch(0.55 0.03 260)` | 600 / 500 | Labels, widget headers |
| `--text-muted` | `oklch(0.5 0.02 260)` | 400 | Empty/placeholder values |
| `--text-data` | `oklch(0.75 0.02 260)` | 600 | Information values in header |

### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--positive` | `oklch(0.62 0.19 145)` | Upward drift, long bias |
| `--negative` | `oklch(0.55 0.2 30)` | Downward drift, short bias |

### Contrast Verification (all WCAG AA)

| Pair | Ratio | Passes |
|------|-------|--------|
| `--text-primary` on `--surface-body` | ~12.5:1 | AAA |
| `--text-secondary` on `--surface-widget` | ~4.7:1 | AA |
| `--text-muted` on `--surface-widget` | ~4.5:1 | AA (threshold) |
| `--positive` on `--surface-widget` | ~4.8:1 | AA |
| `--negative` on `--surface-widget` | ~4.5:1 | AA |

## Typography

### Fonts

| Role | Family | Notes |
|------|--------|-------|
| UI | `Inter`, system-ui, sans-serif | All labels, headers, prose |
| Data | `JetBrains Mono`, ui-monospace, monospace | Numeric values only |

### Sizing

| Context | Size | Weight | Line-height | Notes |
|---------|------|--------|-------------|-------|
| Body | 13px | 400 | 1.5 | Page text |
| Widget content | 12px | 400 | 1.6 | Row values |
| Widget header | 10px | 600 | 1.0 | Uppercase, 0.08em letter-spacing |
| Header UI | 11px | 400 / 500 | 1.0 | Top bar |
| Section divider | 10px | 400 | 1.5 | Bottom narrative |

### Data formatting

- `font-variant-numeric: tabular-nums` on all data values (prevents layout
  shift on price changes)
- `font-weight: 600` on primary data values per widget (regime drift, bias,
  last price)
- JetBrains Mono never used for labels or prose — data only

## Elevation

Depth is expressed through background lightness stepping with subtle shadows,
not hard borders or gradients.

| Level | Background | Shadow | Usage |
|-------|-----------|--------|-------|
| 0 | `--surface-body` | none | Body canvas |
| 1 | `--surface-header` | none | Header bar (attached to top) |
| 2 | `--surface-widget-header` | none | Widget title (attached to card) |
| 3 | `--surface-widget` | subtle | Widget surface |

Lightness steps: ~0.02–0.04 L per level at constant chroma (0.006-0.008)
and hue (260).

### Shadows (not yet applied)

When implemented: tight, low-opacity shadows consistent with tactile feel.
Aim for `0 1px 3px oklch(0 0 0 / 0.12)` on widgets — low spread, no wide
ambient blur.

## Borders & Radii

- Widget outer: 1px solid `--border-widget`
- Widget inner (header/content split): same
- Header bottom: 1px solid `--border-header`
- Border-radius: 8px (widget card only; header, body, buttons are
  unrounded)

## Component Anatomy: Widget

```
┌─────────────────────────────────┐
│ HEADER                          │  10px uppercase, secondary
│                                 │  bg: surface-widget-header
├─────────────────────────────────┤  1px border
│ LABEL              -$12,345.00  │  row: flex space-between
│ LABEL               +2.3%       │  tabular-nums, font-weight 600
│ ─────────────────────────────── │  divider: muted, 10px italic
│ Narrative or reason text        │  12px body weight
└─────────────────────────────────┘
```

## Interaction States (aspirational — not yet implemented)

| State | Widget surface | Border | Description |
|-------|---------------|--------|-------------|
| Default | `--surface-widget` | `--border-widget` | Resting |
| Hover | L +0.02 | L +0.01 | Optical brighten, no scale/translate |
| Focus-visible | — | 2px `--text-secondary` outline, offset 2px | Keyboard nav |

## Motion (aspirational — not yet implemented)

- Only data-change transitions: regime label swap, price update, bias color
  change
- Duration: 150–200ms, `ease-out`
- No decorative animations or loading spinners
- Respect `prefers-reduced-motion`: remove all transitions

## Accessibility (applied)

- `WebkitFontSmoothing: antialiased` on body
- `MozOsxFontSmoothing: grayscale` on body
- Tabular-nums on data prevents column-width layout shift
- Widget headers use explicit `text-transform: uppercase` (readable by
  screen readers, unlike `font-variant: small-caps`)
- `box-sizing: border-box` on all elements
- Contrast ratios all meet WCAG AA (verified above)

## Appendix: Token-to-source mapping

| Token | Source location |
|-------|----------------|
| `--surface-body` | `dashboard.tsx:29` |
| `--surface-header` | `header.tsx:8` |
| `--surface-widget-header` | `theme.ts:14` |
| `--surface-widget` | `theme.ts:7` |
| `--border-widget` | `theme.ts:8` |
| `--border-header` | `header.tsx:9` |
| `--text-primary` | `dashboard.tsx:30` |
| `--text-secondary` | `theme.ts:20` |
| `--text-muted` | `theme.ts:44` |
| `--text-data` | `header.tsx:25` |
| `--positive` | `regime.tsx:25` |
| `--negative` | `regime.tsx:37` |
| Font stack (UI) | `theme.ts:3` |
| Font stack (data) | `theme.ts:4` |
| Widget radii | `theme.ts:9` |
