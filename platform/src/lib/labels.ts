/**
 * OFF-CHAIN label store (browser localStorage), keyed by chainId.
 *
 * IMPORTANT — this is a deliberate teaching choice:
 *   Real identity data (names, passports, addresses) is NEVER stored on-chain.
 *   A public, immutable ledger is incompatible with privacy law (GDPR) and with
 *   the ERC-3643 design, where the on-chain identity only holds *claims* (signed
 *   attestations), not the underlying PII. The KYC provider keeps the real data
 *   off-chain in its own access-controlled database.
 *
 *   This PoC has no backend, so it simulates that off-chain database with the
 *   browser's localStorage. Labels here are FAKE demo names, local to this
 *   browser only — they are not shared, not authoritative, and never written to
 *   the blockchain.
 *
 * Labels are keyed by the ENTITY's identity contract address (lowercased),
 * because KYC is performed once per entity/identity — not per wallet.
 */

type LabelMap = Record<string, string>; // identityAddress(lowercase) -> label

const keyFor = (chainId: number) => `tre-platform-labels-${chainId}`;

export function getLabels(chainId: number): LabelMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(keyFor(chainId));
  return raw ? (JSON.parse(raw) as LabelMap) : {};
}

export function getLabel(chainId: number, identity: string): string | undefined {
  return getLabels(chainId)[identity.toLowerCase()];
}

export function setLabel(chainId: number, identity: string, label: string): void {
  const all = getLabels(chainId);
  all[identity.toLowerCase()] = label;
  window.localStorage.setItem(keyFor(chainId), JSON.stringify(all));
}
