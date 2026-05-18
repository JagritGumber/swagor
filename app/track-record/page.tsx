import { redirect } from "next/navigation";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Canonical demo URL. Auto-resolves to the earliest public Selbo profile
 * (selbo_instances.publicProfile=true and username IS NOT NULL, ordered
 * by created_at) and server-redirects to /selbo/{username}.
 *
 * Zero operator setup: the operator just flips their own profile public
 * from the dashboard and this URL works. Renders an empty-state card
 * when no public Selbo exists yet, never a 500.
 */
export default async function TrackRecordPage() {
  const [row] = await db.select({ username: selboInstances.username })
    .from(selboInstances)
    .where(and(
      eq(selboInstances.publicProfile, true),
      isNotNull(selboInstances.username),
    ))
    .orderBy(asc(selboInstances.createdAt))
    .limit(1);

  if (row?.username) redirect(`/selbo/${row.username}`);

  return (
    <div className="mx-auto max-w-2xl pb-24 pt-12">
      <div className="border border-[var(--hairline-strong)] bg-black p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--neon-cyan)]">
          Selbo · Track record
        </p>
        <h1 className="mt-4 text-2xl font-bold uppercase tracking-tight text-foreground">
          No public Selbo yet
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This URL resolves to the first Selbo profile flipped public.
          Toggle your profile public from the dashboard to claim it.
        </p>
      </div>
    </div>
  );
}
