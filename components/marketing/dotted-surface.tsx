"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Animated cyan wave-field of dots in 3D perspective. Sized to its parent
 * container (not the full viewport) so multiple instances can co-exist.
 * Respects prefers-reduced-motion. Adapted from a 21st.dev reference;
 * trimmed to drop the next-themes branch (app is dark-forced) and tuned
 * to our --neon-cyan palette.
 */
export function DottedSurface({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SEPARATION = 150;
    const AMOUNT_X = 40;
    const AMOUNT_Y = 60;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.offsetWidth / container.offsetHeight,
      1,
      10000,
    );
    camera.position.set(0, 355, 1220);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      // No WebGL — fail soft, leave the container empty.
      return;
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const positions: number[] = [];
    const colors: number[] = [];
    for (let ix = 0; ix < AMOUNT_X; ix++) {
      for (let iy = 0; iy < AMOUNT_Y; iy++) {
        positions.push(
          ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2,
        );
        // --neon-cyan = #00d4ff
        colors.push(0, 212 / 255, 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!reduced) {
        const pos = geometry.attributes.position.array as Float32Array;
        let i = 0;
        for (let ix = 0; ix < AMOUNT_X; ix++) {
          for (let iy = 0; iy < AMOUNT_Y; iy++) {
            pos[i * 3 + 1] =
              Math.sin((ix + count) * 0.3) * 50 +
              Math.sin((iy + count) * 0.5) * 50;
            i++;
          }
        }
        geometry.attributes.position.needsUpdate = true;
        count += 0.05;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} aria-hidden className={className} />;
}
