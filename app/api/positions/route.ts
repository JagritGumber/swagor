import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getArcUsdcBalance } from "@/lib/protocols/arc-usdc";

/**
 * GET /api/positions?walletAddress=0x...
 * Returns the user's current on-chain positions. For now: just Arc Testnet
 * native USDC balance. Expands later to per-protocol reads.
 */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress")?.toLowerCase() as
    | `0x${string}`
    | undefined;

  if (!walletAddress || !/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "walletAddress (0x...) query param required" },
      { status: 400 },
    );
  }

  try {
    const arcBalance = await getArcUsdcBalance(walletAddress);
    return NextResponse.json({ positions: [arcBalance] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read positions" },
      { status: 502 },
    );
  }
}
