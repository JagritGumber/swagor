/**
 * Brutalist trader ticker tape. Infinite-scroll marquee using CSS keyframes
 * only — content is duplicated inside the track so translateX(-50%) loops
 * seamlessly. Edges fade via .mask-fade-x.
 *
 * Color: terminal green for positive, neon red for negative, muted text for
 * structure. JetBrains Mono via inherited body font.
 */

type Tick = { label: string; tone: "up" | "down" | "info" };

const TICKS: Tick[] = [
  { label: "SOL +14.2% USDe/USDC", tone: "up" },
  { label: "SOL -3.1% ETH/USDC", tone: "down" },
  { label: "SOL +8.4% sUSDS/USDC", tone: "up" },
  { label: "ANCHORED 0x09da…0818", tone: "info" },
  { label: "PANEL 3-0 APPROVE", tone: "up" },
  { label: "SOL +2.7% USYC PARK", tone: "up" },
  { label: "CASSANDRA DISSENTED", tone: "info" },
  { label: "SOL -1.4% PT-eUSDe", tone: "down" },
  { label: "CRITIC: R1 APPROVE", tone: "up" },
  { label: "CYCLE #1284 SETTLED", tone: "info" },
  { label: "SOL +6.1% sDAI", tone: "up" },
  { label: "MONITOR: NO_SIGNAL ×32", tone: "info" },
];

function toneClass(tone: Tick["tone"]) {
  if (tone === "up") return "text-[var(--neon-green)]";
  if (tone === "down") return "text-[var(--neon-red)]";
  return "text-muted-foreground";
}

export function TickerTape() {
  const track = [...TICKS, ...TICKS]; // duplicate for seamless loop
  return (
    <div className="relative w-full overflow-hidden border-y border-[var(--hairline-strong)] bg-black/80 backdrop-blur-sm">
      <div className="mask-fade-x flex w-max animate-marquee whitespace-nowrap py-2 text-xs uppercase tracking-wider">
        {track.map((t, i) => (
          <span key={i} className="mx-6 flex items-center gap-2">
            <span className="text-muted-foreground">›</span>
            <span className={toneClass(t.tone)}>{t.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
