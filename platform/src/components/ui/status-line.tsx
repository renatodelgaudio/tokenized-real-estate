import * as React from "react";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/components/ui";

const MAP: Record<Exclude<ActionState, "idle">, { cls: string; Icon: React.ElementType }> = {
  running: { cls: "text-slate-500 bg-slate-50 border-slate-200", Icon: Loader2 },
  ok: { cls: "text-emerald-700 bg-emerald-50 border-emerald-200", Icon: CheckCircle2 },
  error: { cls: "text-red-700 bg-red-50 border-red-200", Icon: XCircle },
};

export function StatusLine({ state, message }: { state: ActionState; message?: string }) {
  if (state === "idle") return null;
  const { cls, Icon } = MAP[state];
  return (
    <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm animate-fade-in", cls)}>
      <Icon size={16} className={cn("mt-0.5 shrink-0", state === "running" && "animate-spin")} />
      <span className="break-words">{message ?? "Processing…"}</span>
    </div>
  );
}

export function InfoBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", className)}>
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
      <div>{children}</div>
    </div>
  );
}

export function SuccessBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900", className)}>
      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
      <div>{children}</div>
    </div>
  );
}
