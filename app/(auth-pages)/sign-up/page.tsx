"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/components/password-input";

const INPUT =
  "w-full border border-[var(--hairline-strong)] bg-[#080808] px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--neon-cyan)] focus:outline-none";
const LABEL =
  "block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null);
    const { error: err } = await authClient.signUp.email({
      email, password, name: name || email.split("@")[0],
    });
    if (err) {
      setError(err.message ?? "Sign-up failed");
      setSubmitting(false);
      return;
    }
    // Better Auth's emailAndPassword.autoSignIn: true lands the session
    // cookie already; just route to the dashboard.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="w-full border border-[var(--hairline-strong)] bg-black p-8">
      <h1 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Create account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We provision a Selbo wallet on Arc Testnet the moment you sign in.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className={LABEL}>Display name</label>
          <input
            id="name" name="name" type="text" placeholder="optional"
            value={name} onChange={(e) => setName(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className={LABEL}>Email</label>
          <input
            id="email" name="email" type="email" placeholder="you@example.com"
            required value={email} onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={LABEL}>Password</label>
          <PasswordInput
            id="password" name="password" minLength={8} required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-red)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="cta-glow inline-flex h-11 w-full items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-[var(--neon-cyan)] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
