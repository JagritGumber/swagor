"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PauseConfirmDialog } from "./pause-confirm-dialog";
import { ResumeConfirmDialog } from "./resume-confirm-dialog";

type StatusResponse = {
  killSwitchActive: boolean;
  hasOpenPositions: boolean;
  hasTodayPlan: boolean;
};

const POLL_MS = 5_000;

export function SelboStatusPill() {
  // Gate every fetch on a confirmed session so logged-out landing-page
  // visitors don't spam /api/selbo/status with 401s every 5s.
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/selbo/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json() as StatusResponse);
    } catch { /* swallow; pill stays on last known */ }
  }, []);

  useEffect(() => {
    if (!session) return;
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(t);
    };
  }, [refresh, session]);

  if (isPending || !session || !status) return null;
  const paused = status.killSwitchActive;
  const dotClass = paused ? "bg-[var(--neon-yellow)]" : "bg-[var(--neon-green)]";
  const label = paused ? "Selbo paused" : "Selbo running";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 border border-[var(--hairline-strong)] bg-black px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground hover:border-[var(--neon-cyan)]">
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
          {label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {paused ? "Selbo is paused" : "Selbo is running"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {paused ? (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setResumeOpen(true); }}>
              Resume Selbo
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPauseOpen(true); }}>
              Pause Selbo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PauseConfirmDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        hasOpenPositions={status.hasOpenPositions}
        onDone={refresh}
      />
      <ResumeConfirmDialog
        open={resumeOpen}
        onOpenChange={setResumeOpen}
        onDone={refresh}
      />
    </>
  );
}
