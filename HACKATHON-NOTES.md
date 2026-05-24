# Hackathon Notes — Selbo / Agora Agents (Canteen × Circle × Arc, RFB 01)

Last updated: 2026-05-25 (Mon)

## Deadlines

- **Hackathon submission**: EOD today (Monday 2026-05-25)
- **ArcOSS submission** (optional, separate): EOD today per aadi - "simple submission, considered for developer grant if compelling"

## Status snapshot

- Submitted Selbo to Agora hackathon on 2026-05-24
- Live at selbo.app (main branch deploys here)
- Repo public, demo video recorded + uploaded with submission
- V2 RL agent work parked on `dev` branch (deploys to dev.selbo.app when user wires it) - do not touch during submission window
- PR #176 shipped the setup-fingerprint primitive earlier on 2026-05-24, db pushed

## Architecture (confirmed correct per organizer)

- Execution: Hyperliquid testnet (perp price feed + market state)
- Settlement / accountability: Arc testnet via Circle Dev Wallet signing the PortfolioDecisions anchor contract
- This IS the intended RFB 01 architecture, confirmed by aadi: "the Hyperliquid + Arc-settlement pattern you two shipped is the reference design"
- Judges who wonder "why didn't you trade on Arc?" should be answered DIRECTLY on the landing page

## Key organizer-thread takeaways (Canteen Discord, threads 2026-05-24 evening)

- The "Arc Perp DEX" we both struggled to integrate is **not Arc's** - it's Shapeshifter's third-party deploy (devs@shapeshifter.builders) called "CMDT ClearingHouse"
- The EIP-712 order schema IS technically public via verified `OrderTypes.sol` source. We missed it because docs.arc.io contract-addresses page doesn't list these contracts at all - discoverability gap, not spec gap
- Real blockers for external agent builders on that perp DEX:
  - `settleBatch` is gated behind `SETTLEMENT_ROLE` (matcher closed)
  - Accounts are Fireblocks-custodied, contract checks signer via `getAccountOwner(accountId)`, binding provisioned off-chain
- RFB 01 frames Arc as a **settlement chain across existing perp markets**, NOT as a venue to trade on. Our execute-Hyperliquid + anchor-Arc setup is the intended design

## ArcOSS opportunity (Monday EOD)

aadi suggested: build a **forkable open-source perp DEX on Arc** that fills the gap Shapeshifter leaves (closed matcher, custodied accounts). Sorely-needed in the ecosystem per aadi. Path:

- Start with a deep-dive on **Tempo's enshrined DEX**: https://docs.tempo.xyz/guide/stablecoin-dex
- aadi tagged Malachite as possible related architecture - "worth thinking about"
- Submit "something simple" via ArcOSS before Monday EOD = compelling architecture sketch, NOT shipped code
- Win condition: clarity of approach + ecosystem fit, not implementation depth

## Landing page priorities (do FIRST today)

### Anchor the architecture explicitly

Add prominent copy on selbo.app pre-empting "why didn't you trade on Arc?":

> Arc is the settlement chain across existing perp markets, per RFB 01's intended architecture. Selbo executes on Hyperliquid testnet (publicly documented EIP-712 + matcher) and anchors every decision on Arc via Circle Dev Wallets. Settlement + accountability live on Arc; execution lives wherever there's liquid + documented orderbook surface.

(Tighten and place wherever it lands best - probably under the OnChainAnatomy section or just above it.)

### Other landing audit items (TBD after user pastes judging criteria)

- Audit each landing section (Hero, OnChainAnatomy, CTA, etc.) against the actual rubric
- Identify which criteria are well-served vs invisible
- Propose specific copy/section adds to close gaps
- **BLOCKED on user pasting the judging criteria** - cannot do this audit blind

## Parking lot (after hackathon submission deadline)

- **V2 RL agent**: standalone, scheduled via cron-job.org (NOT Vercel cron, already in use for V1 too). dev branch only. Plan checkpoint in `C:\Users\jagri\.claude\plans\better-path-phase-radiant-koala.md`
- **ArcOSS perp DEX submission**: Monday EOD. Deep-dive Tempo first, then ~1-2 page architecture sketch
- **Malachite consideration**: aadi's hint, worth a real think after hackathon dust settles
- **LearningPanel UI**: deferred from PR #176, needed once live fingerprint records cross N>=3
- **Direction-skew investigation**: 8-week backtest showed 18:1 short-to-long. Worth understanding before V2 model training

## Working notes for "I'll forget honestly"

- Branch: main = production / submission. dev = V2 RL agent work. Switch between as needed.
- Plan file is at `C:\Users\jagri\.claude\plans\better-path-phase-radiant-koala.md` (private, in my home dir). It has the V2 RL architecture checkpoint.
- Memory files at `C:\Users\jagri\.claude\projects\D--Projects-agoratest\memory\` - especially `feedback_selbo_v2_standalone.md` and `feedback_v2_uses_cronjob_org.md`
- arc-canteen CLI for product updates: `arc-canteen ls` + `arc-canteen update-product` via stdin pipe. Last update was the post-submission product update sent on 2026-05-24
- Vercel: user owns deploys, don't run `bun vercel --prod` from agent sandbox
- db:push: user runs it themselves after schema changes
