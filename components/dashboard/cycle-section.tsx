"use client";

import { useAccount } from "wagmi";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Cycle = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
};

export function CycleSection() {
  const { address, isConnected } = useAccount();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    if (!address) return;
    const res = await fetch(`/api/cycles?walletAddress=${address}`);
    if (res.ok) {
      const data = await res.json();
      setCycles(data.cycles ?? []);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) fetchCycles();
  }, [isConnected, fetchCycles]);

  async function runCycle() {
    if (!address || isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/cycles/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await fetchCycles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start cycle");
    } finally {
      setIsRunning(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-2">Cycles</h2>
        <p className="text-sm text-muted-foreground">
          Connect a wallet first to run cycles.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cycles</h2>
        <button
          onClick={runCycle}
          disabled={isRunning}
          className="px-4 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isRunning ? "Starting..." : "Run cycle"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {cycles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cycles yet. Click &quot;Run cycle&quot; to start one.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 font-medium">Cycle</th>
              <th className="font-medium">Status</th>
              <th className="font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-b border-muted/30 hover:bg-muted/20 transition-colors">
                <td className="py-2">
                  <Link href={`/dashboard/cycles/${c.id}`} className="hover:underline">
                    <code className="text-xs">{c.id.slice(0, 8)}</code>
                  </Link>
                </td>
                <td>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted">
                    {c.status}
                  </span>
                </td>
                <td className="text-xs text-muted-foreground">
                  {new Date(c.startedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
