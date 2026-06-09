"use client";

import { useState, useCallback, type ReactNode } from "react";

/** A titled card section with an accent color bar. */
export function Section({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-1 h-8 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

/** Inline status line for an action (idle / running / ok / error). */
export function StatusLine({ state, message }: { state: ActionState; message?: string }) {
  if (state === "idle") return null;
  const map: Record<Exclude<ActionState, "idle">, { color: string; icon: string }> = {
    running: { color: "text-slate-500", icon: "⏳" },
    ok: { color: "text-emerald-600", icon: "✅" },
    error: { color: "text-red-600", icon: "⛔" },
  };
  const { color, icon } = map[state];
  return (
    <p className={`mt-3 break-words text-sm ${color}`}>
      {icon} {message}
    </p>
  );
}

/** Prominent reminder that PII never goes on-chain. */
export function PrivacyNote() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <b>🔒 Privacy:</b> real identity data (names, passports, addresses) is <b>never stored on-chain</b> — a public
      ledger is incompatible with privacy law (GDPR) and the ERC-3643 design. In production the KYC provider keeps that
      data <b>off-chain in its own secure database</b>; the chain only holds the signed KYC <i>claim</i>. For this PoC,
      the friendly label below is <b>stored only in your browser</b> (localStorage) to simulate that off-chain database.
    </div>
  );
}

// --- useAction: standard loading/result/error handling for a button ----------

export type ActionState = "idle" | "running" | "ok" | "error";

export function useAction() {
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState<string>();

  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setState("running");
    setMessage("Submitting transaction(s)… confirm in your wallet.");
    try {
      const result = await fn();
      setState("ok");
      setMessage(typeof result === "string" ? result : "Done.");
    } catch (e: unknown) {
      setState("error");
      const err = e as { shortMessage?: string; message?: string };
      setMessage(err.shortMessage || err.message || "Transaction failed.");
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setMessage(undefined);
  }, []);

  return { state, message, run, reset, pending: state === "running" };
}
