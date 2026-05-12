/**
 * Editorial ticker tape. Slow infinite scroll. Calm, mostly muted, with
 * accents on the headers only.
 */

const ITEMS = [
  { kind: "label", text: "Recent activity" },
  { kind: "trade", text: "rotation · USDe / USDC · +37.4%" },
  { kind: "verdict", text: "panel · approved with notes · 2-1" },
  { kind: "anchor", text: "recorded · 0x09da...0818" },
  { kind: "label", text: "Dissent preserved" },
  { kind: "skeptic", text: "the skeptic · maintained reject" },
  { kind: "trade", text: "hold · idle parked in USYC" },
  { kind: "anchor", text: "recorded · 0x7d12...2a04" },
  { kind: "label", text: "Earlier today" },
  { kind: "trade", text: "exit · sUSDS / USDC · -1.2%" },
  { kind: "verdict", text: "panel · approved · 3-0" },
];

function toneClass(kind: string) {
  if (kind === "label") return "text-[var(--neon-cyan)]";
  if (kind === "trade") return "text-foreground";
  if (kind === "skeptic") return "text-[var(--neon-red)]";
  return "text-muted-foreground";
}

export function TickerTape() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative w-full overflow-hidden border-y border-[var(--hairline)] bg-black/95">
      <div className="mask-fade-x flex w-max animate-marquee whitespace-nowrap py-2.5 text-[12px] tracking-wide">
        {row.map((t, i) => (
          <span key={i} className="mx-6 flex items-center gap-2">
            <span className="text-muted-foreground">·</span>
            <span className={toneClass(t.kind)}>{t.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
