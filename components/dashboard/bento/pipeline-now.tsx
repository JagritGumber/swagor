"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Check, Clock, X } from "lucide-react";

type TickStage = {
  id: string;
  stage: string;
  status: "completed" | "pending" | "failed" | "skipped" | string;
  summary: string;
  createdAt: string;
};

type TickCurrentResponse = {
  tick: {
    id: string;
    verdict: string;
    rationale: string;
    createdAt: string;
  } | null;
  stages: TickStage[];
  nextWatcherAt: string | null;
};

const STAGE_LABEL: Record<string, string> = {
  market_data: "Market",
  risk: "Risk",
  watcher: "Watcher",
  cadence_blend: "Cadence",
  routing: "Route",
};

function stageTone(status: string): string {
  if (status === "completed") return "border-[var(--neon-green)] text-[var(--neon-green)]";
  if (status === "pending") return "border-[var(--neon-cyan)] text-[var(--neon-cyan)]";
  if (status === "failed") return "border-[var(--neon-red)] text-[var(--neon-red)]";
  return "border-[var(--hairline-strong)] text-muted-foreground";
}

function stageIcon(status: string) {
  if (status === "completed") return <Check aria-hidden className="h-3.5 w-3.5" />;
  if (status === "failed") return <X aria-hidden className="h-3.5 w-3.5" />;
  if (status === "pending") return <Activity aria-hidden className="h-3.5 w-3.5 animate-pulse" />;
  return <Clock aria-hidden className="h-3.5 w-3.5" />;
}

function timeLabel(value: string | null): string {
  if (!value) return "not scheduled";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "not scheduled";
  const seconds = Math.round((ts - Date.now()) / 1000);
  if (seconds <= 0) return "due now";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function PipelineNow() {
  const [data, setData] = useState<TickCurrentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/tick/current", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as TickCurrentResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void load();
    const timer = window.setInterval(load, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const stages = useMemo(() => data?.stages ?? [], [data]);

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="inline-block h-2.5 w-2.5 bg-[var(--neon-cyan)]" />
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Pipeline now
          </h2>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          next tick {timeLabel(data?.nextWatcherAt ?? null)}
        </div>
      </header>

      {error && (
        <p className="mt-4 border border-[var(--neon-red)] bg-[#120707] p-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">
          {error}
        </p>
      )}

      {!data?.tick && !error ? (
        <p className="mt-4 border border-dashed border-[var(--hairline-strong)] bg-[#080808] p-4 text-sm text-muted-foreground">
          No watcher tick yet. Selbo will show the live decision path after the next run.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {stages.map((stage) => (
              <div
                key={stage.id}
                className={`min-h-[120px] border bg-[#050505] p-3 ${stageTone(stage.status)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                    {STAGE_LABEL[stage.stage] ?? stage.stage.replace(/_/g, " ")}
                  </span>
                  {stageIcon(stage.status)}
                </div>
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-foreground">
                  {stage.summary}
                </p>
              </div>
            ))}
          </div>

          {data?.tick && (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              last verdict <span className="text-foreground">{data.tick.verdict}</span> ·{" "}
              {new Date(data.tick.createdAt).toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </section>
  );
}
