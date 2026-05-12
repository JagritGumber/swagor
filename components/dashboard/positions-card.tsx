"use client";

import { useAccount } from "wagmi";
import { useCallback, useEffect, useState } from "react";

type Position = {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
};

export function PositionsCard() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/positions?walletAddress=${address}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPositions(data.positions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) fetchPositions();
  }, [isConnected, fetchPositions]);

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Positions
          </div>
          <h2 className="mt-3 text-2xl font-bold uppercase leading-tight text-foreground">
            What you hold right now.
          </h2>
        </div>
        {isConnected && (
          <button
            type="button"
            onClick={fetchPositions}
            disabled={loading}
            className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-[var(--neon-cyan)] disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>

      {error && <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}

      {!isConnected ? (
        <p className="mt-6 text-sm text-muted-foreground">Connect a wallet to read positions.</p>
      ) : positions.length === 0 && !loading ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No positions found. Faucet some Arc Testnet USDC to your address to populate.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-[var(--hairline)] border-y border-[var(--hairline-strong)]">
          {positions.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3 sm:grid-cols-[1fr_2fr_auto]">
              <div className="text-base text-foreground">{p.asset}</div>
              <div className="hidden font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground sm:block">
                {p.protocol === "wallet" ? `${p.chain} wallet` : `${p.protocol} on ${p.chain}`}
              </div>
              <div className="text-right font-mono text-base tabular-nums text-foreground">
                {Number(p.amount).toFixed(4)}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 max-w-xl font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
        Testnet scope: Arc native USDC only. Mainnet Aave / Compound / Pendle reads layer on later.
      </p>
    </section>
  );
}
