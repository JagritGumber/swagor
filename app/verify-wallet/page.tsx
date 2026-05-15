"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectKitButton } from "connectkit";

/**
 * Mandatory wallet-verification step between sign-up and dashboard.
 * One free Selbo account per external wallet -- enforced by a unique
 * constraint on selbo_instances.external_wallet_address.
 *
 * Flow: ConnectKit -> wagmi useAccount -> fetch SIWE message (server-built,
 * cookie-bound) -> useSignMessage -> POST /api/auth/connect-wallet -> dash.
 */
export default function VerifyWalletPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    if (!address || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const nonceRes = await fetch(
        `/api/auth/wallet-nonce?address=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      if (!nonceRes.ok) {
        const j = await nonceRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Nonce request failed (${nonceRes.status})`);
      }
      const { message } = (await nonceRes.json()) as { message: string };

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/connect-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      const result = (await verifyRes.json().catch(() => ({}))) as { error?: string };
      if (!verifyRes.ok) {
        setError(result.error ?? `Verification failed (${verifyRes.status})`);
        setSubmitting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md border border-[var(--hairline-strong)] bg-black p-8">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)]">
        One last step
      </div>
      <h1 className="mt-2 text-2xl font-bold uppercase leading-tight text-foreground">
        Verify wallet
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Selbo gives one free account per wallet. Connect any EVM wallet and sign a
        one-time message proving you control it. No transaction is sent.
      </p>

      <div className="mt-6 space-y-3">
        <ConnectKitButton />

        <button
          type="button"
          onClick={onVerify}
          disabled={!isConnected || submitting}
          className="cta-glow inline-flex h-11 w-full items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          {submitting ? "Verifying..." : isConnected ? "Sign to verify" : "Connect a wallet first"}
        </button>

        {error && (
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">
            {error}
          </p>
        )}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Different from your Selbo trading wallet on Arc -- that one is auto-provisioned
        and only signs paper-mode trades. This wallet is for identity only.
      </p>
    </section>
  );
}
