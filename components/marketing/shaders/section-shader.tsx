"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
 * Full-section shader background with deferred client-only loading AND
 * on-screen gating: the heavy paper-shaders WebGL loop only mounts while the
 * section is visible, and unmounts once scrolled away. Without this, every
 * shader on the page keeps running off-screen and they contend for the GPU,
 * tanking scroll FPS. The static placeholder bg always paints, so there is no
 * flash when the shader is absent.
 *
 * Parent must be `relative isolate overflow-hidden`; content in `relative z-10`.
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
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), { rootMargin: "150px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: PLACEHOLDER_BG[variant], opacity }}
      />
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ opacity }}
      >
        {visible && <ShaderImpl variant={variant} />}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: `rgba(0,0,0,${scrim})` }}
      />
    </>
  );
}
