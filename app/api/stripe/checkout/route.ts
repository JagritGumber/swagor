import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stripe, priceIdForTier } from "@/lib/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Stripe Checkout session for the authed user on the requested
 * tier. Reuses the user's Stripe customer if one exists; otherwise lets
 * Stripe create it from the email. Tier is enforced by webhook on success.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { tier?: string };
  if (body.tier !== "basic" && body.tier !== "pro") {
    return NextResponse.json({ error: "tier must be 'basic' or 'pro'" }, { status: 400 });
  }

  const [instance] = await db
    .select().from(solonInstances).where(eq(solonInstances.userId, user.id)).limit(1);
  if (!instance) return NextResponse.json({ error: "No Solon instance" }, { status: 404 });

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceIdForTier(body.tier), quantity: 1 }],
      customer: instance.stripeCustomerId ?? undefined,
      customer_email: instance.stripeCustomerId ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, solonInstanceId: instance.id, tier: body.tier },
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[/api/stripe/checkout]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
