import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { selboInstances, strategyRevisions } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { llm, MODELS } from "@/lib/llm-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELBO_REPLY_SYSTEM_PROMPT = `You are Selbo, a perp futures trader the user controls. They just updated their strategy. Reply with ONE plain-English sentence acknowledging the change and naming the practical adjustment you will make on the next watcher tick (e.g., "lower leverage", "wait longer between entries", "favor mean-reversion setups"). Do not parrot numbers or list specific assets; the agent picks those at runtime. Be concise.`;

const MAX_MESSAGE_CHARS = 2000;

/**
 * GET /api/strategy/chat
 *
 * Returns the caller's full revision history oldest-first, plus the
 * current denormalized strategyText cache. UI shows the cache as a
 * "starting strategy" preview when no revisions exist yet.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [instance] = await db.select().from(selboInstances)
    .where(eq(selboInstances.userId, session.user.id)).limit(1);

  const revisions = await db.select().from(strategyRevisions)
    .where(eq(strategyRevisions.userId, session.user.id))
    .orderBy(asc(strategyRevisions.createdAt));

  return NextResponse.json({
    currentStrategy: instance?.strategyText ?? null,
    revisions,
  });
}

/**
 * POST /api/strategy/chat
 *
 * Body: { message: string }. Appends a user-role row, updates the
 * strategyText cache so the next watcher tick picks it up, then calls
 * the LIGHT model for a one-sentence paraphrase and appends a selbo-role
 * row. Returns the full updated history. Raw text end-to-end (no field
 * extraction; see memory `no-prompt-parsing-of-strategy`).
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { message?: string } = {};
  try { body = (await request.json()) as typeof body; } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `message too long (max ${MAX_MESSAGE_CHARS} chars)` }, { status: 400 });
  }

  // User-side write is atomic: revision row + cache update commit together.
  // LLM paraphrase runs OUTSIDE the transaction because it can take
  // seconds and we do not want to hold a transaction open across a
  // network call to the provider.
  await db.transaction(async (tx) => {
    await tx.insert(strategyRevisions).values({
      userId: session.user.id, role: "user", message,
    });
    await tx.update(selboInstances)
      .set({ strategyText: message })
      .where(eq(selboInstances.userId, session.user.id));
  });

  let reply = "Got it. I will adjust on the next tick.";
  try {
    const completion = await llm.chat.completions.create({
      model: MODELS.LIGHT,
      messages: [
        { role: "system", content: SELBO_REPLY_SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      temperature: 0.4,
      max_tokens: 120,
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (raw) reply = raw;
  } catch (err) {
    console.error("[strategy-chat] paraphrase failed:", err);
  }

  await db.insert(strategyRevisions).values({
    userId: session.user.id, role: "selbo", message: reply,
  });

  const revisions = await db.select().from(strategyRevisions)
    .where(eq(strategyRevisions.userId, session.user.id))
    .orderBy(asc(strategyRevisions.createdAt));

  return NextResponse.json({ currentStrategy: message, revisions });
}
