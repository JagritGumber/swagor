/**
 * How a deliberation works. Tighter stage titles + smaller vertical gaps.
 */

import { Anchor, Bell, PenLine, Scan, ShieldCheck, Users } from "lucide-react";
import type { ComponentType } from "react";

type Stage = {
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const STAGES: Stage[] = [
  {
    title: "Selbo scans",
    body: "Every fifteen minutes Selbo glances at the market. Prices, depth, news, recent lessons. One light call. Almost always it sees nothing worth doing, logs it, and goes back to waiting.",
    Icon: Scan,
  },
  {
    title: "Something shifts",
    body: "Roughly five percent of the time, something does shift. A yield window. A regime hint. A piece of news that ties to a position. Only then does the full deliberation start.",
    Icon: Bell,
  },
  {
    title: "Selbo proposes",
    body: "Selbo drafts a single trade. What to do, on which venue, at what size, with what to watch for as it plays out. Nothing executes yet.",
    Icon: PenLine,
  },
  {
    title: "Three analysts argue",
    body: "The Economist reads the macro. The Analyst reads the venue. The Skeptic reads the worst case. Two rounds. The second is adversarial. Each must attack the loudest dissent before voting again.",
    Icon: Users,
  },
  {
    title: "A separate AI audits",
    body: "A reviewer on a different model lineage reads the whole debate. Its job is to catch arguments that sound right but are not. It can approve, ask for a fix, or block.",
    Icon: ShieldCheck,
  },
  {
    title: "The call goes on Arc",
    body: "If the audit clears it, the trade simulates against live pool prices. The reasoning, the dissent, and the outcome are recorded on Arc forever. You read all of it on your dashboard.",
    Icon: Anchor,
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="howitworks-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <header className="mb-10 max-w-3xl">
          <h2
            id="howitworks-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            From a quiet scan, <span className="text-[var(--neon-cyan)]">to a permanent record.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Most cycles do nothing. That is the point. The full panel only fires when there is something real to debate.
          </p>
        </header>

        <ol className="divide-y divide-[var(--hairline-strong)] border-y border-[var(--hairline-strong)]">
          {STAGES.map((s, i) => {
            const Icon = s.Icon;
            return (
              <li
                key={s.title}
                className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-[56px_1.4fr_3fr] sm:items-center sm:gap-8 sm:py-6"
                style={{ animation: `rise-in 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both` }}
              >
                <div className="flex items-center">
                  <span className="flex h-10 w-10 items-center justify-center border border-[var(--hairline-strong)] bg-[#080808]">
                    <Icon className="h-5 w-5 text-[var(--neon-cyan)]" aria-hidden />
                  </span>
                </div>
                <h3 className="text-xl font-bold uppercase leading-tight text-foreground">
                  {s.title}
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
