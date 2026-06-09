"use client";

import { useState } from "react";
import { useAccount, useConfig } from "wagmi";
import type { Address } from "viem";
import { useAction } from "./ui";
import { AddressLink } from "./AddressLink";
import { useDeployment } from "@/hooks/useDeployment";
import { deployInfrastructure, type StepUpdate } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusLine, SuccessBox } from "@/components/ui/status-line";
import { Settings2, CheckCircle2, Loader2, Circle, Copy, Trash2 } from "lucide-react";

const ACCENT = "#6366f1";

const ADDRESS_LABELS: { key: string; label: string }[] = [
  { key: "idFactory", label: "IdFactory" },
  { key: "claimIssuer", label: "ClaimIssuer" },
  { key: "trexFactory", label: "TREXFactory" },
  { key: "sharedIR", label: "Shared IdentityRegistry" },
  { key: "sharedIRS", label: "Shared Registry Storage" },
  { key: "platformRegistry", label: "PlatformRegistry" },
];

export function AdminPanel() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { deployment, chainId, set, clear, isStale } = useDeployment();
  const action = useAction();
  const [steps, setSteps] = useState<StepUpdate[]>([]);

  function onStep(u: StepUpdate) {
    setSteps((prev) => {
      const next = [...prev];
      next[u.index] = u;
      return next;
    });
  }

  async function handleDeploy() {
    if (!address) return;
    setSteps([]);
    await action.run(async () => {
      const d = await deployInfrastructure(config, address as Address, chainId, onStep);
      set(d);
      return "Infrastructure deployed and saved to this browser.";
    });
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: "#eef2ff" }}>
              <Settings2 size={20} style={{ color: ACCENT }} />
            </div>
            <div>
              <CardTitle>Admin — Platform Infrastructure</CardTitle>
              <CardDescription>
                Deploy the shared identity &amp; token infrastructure once per network.
                This is the platform operator's job (e.g. Tokeny, Taurus).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!isConnected && (
            <p className="text-sm text-slate-500">Connect your wallet to begin.</p>
          )}

          {isConnected && !deployment && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                No infrastructure found on this network yet. Clicking below will deploy ~26 contracts/transactions, one by one.
                You will confirm each in your wallet.
              </div>
              <Button
                onClick={handleDeploy}
                disabled={action.pending}
                style={{ backgroundColor: ACCENT }}
              >
                {action.pending ? (
                  <><Loader2 size={14} className="animate-spin" /> Deploying…</>
                ) : (
                  "Deploy Platform Infrastructure"
                )}
              </Button>
              <StatusLine state={action.state} message={action.message} />

              {steps.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Deployment progress</p>
                  <ol className="space-y-2">
                    {steps.map((s, idx) => (
                      <li key={idx} className="flex items-center gap-2.5 text-sm">
                        {s.status === "done" ? (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                        ) : s.status === "running" ? (
                          <Loader2 size={14} className="shrink-0 animate-spin text-indigo-500" />
                        ) : (
                          <Circle size={14} className="shrink-0 text-slate-300" />
                        )}
                        <span className={s.status === "done" ? "text-slate-600" : s.status === "running" ? "font-medium text-slate-800" : "text-slate-400"}>
                          {s.label}
                        </span>
                        {s.address && <AddressLink address={s.address} />}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {isConnected && deployment && (
            <div className="space-y-4">
              {isStale ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <b>Stale deployment detected.</b> The contract artifacts have changed since this deployment was created
                  (the compiled bytecode no longer matches what is on-chain). Calls to new functions like{" "}
                  <code>getIdentity</code> or <code>getInvestors</code> will fail with a cryptic "0x" error.
                  Use <b>Forget deployment</b> below and redeploy to fix this.
                </div>
              ) : (
                <SuccessBox>Platform infrastructure is live on this network.</SuccessBox>
              )}

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Deployed contracts</p>
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {ADDRESS_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5">
                      <span className="text-sm text-slate-500">{label}</span>
                      <AddressLink address={(deployment as unknown as Record<string, string>)[key]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(deployment, null, 2));
                    alert(
                      "Deployment JSON copied.\n\nTo make a PUBLIC explorer (so others with no wallet can view this platform), " +
                        "paste it into platform/src/config/published.ts under this chainId, then commit & rebuild."
                    );
                  }}
                >
                  <Copy size={14} /> Copy deployment JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Forget this deployment from your browser? The contracts stay on-chain.")) clear();
                  }}
                >
                  <Trash2 size={14} className="text-red-400" /> Forget deployment
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
