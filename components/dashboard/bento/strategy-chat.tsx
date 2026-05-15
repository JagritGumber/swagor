"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";

type Revision = { id: string; role: "user" | "selbo"; message: string; createdAt: string };
type ChatResp = { currentStrategy: string | null; revisions: Revision[] };

/**
 * Strategy brief + multi-turn chat drawer. Replaces the previous
 * StrategyBriefCard. The user sees their current strategy at a glance
 * and can open a drawer to refine it in plain English. Selbo replies
 * with a one-sentence acknowledgment via the LIGHT model. Raw text
 * end-to-end; the chat overwrites selboInstances.strategyText so the
 * next watcher tick uses the new strategy.
 */
export function StrategyChat({ initialStrategy, watching }: { initialStrategy: string; watching: string[] }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChatResp | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus trap: pull focus back into the drawer if it escapes. Initial
  // focus lands on the textarea so the user can start typing right away.
  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    const onFocusIn = (e: FocusEvent) => {
      const drawerEl = drawerRef.current;
      if (!drawerEl || !e.target) return;
      if (drawerEl.contains(e.target as Node)) return;
      textareaRef.current?.focus();
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  useEffect(() => {
    if (!open || data) return;
    fetch("/api/strategy/chat", { cache: "no-store" })
      .then((r) => r.ok ? r.json() as Promise<ChatResp> : Promise.reject(r.status))
      .then(setData)
      .catch((e) => setError(typeof e === "number" ? `HTTP ${e}` : String(e)));
  }, [open, data]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data]);

  const currentStrategy = data?.currentStrategy ?? initialStrategy;
  const revisions = data?.revisions ?? [];

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setData((prev) => prev ? {
      currentStrategy: message,
      revisions: [...prev.revisions, { id: `tmp-${Date.now()}`, role: "user", message, createdAt: new Date().toISOString() }],
    } : prev);
    setDraft("");
    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = (await res.json()) as ChatResp;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="border border-[var(--hairline-strong)] bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            What Selbo is following
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {watching.length > 0 ? `Watching ${watching.join(", ")}` : "No watchlist yet"}
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{currentStrategy}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20"
        >
          <MessageSquare aria-hidden className="h-3 w-3" />
          Refine strategy
        </button>
      </section>

      {open && (
        <div className="fixed inset-0 z-[55] flex" role="dialog" aria-modal="true" aria-label="Strategy chat">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close drawer"
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/70 cursor-default"
          />
          <div ref={drawerRef} className="flex h-full w-full max-w-md flex-col border-l border-[var(--hairline-strong)] bg-black">
            <header className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-3">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
                Strategy chat
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-muted-foreground hover:text-[var(--neon-cyan)]">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {!data && !error && <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Loading...</p>}
              {error && <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-red)]">{error}</p>}
              {data && revisions.length === 0 && (
                <div className="border border-dashed border-[var(--hairline)] bg-[#0a0a0a] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Starting strategy</div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{currentStrategy}</p>
                </div>
              )}
              <ul className="space-y-3">
                {revisions.map((r) => (
                  <li key={r.id} className={r.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] border px-3 py-2 text-sm leading-relaxed ${r.role === "user"
                        ? "border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 text-foreground"
                        : "border-[var(--hairline)] bg-[#0a0a0a] text-foreground"}`}
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {r.role === "user" ? "you" : "selbo"}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{r.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {sending && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Selbo is replying...
                </p>
              )}
            </div>

            <footer className="border-t border-[var(--hairline)] px-5 py-3">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                }}
                rows={3}
                disabled={sending}
                placeholder="trade less, lower risk, aim 1% daily..."
                className="w-full resize-none border border-[var(--hairline)] bg-[#0a0a0a] p-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--neon-cyan)] focus:outline-none disabled:opacity-50"
              />
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <span>Enter to send. Shift+Enter for newline.</span>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || draft.trim().length === 0}
                  className="inline-flex items-center gap-2 border border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-3 py-1.5 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden className="h-3 w-3" />
                  Send
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
