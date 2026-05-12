import Link from "next/link";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server-client";

/**
 * Single primary nav button. Server component reads Supabase auth so the
 * correct label renders on first paint (no Sign In flash for signed-in users).
 * Style mirrors the hero "Deploy your Solon" CTA so the primary-action signal
 * stays consistent across the page.
 */
const BTN_CLASS =
  "cta-glow inline-flex h-9 items-center justify-center border border-[var(--neon-cyan)] bg-[var(--neon-cyan)] px-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-black hover:bg-black hover:text-[var(--neon-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--neon-cyan)] focus:ring-offset-2 focus:ring-offset-black";

export default async function AuthButton() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? (
    <Link href="/dashboard" className={BTN_CLASS}>
      Dashboard
    </Link>
  ) : (
    <Link href="/sign-in" className={BTN_CLASS}>
      Sign In
    </Link>
  );
}
