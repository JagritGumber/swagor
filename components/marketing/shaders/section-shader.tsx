"use client";

import dynamic from "next/dynamic";
import type { Variant } from "./section-shader-impl";

const PLACEHOLDER_BG: Record<Variant, string> = {
  "swirl-007": "#000000",
  "dot-orbit-shine": "#000000",
  "dot-grid": "#000000",
  "dot-grid-twinkle": "#000000",
  "dithering-warp": "#001a22",
  "simplex-first-contact": "#000000",
  "pulsing-border": "#000000",
};

const ShaderImpl = dynamic(() => import("./section-shader-impl"), {
  ssr: false,
  loading: () => null,
});

/**
 * Full-section shader background with deferred client-only loading. The
 * heavy paper-shaders bundle splits into its own chunk; the parent paints
 * immediately over a static placeholder matching the shader's colorBack,
 * and the shader fades in once hydrated.
 *
 * Parent must be `relative isolate overflow-hidden`. Place as first child
 * of the section; content must be wrapped in `relative z-10`. `opacity`
 * dims the shader; `scrim` adds a black overlay above it for contrast.
 */
export function SectionShader({
  variant,
  opacity = 0.35,
  scrim = 0.55,
}: {
  variant: Variant;
  opacity?: number;
  scrim?: number;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: PLACEHOLDER_BG[variant], opacity }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ opacity }}
      >
        <ShaderImpl variant={variant} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: `rgba(0,0,0,${scrim})` }}
      />
    </>
  );
}
