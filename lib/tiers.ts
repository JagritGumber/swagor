/**
 * Subscription tier matrix. Single source of truth for tier-gated features.
 * Tier names match what's stored in selbo_instances.subscription_tier.
 *
 * Pricing model: monthly recurring subscription + future performance-fee
 * layer (10-15% on profits, billed monthly, high-water-mark protected).
 * The perf-fee logic lives in a separate billing service; this file is
 * about the per-tick / per-user feature gates.
 */

export type Tier = "free" | "basic" | "pro" | "capital";

export type TierSpec = {
  id: Tier;
  label: string;
  priceUsdMonthly: number;       // monthly recurring; 0 = free
  perfFeePct: number;            // 0 = no perf fee
  watcherMinCadenceSeconds: number;  // floor the watcher can pick
  watcherMaxCadenceSeconds: number;  // ceiling the watcher can pick
  maxSelbos: number;             // how many Selbo instances per user
  panelDeliberations: boolean;   // does swarm fire on deliberate verdicts
  publicProfile: boolean;        // can publish /selbo/{username}
  prioritySwarmQueue: boolean;   // future: jump the swarm work queue
  description: string;
};

export const TIERS: Record<Tier, TierSpec> = {
  free: {
    id: "free",
    label: "Trial",
    priceUsdMonthly: 0,
    perfFeePct: 0,
    watcherMinCadenceSeconds: 120,    // match schema floor; let the watcher pick fast when needed
    watcherMaxCadenceSeconds: 600,    // 10 min ceiling; funnel/demo tier should feel alive
    maxSelbos: 1,
    panelDeliberations: false,        // free tier skips expensive mid-day swarm refreshes
    publicProfile: false,
    prioritySwarmQueue: false,
    description: "Paper mode, slow cadence, no public profile. Funnel tier.",
  },
  basic: {
    id: "basic",
    label: "Trader",
    priceUsdMonthly: 20,
    perfFeePct: 10,
    watcherMinCadenceSeconds: 120,    // 2 min minimum
    watcherMaxCadenceSeconds: 1800,   // up to 30 min
    maxSelbos: 1,
    panelDeliberations: true,
    publicProfile: true,
    prioritySwarmQueue: false,
    description: "Full paper trading, public profile, panel deliberation, one Selbo instance.",
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceUsdMonthly: 49,
    perfFeePct: 15,
    watcherMinCadenceSeconds: 60,     // 1 min minimum
    watcherMaxCadenceSeconds: 1800,
    maxSelbos: 3,
    panelDeliberations: true,
    publicProfile: true,
    prioritySwarmQueue: true,
    description: "Multiple Selbos, priority queue, faster watcher, multi-venue when supported.",
  },
  capital: {
    id: "capital",
    label: "Capital",
    priceUsdMonthly: 0,                // bespoke, contact sales
    perfFeePct: 20,
    watcherMinCadenceSeconds: 30,
    watcherMaxCadenceSeconds: 1800,
    maxSelbos: 10,
    panelDeliberations: true,
    publicProfile: true,
    prioritySwarmQueue: true,
    description: "$50k+ accounts, custom personas, dedicated panel, 2/20 fee structure.",
  },
};

export function tierSpec(tier: Tier | null | undefined): TierSpec {
  return TIERS[tier ?? "free"] ?? TIERS.free;
}
