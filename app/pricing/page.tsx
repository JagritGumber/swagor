import Link from "next/link";
import { headers } from "next/headers";
import { TIERS } from "@/lib/tiers";
import { CheckoutButton } from "@/components/pricing/checkout-button";
import { auth } from "@/lib/auth";

/**
 * Public pricing page. Reads the tier matrix from lib/tiers.ts so the
 * source of truth stays single. Checkout button uses Better Auth's
 * `authClient.checkout({ slug })` which redirects to Polar's hosted page.
 */
export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const signedIn = !!session;

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-12">
      <header className="mb-12">
        <h1 className="text-[40px] font-bold uppercase leading-tight tracking-tight text-foreground">
          Pricing
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground">
          Subscription covers compute. Performance fee covers everything else — billed monthly on net profit above your previous high-water mark. Never charged during drawdowns.
        </p>
      </header>

      <div className="grid gap-px bg-[var(--hairline-strong)] sm:grid-cols-2 lg:grid-cols-4">
        {(["free", "basic", "pro", "capital"] as const).map((id) => {
          const t = TIERS[id];
          const isContact = id === "capital";
          return (
            <article key={id} className="bg-black p-6 flex flex-col">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t.label}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-3xl tabular-nums text-foreground">
                  {isContact ? "—" : t.priceUsdMonthly === 0 ? "$0" : `$${t.priceUsdMonthly}`}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {isContact ? "contact" : "/ month"}
                </span>
              </div>
              {t.perfFeePct > 0 && (
                <div className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-[var(--neon-cyan)]">
                  + {t.perfFeePct}% perf fee
                </div>
              )}
              <p className="mt-5 text-sm text-muted-foreground">{t.description}</p>
              <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
                <li>· Watcher cadence min {t.watcherMinCadenceSeconds}s</li>
                <li>· Up to {t.maxSolons} Solon{t.maxSolons === 1 ? "" : "s"}</li>
                <li>· {t.panelDeliberations ? "Full panel deliberation" : "Fast-Trader only"}</li>
                <li>· {t.publicProfile ? "Public profile enabled" : "No public profile"}</li>
              </ul>
              <div className="mt-auto pt-6">
                {id === "free" ? (
                  <Link
                    href={signedIn ? "/dashboard" : "/sign-up"}
                    className="inline-flex h-10 w-full items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
                  >
                    {signedIn ? "Open dashboard" : "Sign up free"}
                  </Link>
                ) : isContact ? (
                  <a
                    href="mailto:jagrit@wearemomentus.com?subject=Selbo Capital tier"
                    className="inline-flex h-10 w-full items-center justify-center border border-[var(--hairline-strong)] bg-black px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground transition hover:border-[var(--neon-cyan)] hover:text-[var(--neon-cyan)]"
                  >
                    Contact us
                  </a>
                ) : (
                  <CheckoutButton tier={id} signedIn={signedIn} />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
