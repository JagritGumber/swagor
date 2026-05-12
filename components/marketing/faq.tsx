/**
 * Brutalist FAQ. Native <details> for accessibility + zero JS.
 * Plus sign rotates 45° on open (via .faq-marker class wired in globals.css).
 */

type QA = {
  q: string;
  a: React.ReactNode;
};

const QAS: QA[] = [
  {
    q: "Is this real money?",
    a: (
      <>
        Not during the hackathon. Solon runs in simulation mode on Arc Testnet
        with faucet USDC. Trades simulate against live mainnet Uniswap pool
        prices, so the PnL is honest — but no real capital is at risk. A
        live-mode toggle lands post-hackathon.
      </>
    ),
  },
  {
    q: "What happens to my Solon if it loses money?",
    a: (
      <>
        Nothing. It keeps cycling. Bad outcomes feed the memory service —
        the panel's reviewer track records update, and the next cycle's
        prompt includes the lesson. Solon is allowed to be wrong because
        every wrong move is also a training signal you can audit on Arc.
      </>
    ),
  },
  {
    q: "Can I stop it at any time?",
    a: (
      <>
        Yes. Every Solon instance has a kill switch on the dashboard. Flip it
        and your cycles stop firing. Funds stay in your Circle Dev Wallet
        (which only you can fully export). You can resume later or never
        come back.
      </>
    ),
  },
  {
    q: "How is this different from a copy-trading bot?",
    a: (
      <>
        Copy bots mirror a leader without reasoning. Solon <em>generates</em>{" "}
        its own reasoning per trade, has it debated by three specialists, and
        gates execution behind a cross-model audit. The reasoning trace is the
        product — you're not blindly following anyone.
      </>
    ),
  },
  {
    q: "Where do my prompts and reasoning go?",
    a: (
      <>
        Trade reasoning + panel verdicts get anchored on Arc Testnet as
        TradeAnchored events. The full trace lives in Supabase. Everything is
        viewable on your dashboard and (if you opt in) at{" "}
        <code className="text-[var(--neon-cyan)]">/solon/&lt;username&gt;</code>
        . LLM provider terms apply for in-flight prompts (Zhipu / DeepInfra).
      </>
    ),
  },
  {
    q: "What does it actually cost?",
    a: (
      <>
        $0 for you during the hackathon. Wallet creation is free on Circle's
        sandbox. Faucet drops are free. The LLM bill runs on Jagrit's account
        and totals ~$10-20 across the entire hackathon at expected scale.
        Premium tiers come after hackathon.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section className="border-b border-[var(--hairline-strong)] bg-black">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <header className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--neon-cyan)] sm:text-xs">
            // FAQ
          </div>
          <h2 className="mt-3 text-3xl font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-4xl md:text-5xl">
            Things you should ask.
          </h2>
        </header>

        <div className="divide-y divide-[var(--hairline-strong)] border-y border-[var(--hairline-strong)]">
          {QAS.map((item, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer items-start gap-4 px-2 py-5 transition-colors hover:bg-[#080808]">
                <span className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--neon-cyan)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-base font-bold uppercase leading-tight tracking-tight sm:text-lg">
                  {item.q}
                </span>
                <span className="faq-marker mt-1 inline-block text-base font-light text-muted-foreground transition-transform duration-300">
                  +
                </span>
              </summary>
              <div className="px-2 pb-6 pl-12 pr-8 text-sm leading-relaxed text-foreground/75">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
