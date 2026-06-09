/**
 * Persists the platform's deployed contract addresses in the browser's
 * localStorage, keyed by chainId. This lets a user deploy the infrastructure
 * once and have every panel (and page reload) pick it up automatically — the
 * dApp equivalent of the deployments/<network>.json files used by the scripts.
 */

export interface PlatformDeployment {
  chainId: number;
  // OnchainID layer
  identityImplementation: string;
  oidImplementationAuthority: string;
  idFactory: string;
  claimIssuer: string;
  // T-REX implementation authority + factories
  trexImplementationAuthority: string;
  trexFactory: string;
  iaFactory: string;
  // Shared registry (the heart of the "whitelist all" policy)
  sharedIRS: string;
  sharedCTR: string;
  sharedTIR: string;
  sharedIR: string;
  // UI index
  platformRegistry: string;
  deployedAt: string;
  /** Bytecode fingerprint at deploy time — used to detect stale deployments. */
  artifactFingerprint?: string;
}

const keyFor = (chainId: number) => `tre-platform-deployment-${chainId}`;

export function loadDeployment(chainId: number): PlatformDeployment | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyFor(chainId));
  return raw ? (JSON.parse(raw) as PlatformDeployment) : null;
}

export function saveDeployment(d: PlatformDeployment): void {
  window.localStorage.setItem(keyFor(d.chainId), JSON.stringify(d));
}

export function clearDeployment(chainId: number): void {
  window.localStorage.removeItem(keyFor(chainId));
}
