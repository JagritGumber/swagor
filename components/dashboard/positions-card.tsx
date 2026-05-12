"use client";

import { useAccount } from "wagmi";
import { useCallback, useEffect, useState } from "react";

type Position = {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  amountWei: string;
  decimals: number;
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

  if (!isConnected) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-2">Your positions</h2>
        <p className="text-sm text-muted-foreground">
          Connect a wallet first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your positions</h2>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {positions.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">
          No positions found. Faucet some Arc Testnet USDC to your address
          to populate.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Asset</th>
              <th className="font-medium">Where</th>
              <th className="font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={i} className="border-b border-muted/30">
                <td className="py-2">{p.asset}</td>
                <td className="text-xs text-muted-foreground">
                  {p.protocol === "wallet"
                    ? `${p.chain} wallet`
                    : `${p.protocol} on ${p.chain}`}
                </td>
                <td className="text-right font-mono text-xs">
                  {Number(p.amount).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted-foreground pt-1">
        Hackathon scope: Arc Testnet native USDC only. Mainnet
        Aave/Compound/Pendle reads layer on later.
      </p>
    </div>
  );
}
