import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildChartData, VALID_INTERVALS } from "@/app/services/chart-data.service";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const asset = (searchParams.get("asset") ?? "").toUpperCase();
  const interval = searchParams.get("interval") ?? "5m";
  const lookbackMs = Number(searchParams.get("lookbackMs") ?? 86_400_000);

  if (!asset) return NextResponse.json({ error: "asset required" }, { status: 400 });
  if (!VALID_INTERVALS.has(interval)) return NextResponse.json({ error: "bad interval" }, { status: 400 });
  if (!Number.isFinite(lookbackMs) || lookbackMs <= 0) {
    return NextResponse.json({ error: "bad lookbackMs" }, { status: 400 });
  }

  return NextResponse.json(await buildChartData({ userId: session.user.id, asset, interval, lookbackMs }));
}
