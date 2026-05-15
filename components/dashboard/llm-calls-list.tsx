"use client";

import { useEffect, useState } from "react";
import { DebugJSON } from "@/components/dashboard/debug-json";

type LlmCallRow = {
  id: string;
  agentName: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
  parsedOutput: unknown;
  promptTokens: number | null;
  completionTokens: number | null;
  tickId: string | null;
  tradeId: string | null;
  cycleId: string | null;
  createdAt: string;
};

const SUB_HEAD =
  "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

/**
 * Admin-only renderer for llm_calls rows. Accepts any combination of
 * tickId / tradeId / tickIds and fetches /api/admin/llm-calls. Each row
 * shows agent + model + token usage and three DebugJSON drawers: system
 * prompt, user message, raw response. Non-admin callers get 403 and the
 * component renders nothing -- gate at the parent.
 */
export function LlmCallsList({
  tickId,
  tradeId,
  tickIds,
}: {
  tickId?: string;
  tradeId?: string;
  tickIds?: string[];
}) {
  const [rows, setRows] = useState<LlmCallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tickId) params.set("tickId", tickId);
    if (tradeId) params.set("tradeId", tradeId);
    if (tickIds && tickIds.length > 0) params.set("tickIds", tickIds.join(","));
    if ([...params.keys()].length === 0) return;
    let cancelled = false;
    fetch(`/api/admin/llm-calls?${params.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { rows: LlmCallRow[] };
      })
      .then((b) => {
        if (!cancelled) setRows(b.rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [tickId, tradeId, tickIds]);

  if (error) {
    return (
      <p className="mt-2 font-mono text-xs text-[var(--neon-red)]">
        llm_calls: {error}
      </p>
    );
  }
  if (rows === null) {
    return (
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        Loading llm_calls...
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        No llm_calls recorded for this context.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="border border-[var(--hairline)] bg-[#0a0a0a] p-3"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
            <span className="font-bold text-[var(--neon-cyan)]">
              {row.agentName}
            </span>
            <span className="text-muted-foreground">{row.model}</span>
            <span className="text-muted-foreground">
              {row.promptTokens ?? "?"} in / {row.completionTokens ?? "?"} out
            </span>
            <span className="text-muted-foreground">
              {new Date(row.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-2">
            <div className={SUB_HEAD}>System prompt</div>
            <DebugJSON title="system" value={row.systemPrompt} />
          </div>
          <div className="mt-2">
            <div className={SUB_HEAD}>User message</div>
            <DebugJSON title="user" value={tryParseJson(row.userMessage)} />
          </div>
          <div className="mt-2">
            <div className={SUB_HEAD}>Raw response</div>
            <DebugJSON title="raw" value={tryParseJson(row.rawResponse)} />
          </div>
          {row.parsedOutput !== null && (
            <div className="mt-2">
              <div className={SUB_HEAD}>Parsed output</div>
              <DebugJSON title="parsed" value={row.parsedOutput} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
