import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  findOrCreatePortfolioForWallet,
  saveGoal,
} from "@/app/services/portfolio.service";
import { db } from "@/lib/db/client";
import { solonInstances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/goals
 * Saves the user's strategy text on both the portfolio (legacy) and the
 * Solon instance (what the watcher reads). No LLM parsing.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user;

  const body = (await request.json().catch(() => ({}))) as {
    walletAddress?: string;
    goalText?: string;
  };
  const walletAddress = body.walletAddress?.toLowerCase();
  const goalText = body.goalText?.trim();

  if (!walletAddress || !/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
  }
  if (!goalText || goalText.length < 5) {
    return NextResponse.json({ error: "goalText required (min 5 chars)" }, { status: 400 });
  }

  try {
    const portfolio = await findOrCreatePortfolioForWallet(user.id, walletAddress, "paper");
    await Promise.all([
      saveGoal(portfolio.id, goalText, null),
      db
        .update(solonInstances)
        .set({ strategyText: goalText })
        .where(eq(solonInstances.userId, user.id)),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[/api/goals] save failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
