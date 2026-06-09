"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "wagmi";
import { listInvestors, listTokens, type InvestorRow, type TokenRow } from "@/lib/platform";
import type { PlatformDeployment } from "@/lib/deployments";

/** Loads the investor index from the PlatformRegistry, with a manual refresh. */
export function useInvestors(deployment: PlatformDeployment | null) {
  const config = useConfig();
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!deployment) return;
    setLoading(true);
    try {
      setInvestors(await listInvestors(config, deployment));
    } finally {
      setLoading(false);
    }
  }, [config, deployment]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { investors, loading, refresh };
}

/** Loads the token index from the PlatformRegistry, with a manual refresh. */
export function useTokens(deployment: PlatformDeployment | null) {
  const config = useConfig();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!deployment) return;
    setLoading(true);
    try {
      setTokens(await listTokens(config, deployment));
    } finally {
      setLoading(false);
    }
  }, [config, deployment]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tokens, loading, refresh };
}
