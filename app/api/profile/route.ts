import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Body = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, dash, underscore only")
    .optional(),
  publicProfile: z.boolean().optional(),
});

/**
 * PATCH /api/profile -- updates the caller's username and/or public-profile
 * toggle on solon_instances. Username is unique across all instances; a
 * conflict returns 409 with a clear message so the dashboard form can
 * surface it.
 */
export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const patch = parsed.data;
  if (patch.username === undefined && patch.publicProfile === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(solonInstances)
      .set({
        ...(patch.username !== undefined && { username: patch.username }),
        ...(patch.publicProfile !== undefined && { publicProfile: patch.publicProfile }),
      })
      .where(eq(solonInstances.userId, session.user.id))
      .returning({
        username: solonInstances.username,
        publicProfile: solonInstances.publicProfile,
      });
    if (!updated) return NextResponse.json({ error: "No instance for user" }, { status: 404 });
    return NextResponse.json({ ok: true, ...updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
