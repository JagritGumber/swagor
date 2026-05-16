"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PauseConfirmDialog({
  open, onOpenChange, hasOpenPositions, onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  hasOpenPositions: boolean;
  onDone: () => void;
}) {
  const [closeOpen, setCloseOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/selbo/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true, closeOpenPositions: closeOpen }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { closedPositions?: { closed: number; failed: Array<{ tradeId: string; reason: string }> } };
      if (body.closedPositions) {
        const { closed, failed } = body.closedPositions;
        if (failed.length > 0) toast.error(`Paused. Closed ${closed}, ${failed.length} failed.`);
        else if (closed > 0) toast.success(`Paused. Closed ${closed} position${closed === 1 ? "" : "s"}.`);
        else toast.success("Paused.");
      } else {
        toast.success("Paused.");
      }
      onOpenChange(false);
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pause Selbo</AlertDialogTitle>
          <AlertDialogDescription>
            Selbo will stop monitoring markets and won&apos;t act on your open paper positions while paused. Any open positions remain as-is until you close them manually or resume Selbo. We make no claim of liability for outcomes on positions left open during a pause.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasOpenPositions && (
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={closeOpen}
              onChange={(e) => setCloseOpen(e.target.checked)}
              className="mt-1"
            />
            <span>Close my open paper positions now</span>
          </label>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={submitting}>
            {submitting ? "Pausing..." : "Pause Selbo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
