import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { selboInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runJudgmentForInstance } from "@/app/services/judgment/judgment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOLDOWN_MS = 10_000;

/**
 * Dev-only: force a judgment tick for the authed user's Selbo instance
 * regardless of schedule. Throttled to once per 10s.
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const [instance] = await db
    .select().from(selboInstances).where(eq(selboInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Selbo instance" }, { status: 404 });

  if (!instance.betaAccessGranted) {
    return NextResponse.json(
      { ok: false, error: "Beta access required. Redeem a code first." },
      { status: 403 },
    );
  }

  try {
    const result = await runJudgmentForInstance(instance.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
