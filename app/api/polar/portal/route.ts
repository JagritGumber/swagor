import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { polar } from "@/lib/polar-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Polar Customer Portal session for the authed user. The portal
 * lets them update payment method, cancel, or view invoices without us
 * building any of that UI.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance?.billingCustomerId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  try {
    const session = await polar.customerSessions.create({ customerId: instance.billingCustomerId });
    return NextResponse.json({ url: session.customerPortalUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal failed" },
      { status: 500 },
    );
  }
}
