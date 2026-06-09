"use client";

import { useState, useEffect, useCallback } from "react";
import { useChainId } from "wagmi";
import { loadDeployment, saveDeployment, clearDeployment, type PlatformDeployment } from "@/lib/deployments";
import { artifactFingerprint } from "@/lib/contracts";
import { PUBLISHED } from "@/config/published";

type DeploymentSource = "localStorage" | "published" | null;

/**
 * Reactive access to the platform deployment for the current chain.
 *
 * Resolution order:
 *   1. localStorage  — the operator's own browser session (set after deploying).
 *   2. PUBLISHED     — a committed, shared deployment (so visitors with no
 *                      localStorage, and the public Explorer, still work).
 *
 * `isPublished` is true when the active deployment came from PUBLISHED (not
 * from the current browser's own deploy). In that case the operator has
 * pre-configured this shared instance and visitors do not need to deploy
 * anything themselves.
 */
export function useDeployment() {
  const chainId = useChainId();
  const [deployment, setDeployment] = useState<PlatformDeployment | null>(null);
  const [source, setSource] = useState<DeploymentSource>(null);

  const refresh = useCallback(() => {
    const local = loadDeployment(chainId);
    if (local) {
      setDeployment(local);
      setSource("localStorage");
    } else if (PUBLISHED[chainId]) {
      setDeployment(PUBLISHED[chainId]!);
      setSource("published");
    } else {
      setDeployment(null);
      setSource(null);
    }
  }, [chainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = useCallback((d: PlatformDeployment) => {
    saveDeployment(d);
    setDeployment(d);
    setSource("localStorage");
  }, []);

  // Fix: call refresh() after clearing so the PUBLISHED fallback is applied
  // immediately instead of leaving the UI in a broken null state.
  const clear = useCallback(() => {
    clearDeployment(chainId);
    refresh();
  }, [chainId, refresh]);

  const isPublished = source === "published";

  // Stale detection only applies to locally-deployed instances (PUBLISHED
  // deployments are pinned by the operator and don't carry a fingerprint).
  //
  // A deployment with NO fingerprint was created before the fingerprinting
  // system was introduced. We can't verify its contracts, so we treat it as
  // stale — it was almost certainly deployed from older bytecode that is
  // missing functions like getInvestors/getIdentity.
  const isStale =
    source === "localStorage" &&
    (
      !deployment?.artifactFingerprint ||
      deployment.artifactFingerprint !== artifactFingerprint()
    );

  return { deployment, chainId, refresh, set, clear, isPublished, isStale };
}
