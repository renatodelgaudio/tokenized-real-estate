import type { InvestorRow } from "./platform";

/**
 * An entity = one OnchainID identity (one KYC) with one or more wallets linked
 * to it. The on-chain PlatformRegistry stores each wallet→identity row; we group
 * those rows by identity to reconstruct the entity view, and attach the
 * off-chain label.
 */
export interface Entity {
  identity: string;
  label?: string;
  country: number;
  wallets: string[];
}

export function groupByEntity(rows: InvestorRow[], labelOf: (identity: string) => string | undefined): Entity[] {
  const map = new Map<string, Entity>();
  for (const r of rows) {
    const key = r.identity.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { identity: r.identity, label: labelOf(r.identity), country: r.country, wallets: [] });
    }
    map.get(key)!.wallets.push(r.wallet);
  }
  return [...map.values()];
}
