import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const INPUT =
  "w-full border border-[var(--hairline-strong)] bg-[#080808] px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--neon-cyan)] focus:outline-none";
const LABEL =
  "block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";

export default function SignUp({ searchParams }: { searchParams: Message }) {
  if ("message" in searchParams) {
    return (
      <section className="w-full border border-[var(--hairline-strong)] bg-black p-8">
        <FormMessage message={searchParams} />
        <Link
          href="/sign-in"
          className="mt-6 inline-block font-mono text-xs uppercase tracking-[0.18em] text-[var(--neon-cyan)] hover:underline"
        >
          back to sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full border border-[var(--hairline-strong)] bg-black p-8">
      <h1 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Create account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We provision a Solon wallet on Arc Testnet the moment you sign in.
      </p>

      <form className="mt-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required className={INPUT} />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className={LABEL}>Password</label>
          <input id="password" name="password" type="password" minLength={6} required className={INPUT} />
        </div>

        <FormMessage message={searchParams} />

        <SubmitButton
          formAction={signUpAction}
          pendingText="Creating account..."
          className="cta-glow inline-flex h-11 w-full items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          Sign up
        </SubmitButton>
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
