export const metadata = {
  title: "Disclaimer · Selbo",
  description:
    "Paper-mode AI trader. Educational use only. Not financial advice. Read this before you use Selbo.",
};

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-foreground">
      <h1 className="text-3xl font-bold uppercase tracking-tight">Disclaimer</h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Last updated 2026-05-15
      </p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-bold uppercase">Paper mode</h2>
        <p>
          Selbo is running in paper-mode against Hyperliquid testnet. No real
          funds are placed at risk. Positions, balances, and PnL displayed in
          the dashboard are simulated against testnet market data.
        </p>

        <h2 className="text-xl font-bold uppercase">Not financial advice</h2>
        <p>
          Selbo is an AI experiment. Every decision is made by software based
          on the strategy text you provide and live market data. The output is
          not investment advice, not a recommendation, and not a forecast.
          Outcomes shown are not predictive of any future outcome on a live
          venue with real capital.
        </p>

        <h2 className="text-xl font-bold uppercase">No guarantees</h2>
        <p>
          We do not guarantee uptime, correctness of indicators, accuracy of
          news context, or that Selbo will follow your strategy precisely.
          Bugs in the agent, the LLM provider, the exchange data feed, or the
          deployment can cause unexpected behavior at any time.
        </p>

        <h2 className="text-xl font-bold uppercase">User responsibility</h2>
        <p>
          You are responsible for any decision you take based on what Selbo
          shows you. If you choose to apply Selbo&apos;s reasoning to a real
          venue with real capital, you do so entirely at your own risk.
          Neither Selbo, its authors, nor any party associated with the
          hackathon submission accepts liability for losses resulting from
          such decisions.
        </p>

        <h2 className="text-xl font-bold uppercase">Hackathon context</h2>
        <p>
          Selbo is a hackathon submission (Agora Agents, RFB 01). It is built
          to demonstrate an agent architecture, not to operate as a regulated
          financial product. The codebase, the wallet, and the data sources
          may change without notice.
        </p>

        <h2 className="text-xl font-bold uppercase">Data and wallets</h2>
        <p>
          Selbo auto-provisions a Circle Developer-Controlled Wallet on Arc
          Testnet per user for anchor transactions. The wallet holds testnet
          assets only. You also link an external wallet at signup via a
          one-time message signature for Sybil resistance; we never request
          permission to spend from it.
        </p>

        <h2 className="text-xl font-bold uppercase">Contact</h2>
        <p>
          Questions or bug reports: open an issue at the Selbo repository.
        </p>
      </section>
    </article>
  );
}
