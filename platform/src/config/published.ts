import type { PlatformDeployment } from "@/lib/deployments";

/**
 * Published (shared) platform deployments, keyed by chainId.
 *
 * WHY THIS EXISTS
 * ---------------
 * When an Admin deploys the infrastructure, the resulting addresses are saved
 * only in *their* browser's localStorage. That is fine for the person driving
 * the deployment, but a different visitor (e.g. someone you share the public
 * URL with) has no way to know the contract addresses — so the Explorer would
 * have nothing to read.
 *
 * To make the app work for everyone, the operator does this once after
 * deploying on a network:
 *   1. Admin tab → "Copy deployment JSON".
 *   2. Paste it below, keyed by its chainId (11155111 = Sepolia, 31337 = local).
 *   3. Commit & rebuild. Now any visitor sees that deployment with no wallet
 *      and no localStorage of their own.
 *
 * Resolution order (see hooks/useDeployment.ts):
 *   localStorage (the operator's own session)  →  PUBLISHED (this file)
 *
 * Reads (Explorer, balances, verification status) need NO wallet — they go
 * through the configured RPC for the deployment's chainId. Writes (Admin/KYC/
 * Issuer actions) still require a connected wallet.
 */
export const PUBLISHED: Record<number, PlatformDeployment | undefined> = {
  // Example — paste a real deployment to enable the public Sepolia explorer:
  //
  // 11155111: {
  //   chainId: 11155111,
  //   identityImplementation: "0x…",
  //   oidImplementationAuthority: "0x…",
  //   idFactory: "0x…",
  //   claimIssuer: "0x…",
  //   trexImplementationAuthority: "0x…",
  //   trexFactory: "0x…",
  //   iaFactory: "0x…",
  //   sharedIRS: "0x…",
  //   sharedCTR: "0x…",
  //   sharedTIR: "0x…",
  //   sharedIR: "0x…",
  //   platformRegistry: "0x…",
  //   deployedAt: "2026-01-01T00:00:00.000Z",
  // },
};
