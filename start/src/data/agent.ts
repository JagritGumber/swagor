import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/client.ts'
import { agents, agentWallets } from '@/db/schema.ts'
import type { SelectAgent, SelectAgentWallet } from '@/db/schema.ts'

// ─── Agent lookup ─────────────────────────────────────

export async function getAgentByUserId(userId: string): Promise<SelectAgent | null> {
  const db = await getDb()
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(1)
  return agent ?? null
}

export async function getAgentWithWallet(userId: string): Promise<{
  agent: SelectAgent
  wallet: SelectAgentWallet | null
} | null> {
  const db = await getDb()
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(1)

  if (!agent) return null

  const [wallet] = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.agentId, agent.id))
    .limit(1)

  return { agent, wallet: wallet ?? null }
}

// ─── Agent creation ───────────────────────────────────

export async function createAgent(userId: string): Promise<SelectAgent> {
  const db = await getDb()
  const id = randomUUID()
  await db.insert(agents).values({ id, userId })
  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1)
  return agent!
}

export async function getOrCreateAgent(userId: string): Promise<SelectAgent> {
  const existing = await getAgentByUserId(userId)
  if (existing) return existing
  return createAgent(userId)
}

// ─── Circle wallet allocation ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkInstance: any = null

function getCircleSdk() {
  if (sdkInstance) return sdkInstance

  const apiKey = process.env.CIRCLE_API_KEY
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET

  if (!apiKey || !entitySecret) {
    throw new Error('CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET environment variables are required')
  }

  const require = createRequire(import.meta.url)
  const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets')

  sdkInstance = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  })
  return sdkInstance
}

export async function allocateCircleWallet(userId: string): Promise<SelectAgentWallet> {
  const agent = await getOrCreateAgent(userId)

  const db = await getDb()
  const [existing] = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.agentId, agent.id))
    .limit(1)

  if (existing) return existing

  const sdk = getCircleSdk()

  const walletSet = await sdk.createWalletSet({
    name: `selbo-${userId.slice(0, 8)}`,
  })
  const walletSetId = walletSet.data?.walletSet?.id
  if (!walletSetId) throw new Error('Circle wallet set creation returned no id')

  const created = await sdk.createWallets({
    accountType: 'SCA',
    blockchains: ['ARC-TESTNET'],
    walletSetId,
    count: 1,
  })
  const wallet = created.data?.wallets?.[0]
  if (!wallet) throw new Error('Circle wallet creation returned no wallet')

  const walletId = randomUUID()
  const now = new Date()

  await db.insert(agentWallets).values({
    id: walletId,
    agentId: agent.id,
    circleWalletId: wallet.id,
    circleWalletAddress: wallet.address.toLowerCase(),
    createdAt: now,
  })

  const [inserted] = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.id, walletId))
    .limit(1)

  return inserted!
}
