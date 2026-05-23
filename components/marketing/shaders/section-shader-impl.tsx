"use client";

import {
  Swirl, swirlPresets,
  DotOrbit,
  DotGrid,
  Dithering,
  SimplexNoise, simplexNoisePresets,
  PulsingBorder, pulsingBorderPresets,
} from "@paper-design/shaders-react";

export type Variant =
  | "swirl-007"
  | "dot-orbit-shine"
  | "dot-grid"
  | "dot-grid-twinkle"
  | "dithering-warp"
  | "simplex-first-contact"
  | "pulsing-border";

const FILL: React.CSSProperties = { width: "100%", height: "100%" };

export default function ShaderImpl({ variant }: { variant: Variant }) {
  switch (variant) {
    case "swirl-007": {
      const p = swirlPresets.find((x) => x.name === "007") ?? swirlPresets[0];
      return <Swirl {...p.params} style={FILL} />;
    }
    case "dot-orbit-shine":
      return (
        <DotOrbit
          colors={["#003a4a", "#0066aa", "#001a22"]}
          colorBack="#000000"
          stepsPerColor={4}
          size={0.65}
          sizeRange={0.5}
          spreading={1}
          speed={0.6}
          scale={0.8}
          style={FILL}
        />
      );
    case "dot-grid":
      // Minimalist static grid. White fill keeps it neutral against the cyan
      // headlines so it reads as atmospheric texture, not competing accent.
      // No size or opacity variance - dead-still grid is the look.
      return (
        <DotGrid
          colorBack="#000000"
          colorFill="#ffffff"
          colorStroke="#000000"
          size={2}
          gapX={32}
          gapY={32}
          strokeWidth={0}
          sizeRange={0}
          opacityRange={0}
          shape="circle"
          style={FILL}
        />
      );
    case "dot-grid-twinkle":
      return (
        <DotOrbit
          colors={["#001a22", "#0088aa", "#00d4ff"]}
          colorBack="#000000"
          stepsPerColor={8}
          size={0.35}
          sizeRange={0.9}
          spreading={0.05}
          speed={1.2}
          scale={0.7}
          style={FILL}
        />
      );
    case "dithering-warp":
      return (
        <Dithering
          colorBack="#001a22"
          colorFront="#00d4ff"
          shape="warp"
          type="4x4"
          size={2.5}
          speed={1}
          maxPixelCount={921600}
          style={FILL}
        />
      );
    case "simplex-first-contact": {
      const p = simplexNoisePresets.find((x) => x.name === "First contact") ?? simplexNoisePresets[0];
      return <SimplexNoise {...p.params} style={FILL} />;
    }
    case "pulsing-border": {
      const p = pulsingBorderPresets[0];
      return <PulsingBorder {...p.params} style={FILL} />;
    }
  }
}
