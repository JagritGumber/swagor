# Plan: Fill the 3D Hero Scene

## Goal
Make the hex-three scene match the reference image by adding background texture, icons/labels on rectangles, and curved dotted connecting lines.

## Changes

### 1. CSS Background Pattern (hero/style.ts)
Add a subtle dotted grid pattern to `heroVisual`:
```css
backgroundImage: radial-gradient(circle, rgba(0, 212, 255, 0.08) 1px, transparent 1px)
backgroundSize: 20px 20px
```
Quick win — no Three.js overhead.

### 2. HTML Overlay for Icons + Labels (new files)
**New:** `app/components/landing/hero-overlay/component.tsx` + `style.ts`

- 4 overlay items positioned absolutely over the canvas
- Each has a Phosphor icon + text label below
- Positions derived from rect world coordinates projected to screen space
- Overlay container: `position: absolute`, `inset: 0`, `pointer-events: none`
- Each item: `position: absolute`, centered on projected rect position

**Icon mapping:**
| Rect | Icon | Label |
|------|------|-------|
| Top-left | `ph-magnifying-glass` | Market Scan |
| Top-right | `ph-brain` | Decision |
| Bottom-left | `ph-lightning` | Execute Trade |
| Bottom-right | `ph-shield-check` | On-chain Record |

**Coordinate projection (in hex-three.ts):**
- Camera is orthographic, fixed position — project once at init
- Return projected screen coords from `createHexCoin()`
- Overlay reads these from a shared ref or data attribute

### 3. Curved Dotted Lines (hex-three.ts)
Replace L-shaped `Line` objects with curved `LineDashedMaterial`:

- For each rect: create `CatmullRomCurve3` with 4 control points:
  1. Rect center `(rectX, rectY, 0)`
  2. Midpoint with offset `(rectX * 0.5, coinCenterY, 0)`
  3. Near coin `(coinCenterX + offset, coinCenterY, 0)`
  4. Coin center `(coinCenterX, coinCenterY, 0)`
- Sample 30 points along curve → `BufferGeometry`
- `LineDashedMaterial({ dashSize: 0.15, gapSize: 0.1 })`
- Call `geometry.computeLineDistances()` for dashes to render
- In `tick()`: update control point 4 (coin Y), re-sample curve, update geometry

### 4. Expose Positions from hex-three.ts
`createHexCoin()` returns:
```ts
{
  destroy(): void
  rectScreens: { x: number; y: number; label: string; icon: string }[]
}
```
- `rectScreens` are percentage-based (0-100) for CSS positioning
- Client mount script passes these to the overlay component

## Files to Modify
| File | Change |
|------|--------|
| `app/components/landing/hero/style.ts` | Add background pattern to `heroVisual` |
| `app/components/landing/hex-three.ts` | Curved dotted lines, return `rectScreens` |
| `app/assets/hex-three-client.ts` | Pass `rectScreens` to overlay |
| `app/components/landing/hero/component.tsx` | Render overlay with `rectScreens` |

## New Files
| File | Purpose |
|------|---------|
| `app/components/landing/hero-overlay/component.tsx` | Icon + label overlay |
| `app/components/landing/hero-overlay/style.ts` | Overlay styles |

## Verification
1. `npm run typecheck` passes
2. Dev server renders hero with:
   - Dotted grid background visible
   - 4 icon+label items positioned over rectangles
   - Curved dotted lines connecting each rect to coin
   - Lines animate with coin levitation
3. No visual regressions (platform glow, coin material, etc.)
