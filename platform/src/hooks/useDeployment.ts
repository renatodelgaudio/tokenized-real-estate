"use client";

import { useState, useEffect, useCallback } from "react";
import { useChainId } from "wagmi";
import { loadDeployment, saveDeployment, clearDeployment, type PlatformDeployment } from "@/lib/deployments";
import { artifactFingerprint } from "@/lib/contracts";
import { PUBLISHED } from "@/config/published";

/**
 * Reactive access to the platform deployment for the current chain.
 *
 * Resolution order:
 *   1. localStorage  — the operator's own browser session (set after deploying).
 *   2. PUBLISHED     — a committed, shared deployment (so visitors with no
 *                      localStorage, and the public Explorer, still work).
 *
 * Panels call `refresh()` / `set()` after deploying.
 */
export function useDeployment() {
  const chainId = useChainId();
  const [deployment, setDeployment] = useState<PlatformDeployment | null>(null);

  const refresh = useCallback(() => {
    setDeployment(loadDeployment(chainId) ?? PUBLISHED[chainId] ?? null);
  }, [chainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const set = useCallback((d: PlatformDeployment) => {
    saveDeployment(d);
    setDeployment(d);
  }, []);

  const clear = useCallback(() => {
    clearDeployment(chainId);
    setDeployment(null);
  }, [chainId]);

  const isStale =
    !!deployment?.artifactFingerprint &&
    deployment.artifactFingerprint !== artifactFingerprint();

  return { deployment, chainId, refresh, set, clear, isStale };
}
