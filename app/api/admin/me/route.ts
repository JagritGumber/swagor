import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tiny endpoint the client uses to gate admin-only UI. Returns
 * `{admin: boolean}` based on the same isAdmin check the server pages
 * use, so the toggle pill and dev panel can render without baking
 * ADMIN_EMAILS into the public bundle.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ admin: false });
  return NextResponse.json({ admin: isAdmin(session.user.email) });
}
