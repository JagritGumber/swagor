type Verdict = {
  verdict?: string;
  concerns?: string[];
  suggested_modification?: string;
};

export function CriticSection({ verdict }: { verdict: Verdict | undefined }) {
  if (!verdict) return null;
  const ok = verdict.verdict === "approve" || verdict.verdict === "approve_with_note";

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Critic</div>
          <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">Audit</h2>
        </div>
        <div className={`font-mono text-xs uppercase tracking-[0.16em] ${ok ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"}`}>
          {verdict.verdict ?? "—"}
        </div>
      </div>

      {verdict.concerns && verdict.concerns.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Concerns</div>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {verdict.concerns.map((c, i) => (<li key={i}>· {c}</li>))}
          </ul>
        </div>
      )}

      {verdict.suggested_modification && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Suggested modification</div>
          <p className="mt-1 text-sm text-foreground">{verdict.suggested_modification}</p>
        </div>
      )}
    </section>
  );
}
