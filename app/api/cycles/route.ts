import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  findOrCreatePortfolioForWallet,
  listRecentCycles,
} from "@/app/services/portfolio.service";

/**
 * GET /api/cycles?walletAddress=0x...
 * Lists recent rebalance cycles for the user's portfolio bound to this wallet.
 * Creates the portfolio on first request if one doesn't exist (idempotent).
 */
export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress")?.toLowerCase();

  if (!walletAddress || !/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "walletAddress (0x...) query param required" },
      { status: 400 },
    );
  }

  const portfolio = await findOrCreatePortfolioForWallet(
    user.id,
    walletAddress,
    "paper",
  );
  const cycles = await listRecentCycles(portfolio.id);

  return NextResponse.json({ portfolioId: portfolio.id, cycles });
}
