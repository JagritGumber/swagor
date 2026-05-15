import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { memoryEntries } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/memory/[id]
 *
 * Body: { userFeedback: 'good' | 'bad' | null }
 * Sets the user's feedback on a memory entry. 'bad' rows are excluded
 * from getRecentLessons so the next agent context read drops the entry.
 * null clears the feedback. Authorization: caller must own the entry.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { userFeedback?: "good" | "bad" | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const fb = body.userFeedback;
  if (fb !== "good" && fb !== "bad" && fb !== null) {
    return NextResponse.json({ error: "userFeedback must be 'good' | 'bad' | null" }, { status: 400 });
  }

  await db
    .update(memoryEntries)
    .set({ userFeedback: fb })
    .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/memory/[id]
 *
 * Soft-deletes the entry (sets deletedAt). Excluded from GET and from
 * agent context reads. Authorization: caller must own the entry.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db
    .update(memoryEntries)
    .set({ deletedAt: new Date() })
    .where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
