/**
 * Brutalist trader stats strip. Four count-up cells separated by hairlines.
 * IntersectionObserver triggers count animation on first scroll-into-view.
 */

"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  label: string;
  target: number;
  prefix?: string;
  suffix?: string;
  tone?: "default" | "up";
};

const STATS: Stat[] = [
  { label: "Trades anchored", target: 247 },
  { label: "Cycles run", target: 1284 },
  { label: "Active users", target: 32 },
  { label: "Total PnL", target: 1247, prefix: "+$", tone: "up" },
];

function useCountUp(target: number, durationMs = 1600, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let frame = 0;
    const totalFrames = Math.max(1, Math.round(durationMs / 16));
    const id = setInterval(() => {
      frame++;
      const t = Math.min(1, frame / totalFrames);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (frame >= totalFrames) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, durationMs, start]);
  return value;
}

function StatCell({ stat, inView }: { stat: Stat; inView: boolean }) {
  const value = useCountUp(stat.target, 1600, inView);
  const toneClass =
    stat.tone === "up" ? "text-[var(--neon-green)]" : "text-foreground";
  return (
    <div className="relative bg-black px-6 py-8 sm:px-10 sm:py-12">
      <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--neon-cyan)]">
        {stat.label}
      </div>
      <div
        className={`mt-3 text-3xl font-bold tabular-nums tracking-tight sm:text-5xl ${toneClass}`}
      >
        {stat.prefix ?? ""}
        {value.toLocaleString("en-US")}
        {stat.suffix ?? ""}
      </div>
      <div className="absolute right-3 top-3 text-[10px] text-muted-foreground">
        ◢
      </div>
    </div>
  );
}

export function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-[var(--hairline)] sm:grid-cols-4">
        {STATS.map((s) => (
          <StatCell key={s.label} stat={s} inView={inView} />
        ))}
      </div>
    </section>
  );
}
