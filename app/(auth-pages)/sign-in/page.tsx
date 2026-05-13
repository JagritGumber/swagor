import Link from "next/link";
import { signInAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { GoogleLoginButton } from "@/components/google-login-button";
import { SubmitButton } from "@/components/submit-button";

const INPUT =
  "w-full border border-[var(--hairline-strong)] bg-[#080808] px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--neon-cyan)] focus:outline-none";
const LABEL =
  "block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";

export default function SignIn({ searchParams }: { searchParams: Message }) {
  return (
    <section className="w-full border border-[var(--hairline-strong)] bg-black p-8">
      <h1 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Welcome back to your Solon.
      </p>

      <form className="mt-6 space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required className={INPUT} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={LABEL}>Password</label>
            <Link
              href="/forgot-password"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-[var(--neon-cyan)]"
            >
              Forgot?
            </Link>
          </div>
          <input id="password" name="password" type="password" required className={INPUT} />
        </div>

        <FormMessage message={searchParams} />

        <SubmitButton
          formAction={signInAction}
          pendingText="Signing in..."
          className="cta-glow inline-flex h-11 w-full items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] disabled:opacity-50"
        >
          Sign in
        </SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--hairline-strong)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-[var(--hairline-strong)]" />
      </div>

      <GoogleLoginButton nextUrl="/dashboard" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Solon?{" "}
        <Link href="/sign-up" className="font-medium text-[var(--neon-cyan)] underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </section>
  );
}
