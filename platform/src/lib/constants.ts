// Mirrors scripts/lib/constants.js — kept in sync so the UI and the CLI behave
// identically on-chain.

export const KYC_CLAIM_TOPIC = 1n; // the claim topic meaning "KYC verified"
export const CLAIM_SCHEME_ECDSA = 1n; // ERC-735 ECDSA signature scheme
export const DEFAULT_COUNTRY = 840; // ISO 3166-1 numeric (840 = USA)
export const KYC_CLAIM_DATA = "KYC verified - Tokenized Real Estate Platform PoC";

// PlatformRegistry.Policy enum
export enum Policy {
  WhitelistCustom = 0,
  WhitelistAll = 1,
}
