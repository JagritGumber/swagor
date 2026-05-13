import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { polar, productIdForTier } from "@/lib/polar-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Polar Checkout session for the authed user on the requested
 * tier. `customerExternalId` carries our internal user_id so webhook
 * handlers can map back without a lookup. Metadata also includes the
 * solon_instance_id and the tier for redundancy.
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
    const checkout = await polar.checkouts.create({
      products: [productIdForTier(body.tier)],
      successUrl: `${origin}/dashboard?checkout=success`,
      customerExternalId: user.id,
      metadata: { userId: user.id, solonInstanceId: instance.id, tier: body.tier },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("[/api/polar/checkout]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
