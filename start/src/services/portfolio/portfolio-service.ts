import { eq, desc } from 'drizzle-orm'
import { portfolioPositions, portfolioSnapshots } from '@/db/schema'
import { getDb } from '@/db/client'
import type { Position, PortfolioSnapshot } from '@portfolio/src/types'

export async function loadOpenPositions(): Promise<Position[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(portfolioPositions)
    .where(eq(portfolioPositions.status, 'open'))

  return rows.map(rowToPosition)
}

export async function savePosition(position: Position): Promise<void> {
  const db = await getDb()
  await db.insert(portfolioPositions).values(positionToRow(position))
}

export async function updatePosition(position: Position): Promise<void> {
  const db = await getDb()
  await db
    .update(portfolioPositions)
    .set({
      status: position.status,
      exitPrice: position.exitPrice ?? null,
      exitTime: position.exitTime ?? null,
      exitReason: position.exitReason ?? null,
      pnlPct: position.pnlPct ?? null,
    })
    .where(eq(portfolioPositions.id, position.id))
}

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  const db = await getDb()
  await db.insert(portfolioSnapshots).values({
    equity: snapshot.equity,
    totalPnl: snapshot.totalPnl,
    dailyPnl: snapshot.dailyPnl,
    tradeCount: snapshot.tradeCount,
    winCount: snapshot.winCount,
    lossCount: snapshot.lossCount,
    openPositionCount: snapshot.openPositionCount,
  })
}

export async function getLatestSnapshot(): Promise<PortfolioSnapshot | null> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .orderBy(desc(portfolioSnapshots.createdAt))
    .limit(1)

  if (rows.length === 0) return null
  const row = rows[0]
  return {
    timestamp: row.createdAt.getTime(),
    equity: row.equity,
    totalPnl: row.totalPnl,
    dailyPnl: row.dailyPnl,
    tradeCount: row.tradeCount,
    winCount: row.winCount,
    lossCount: row.lossCount,
    openPositionCount: row.openPositionCount,
    positions: [],
  }
}

export async function getEquityCurve(limit = 100): Promise<{ timestamp: number; equity: number }[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .orderBy(desc(portfolioSnapshots.createdAt))
    .limit(limit)

  return rows.reverse().map((row) => ({
    timestamp: row.createdAt.getTime(),
    equity: row.equity,
  }))
}

export async function getPositions(status?: 'open' | 'closed'): Promise<Position[]> {
  const db = await getDb()
  const rows = status
    ? await db.select().from(portfolioPositions).where(eq(portfolioPositions.status, status))
    : await db.select().from(portfolioPositions)

  return rows.map(rowToPosition)
}

function rowToPosition(row: typeof portfolioPositions.$inferSelect): Position {
  return {
    id: row.id,
    asset: row.asset,
    side: row.side as 'long' | 'short',
    entryPrice: row.entryPrice,
    entryTime: row.entryTime,
    size: row.size,
    stop: row.stop,
    target: row.target,
    status: row.status as 'open' | 'closed',
    exitPrice: row.exitPrice ?? undefined,
    exitTime: row.exitTime ?? undefined,
    exitReason: row.exitReason as Position['exitReason'] ?? undefined,
    pnlPct: row.pnlPct ?? undefined,
    judgmentId: row.judgmentId ?? '',
  }
}

function positionToRow(position: Position) {
  return {
    id: position.id,
    asset: position.asset,
    side: position.side,
    entryPrice: position.entryPrice,
    entryTime: position.entryTime,
    size: position.size,
    stop: position.stop,
    target: position.target,
    status: position.status,
    exitPrice: position.exitPrice ?? null,
    exitTime: position.exitTime ?? null,
    exitReason: position.exitReason ?? null,
    pnlPct: position.pnlPct ?? null,
    judgmentId: position.judgmentId,
  }
}
