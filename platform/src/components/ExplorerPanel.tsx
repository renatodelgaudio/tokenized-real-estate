"use client";

import { useState, useEffect, useMemo } from "react";
import { useChainId, useConfig } from "wagmi";
import type { Address } from "viem";
import { Section } from "./ui";
import { AddressLink } from "./AddressLink";
import { useInvestors, useTokens } from "@/hooks/useRegistry";
import { loadDeployment, type PlatformDeployment } from "@/lib/deployments";
import { PUBLISHED } from "@/config/published";
import { SUPPORTED_CHAINS } from "@/lib/wagmi";
import { getLabel } from "@/lib/labels";
import { groupByEntity } from "@/lib/entities";
import { totalSupplyOf, tokenPaused } from "@/lib/platform";
import { Badge } from "@/components/ui/badge";

const ACCENT = "#0ea5e9";
const CHAIN_IDS = Object.keys(SUPPORTED_CHAINS).map(Number);

/**
 * The Explorer is read-only and works WITHOUT a connected wallet: it reads
 * through the configured RPC for whichever network is selected below. It needs
 * to know the platform addresses, which it resolves from (1) this browser's
 * localStorage, or (2) a committed PUBLISHED deployment (see config/published.ts).
 */
export function ExplorerPanel() {
  const connectedChainId = useChainId();
  const config = useConfig();
  const [viewChainId, setViewChainId] = useState<number>(connectedChainId);
  const [deployment, setDeployment] = useState<PlatformDeployment | null>(null);
  const [supplies, setSupplies] = useState<Map<string, bigint>>(new Map());
  const [pausedMap, setPausedMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    setDeployment(loadDeployment(viewChainId) ?? PUBLISHED[viewChainId] ?? null);
  }, [viewChainId]);

  const { tokens, refresh: rt } = useTokens(deployment);
  const { investors, refresh: ri } = useInvestors(deployment);

  useEffect(() => {
    if (tokens.length === 0 || !deployment) return;
    Promise.all(
      tokens.map((t) =>
        totalSupplyOf(config, t.token as Address, deployment.chainId)
          .then((s) => [t.token, s] as [string, bigint])
          .catch(() => [t.token, null] as [string, null])
      )
    ).then((entries) =>
      setSupplies(new Map(entries.filter((e): e is [string, bigint] => e[1] !== null)))
    );

    Promise.all(
      tokens.map((t) =>
        tokenPaused(config, t.token as Address)
          .then((p) => [t.token, p] as [string, boolean])
          .catch(() => [t.token, null] as [string, null])
      )
    ).then((entries) =>
      setPausedMap(new Map(entries.filter((e): e is [string, boolean] => e[1] !== null)))
    );
  }, [tokens, deployment]);

  const entities = useMemo(
    () => groupByEntity(investors, (id) => getLabel(viewChainId, id)),
    [investors, viewChainId]
  );

  return (
    <Section
      title="📊 Explorer — Platform Overview"
      subtitle="A public, read-only view of everything issued on the platform — no wallet required."
      accent={ACCENT}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="label mb-0">Network</span>
        <select className="input w-auto" value={viewChainId} onChange={(e) => setViewChainId(Number(e.target.value))}>
          {CHAIN_IDS.map((id) => (
            <option key={id} value={id}>
              {SUPPORTED_CHAINS[id as keyof typeof SUPPORTED_CHAINS].name}
            </option>
          ))}
        </select>
        {deployment && (
          <button className="text-sm text-slate-500 hover:underline" onClick={() => { rt(); ri(); }}>
            Refresh
          </button>
        )}
      </div>

      {!deployment ? (
        <div className="rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No platform deployment known for this network. Either deploy it in the{" "}
          <b>Admin</b> tab, or have the operator publish addresses in{" "}
          <code className="mono">platform/src/config/published.ts</code> to make this explorer public.
        </div>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-700">Tokens ({tokens.length})</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tokens.length === 0 && <p className="text-sm text-slate-400">No tokens issued yet.</p>}
            {tokens.map((t) => (
              <div key={t.token} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <b className="text-slate-800">{t.name}</b>
                  <div className="flex items-center gap-1.5">
                    {pausedMap.has(t.token) && (
                      <Badge variant={pausedMap.get(t.token) ? "red" : "green"}>
                        {pausedMap.get(t.token) ? "⏸ Paused" : "● Live"}
                      </Badge>
                    )}
                    <span className="badge bg-slate-100 text-slate-600">{t.symbol}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Policy:{" "}
                  <span className={t.policy === 1 ? "text-emerald-600" : "text-amber-600"}>
                    {t.policy === 1 ? "Whitelist all" : "Whitelist custom"}
                  </span>
                </p>
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>Token</span>
                  <AddressLink address={t.token} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Issuer</span>
                  <AddressLink address={t.issuer} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Total supply</span>
                  <span className="font-medium text-slate-700">
                    {supplies.has(t.token) ? supplies.get(t.token)!.toString() : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-sm font-semibold text-slate-700">Investor base ({entities.length} entities)</h3>
          <p className="mb-2 text-xs text-slate-500">
            KYC&apos;d once per entity and shared across all &quot;whitelist all&quot; tokens. Each entity may link several
            wallets to its single identity. Labels are off-chain (shown only if known to this browser).
          </p>
          <div className="space-y-2">
            {entities.length === 0 && <p className="text-sm text-slate-400">No investors onboarded yet.</p>}
            {entities.map((en) => (
              <div key={en.identity} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {en.label || <span className="text-slate-400">(unlabeled entity)</span>}
                  </span>
                  <span className="text-xs text-slate-500">identity <AddressLink address={en.identity} /></span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Wallets ({en.wallets.length}):{" "}
                  {en.wallets.map((w) => (
                    <span key={w} className="mr-2"><AddressLink address={w} /></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}
