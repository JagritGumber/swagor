/**
 * FAQ. Controlled single-open accordion (only one expanded at a time).
 * Grid layout aligns the answer's left edge with the question column.
 * Lucide Plus icon rotates 45deg on open via existing .faq-marker CSS.
 */

"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

type QA = { q: string; a: ReactNode };

const QAS: QA[] = [
  {
    q: "Is this real money?",
    a: (
      <>
        Not yet. Selbo runs on Arc Testnet with simulated capital. Trades simulate against real mainnet pool prices, so the numbers stay honest. No actual capital is at risk. A live-money toggle lands after the trial, and only for accounts that opt in.
      </>
    ),
  },
  {
    q: "What happens when it loses?",
    a: (
      <>
        Nothing dramatic. The deliberation gets recorded the same way, the losing reasoning goes on Arc, and the analysts whose call was wrong have their track record updated. The next cycle reads the lesson before it starts. Selbo is allowed to be wrong. That is where the most useful signal lives.
      </>
    ),
  },
  {
    q: "Can I stop it at any time?",
    a: (
      <>
        Yes. There is a kill switch on your dashboard. Flip it and your Selbo stops cycling. The wallet is yours. Only you can fully export it. You can come back later or never.
      </>
    ),
  },
  {
    q: "How is this different from a copy-trading bot?",
    a: (
      <>
        A copy-trading bot mirrors a leader without reading. Selbo writes its own memo, has three specialists debate it, and gates execution behind a separate AI audit. You are reading the argument, not following anyone blindly.
      </>
    ),
  },
  {
    q: "Where does my reasoning go?",
    a: (
      <>
        Every trade&apos;s reasoning and the panel&apos;s dissent get recorded on Arc Testnet as on-chain events. The full deliberation lives in your dashboard. If you opt in, your Selbo also has a public page anyone can read.
      </>
    ),
  },
  {
    q: "What does it cost?",
    a: (
      <>
        Free during the trial. Wallets, simulated capital, every deliberation, all free. A paid tier comes later for users who want more frequent cycles or premium analysts. You will not be charged anything you did not explicitly sign up for.
      </>
    ),
  },
];

export function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="faq-heading"
      className="border-b border-[var(--hairline-strong)] bg-black"
    >
      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        <header className="mb-10">
          <h2
            id="faq-heading"
            className="text-[40px] font-bold uppercase leading-[1.05] tracking-tight text-balance text-foreground"
          >
            Things you <span className="text-[var(--neon-cyan)]">should ask</span> before deploying.
          </h2>
        </header>

        <div className="divide-y divide-[var(--hairline-strong)] border-y border-[var(--hairline-strong)]">
          {QAS.map((item, i) => (
            <details key={i} open={openIdx === i} className="group">
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  setOpenIdx(openIdx === i ? null : i);
                }}
                className="grid cursor-pointer grid-cols-[44px_1fr_28px] items-center gap-4 py-6 transition-colors hover:bg-[#080808] sm:grid-cols-[60px_1fr_28px] sm:gap-8"
              >
                <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xl font-bold uppercase leading-tight text-foreground sm:text-2xl">
                  {item.q}
                </span>
                <Plus
                  aria-hidden
                  className="faq-marker h-5 w-5 justify-self-end text-muted-foreground transition-transform"
                />
              </summary>
              <div className="grid grid-cols-[44px_1fr_28px] gap-4 pb-6 sm:grid-cols-[60px_1fr_28px] sm:gap-8">
                <div aria-hidden />
                <div className="text-base leading-relaxed text-muted-foreground">
                  {item.a}
                </div>
                <div aria-hidden />
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
