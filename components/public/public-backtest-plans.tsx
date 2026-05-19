"use client";

import { useState } from "react";
import { BacktestPlansList, type BacktestPlan } from "@/components/dashboard/bento/backtest-plans-list";

/**
 * Client wrapper that owns the plans-open state so BacktestPlansList
 * stays controlled while its parent (FeaturedBacktestSections) is a
 * server component. Defaults to collapsed since plans are secondary
 * on a public profile.
 */
export function PublicBacktestPlans({ plans }: { plans: BacktestPlan[] }) {
  const [open, setOpen] = useState(false);
  return <BacktestPlansList plans={plans} open={open} onOpenChange={setOpen} />;
}
