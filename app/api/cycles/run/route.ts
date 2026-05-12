import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import {
  findOrCreatePortfolioForWallet,
  createCycle,
} from "@/app/services/portfolio.service";
import { runCycle } from "@/app/services/orchestrator.service";

/**
 * POST /api/cycles/run
 * Body: { walletAddress: string }
 * Creates a rebalance cycle in 'running' status tied to the user's portfolio
 * (looked up or created for their connected wallet). Does NOT yet run agents
 * synchronously; that hook is wired in once the agent chain is built.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    walletAddress?: string;
  };
  const walletAddress = body.walletAddress?.toLowerCase();

  if (!walletAddress || !/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "walletAddress (0x...) required" },
      { status: 400 },
    );
  }

  const portfolio = await findOrCreatePortfolioForWallet(
    user.id,
    walletAddress,
    "paper",
  );
  const cycle = await createCycle(portfolio.id);

  // Fire-and-forget the orchestrator. Returns the cycle ID immediately so
  // the client can show "running" status; the orchestrator updates the row
  // to approved/rejected/failed when done.
  void runCycle(cycle.id).catch((err) => {
    console.error("Orchestrator dispatch failed:", err);
  });

  return NextResponse.json({
    cycleId: cycle.id,
    portfolioId: portfolio.id,
    status: cycle.status,
  });
}
