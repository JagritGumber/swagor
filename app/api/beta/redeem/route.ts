import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redeem a private-beta code. Compares against the BETA_CODE env (single
 * shared secret for now -- a per-code table can replace this when we need
 * per-invite tracking). On match, flips betaAccessGranted=true for the
 * caller's solon_instances row. Already-granted users get an idempotent
 * success response.
 *
 * When BETA_CODE is unset, the gate is disabled and all new signups are
 * auto-granted; this endpoint refuses with 410 to make that loud.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expected = process.env.BETA_CODE?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Beta is open; no redemption needed" },
      { status: 410 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "Code required" }, { status: 400 });
  }
  if (code !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 400 });
  }

  const [updated] = await db
    .update(solonInstances)
    .set({ betaAccessGranted: true, betaGrantedAt: new Date() })
    .where(eq(solonInstances.userId, session.user.id))
    .returning({
      betaAccessGranted: solonInstances.betaAccessGranted,
      betaGrantedAt: solonInstances.betaGrantedAt,
    });

  if (!updated) {
    return NextResponse.json({ ok: false, error: "No Solon instance" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...updated });
}
