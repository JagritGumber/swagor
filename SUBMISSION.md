# Submission Rehearsal — Selbo (RFB 01)

Hackathon: Agora Agents (Canteen x Circle x Arc).
Deadline: 2026-05-25.

This doc is the operator script for submission day. Run the pre-flight checklist, then record the demo using the script, then submit the artifacts.

## Pre-flight checklist

Run T-2 (~48h before deadline) so any fix has a day to land.

- [ ] `git pull` on `main`; verify there are no open PRs you forgot to merge.
- [ ] `bun install`.
- [ ] `bun run db:push` — applies any new migrations (`0005_memory_feedback`, `0007_tos_accepted`, `0008_strategy_revisions`, plus any codex shipped).
- [ ] `bun run typecheck` — green.
- [ ] `.dev.vars` is up to date locally; production env synced to Vercel (NEXT_PUBLIC_* and server-side vars).
- [ ] `cron-job.org` (or your equivalent) is hitting `/api/watcher/tick` with the `CRON_SECRET` bearer. Confirm a recent 200 in the cron logs.
- [ ] Visit production `/dashboard` on an incognito tab: ToS modal renders, accept, dashboard loads.
- [ ] Visit `/legal/disclaimer` on a phone (or DevTools 375px viewport): paragraphs wrap, headings legible, no horizontal scroll.
- [ ] Visit `/metrics` as an admin email: 10 tiles render with non-zero numbers (if cron has run).
- [ ] README on GitHub renders the current "What the user sees" section without broken links.

## Smoke-test golden path

Run on a fresh account (use a new email or wipe an existing test instance).

1. **Sign in** (passwordless or whatever the active method is).
2. **Wallet verification** at `/verify-wallet`: connect MetaMask, sign the one-time SIWE-style message. Redirected to `/dashboard`.
3. **ToS modal** appears on first dashboard load. Check the box, click "Accept and continue". Modal closes.
4. **Bento layout** renders without scrolling on a 1440x900 viewport. Row 1: Activity tape + Balance/risk. Row 2: Market chart + Equity curve.
5. **Balance/risk tile** initially shows "first snapshot N min ago" with the seeded simulated balance. Within ~2 minutes (or after manual tick) the equity USD updates.
6. **Trigger a watcher tick** (admin dev controls, bottom disclosure). Tick row appears at the top of Activity tape within ~3s.
7. **Equity curve** placeholder reads "Need at least 2 snapshots". After the second tick fires, the area chart renders.
8. **Market chart**: switch asset between watching list. Confirm candles render. If a trade exists on the selected asset, arrow marker appears at entry.
9. **Open a synthetic trade** (force-tick the trader via the watcher's `execute` verdict — or use admin dev controls if you have a "force trade" path). New trade marker appears within one tick.
10. **Click the marker on the chart** — TradeDecisionDrawer slides in below the chart. Sections: Trade, Why it opened, Market context, Risk read, Why closed (open trade: "Still open."), Arc proofs.
11. **Refine strategy**: click "Refine strategy" on the Strategy card. Drawer slides from the right. Type "trade less, lower risk, max 1% daily target". Send. Selbo replies with a one-sentence paraphrase. Press Esc to close.
12. **Memory disclosure** (collapsed at bottom of dashboard): expand. If at least one trade has closed, lessons render. Thumbs-down one row: card dims with red border. Next watcher tick should not cite the bad-rated lesson (verify via admin LLM call log if needed).
13. **Footer disclaimer link** at the bottom of every page: opens `/legal/disclaimer` in a new tab. Readable.
14. **Visit `/metrics`** as admin. Numbers populate from the just-ran cycle.

## 90-second demo script

Read aloud while screen-recording. Voice over OR captioned video, both work.

```
0:00 (open)
"Selbo is an autonomous perp futures trader. Paper mode on Hyperliquid
testnet. Built for RFB 01 of the Agora Agents hackathon."

0:08 (sign up)
"New users sign up, link their wallet for Sybil resistance, and accept
the paper-mode disclaimer before the dashboard unlocks."

0:18 (dashboard overview)
"One viewport. Activity tape on the left shows every watcher tick and
trade. Balance and risk on the right. Below: the price chart with
trade markers, and the wallet equity curve."

0:30 (decision drawer)
"Click any trade marker. The decision drawer shows the watcher's
rationale, the trader's rationale, the market features Selbo was
looking at, the risk read at the time, and Arc anchor links. This is
the legal-shield surface — every action Selbo took is one click away
from its full reasoning."

0:48 (strategy chat)
"The user updates strategy in plain English. Selbo paraphrases what it
heard. The next watcher tick uses the new strategy."

1:00 (memory)
"Selbo remembers lessons from closed trades. The user can thumbs-down a
bad lesson and Selbo stops citing it."

1:10 (metrics)
"Admin /metrics page shows the RFB 01 traction numbers: active Selbos,
ticks per 24h, paper volume, realized PnL, win rate, LLM cost."

1:25 (close)
"Selbo. Risk-first AI perp trader. Every decision visible. Every trade
anchored on Arc."
```

Hard 90s. Edit ruthlessly if you go over.

## Submission artifacts

Gather everything in one folder before the deadline form opens.

- [ ] 90-second demo video (mp4, < 100 MB).
- [ ] Public dashboard link (`https://<your-domain>/selbo/<your-username>` if you've made one public).
- [ ] Repository link: `https://github.com/JagritGumber/swagor`.
- [ ] README link (GitHub renders the live README).
- [ ] Three screenshots: bento dashboard, decision drawer open, /metrics page.
- [ ] One paragraph submission blurb (use the demo script opening + one closing line).

## Known limitations (state explicitly on submission)

- Paper mode only; no live venue execution.
- Hyperliquid testnet for market data; not multi-venue.
- Risk limits derived from tier defaults; no user-editable thresholds.
- Mobile dashboard is desktop-first (1024+); legal page is mobile-readable.
- LLM cost in `/metrics` is raw tokens, not dollars (pricing varies by vendor).

## Day-of: what NOT to do

- Do NOT run `bun run db:push` on production within an hour of submission. Schema changes destabilize traction numbers.
- Do NOT push to `main` within an hour of submission. Vercel takes 60-120s to deploy; a broken deploy at submission time is unrecoverable.
- Do NOT clear cookies or sessions mid-record; the ToS modal might re-show.

## After submission

- [ ] Tag the submission commit: `git tag rfb-01-submission && git push origin rfb-01-submission`.
- [ ] Post a brief "what shipped" note in your channel of choice.
- [ ] Keep the cron running for 48h post-deadline so judges who visit late see live data.
