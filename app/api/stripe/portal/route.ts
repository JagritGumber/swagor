import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Stripe Customer Portal session for the authed user. The portal
 * lets them update payment method, cancel, or view invoices without us
 * building any of that UI ourselves.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance?.stripeCustomerId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: instance.stripeCustomerId,
      return_url: `${origin}/dashboard`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal failed" },
      { status: 500 },
    );
  }
}
