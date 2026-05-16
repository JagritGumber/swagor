"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ResumeConfirmDialog({
  open, onOpenChange, onDone,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/selbo/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { triggeredFirstPlan?: boolean };
      if (body.triggeredFirstPlan) {
        toast.success("Selbo enabled. Generating your first daily plan; check the Brain page in a minute.");
      } else {
        toast.success("Selbo enabled.");
      }
      onOpenChange(false);
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resume Selbo</AlertDialogTitle>
          <AlertDialogDescription>
            Selbo will start monitoring markets, generating daily plans, and executing paper trades according to your strategy. You can pause again from this menu at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={submitting}>
            {submitting ? "Resuming..." : "Resume Selbo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
