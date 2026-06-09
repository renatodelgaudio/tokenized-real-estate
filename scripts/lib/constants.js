/**
 * Project-wide constants for the Tokenized Real Estate PoC.
 */
module.exports = {
  // --- Token parameters -----------------------------------------------------
  // The fictional real-estate asset being tokenized.
  TOKEN_NAME: "Tokenized Real Estate Token",
  TOKEN_SYMBOL: "TRE",
  // We use 0 decimals so that 1 TRE == 1 indivisible share of the property.
  // This keeps the demo arithmetic clean (no wei-style 18-decimal scaling).
  TOKEN_DECIMALS: 0,

  // Deterministic salt used by the TREXFactory's CREATE2 deployment. Re-running
  // the deploy script with the same salt is detected and skipped (idempotent).
  TOKEN_SALT: "TRE-v1",

  // --- Claim / identity parameters -----------------------------------------
  // The claim topic that this token requires every holder to possess.
  // Claim topics are simply agreed-upon uint256 identifiers. We use 1 to mean
  // "KYC verified". In a production deployment these are coordinated across
  // issuers (see the ERC-3643 / OnchainID topic conventions).
  KYC_CLAIM_TOPIC: 1n,

  // ECDSA signature scheme for claims (scheme id 1 in ERC-735).
  CLAIM_SCHEME_ECDSA: 1n,

  // ISO 3166-1 numeric country code stored against each identity in the
  // registry. 840 = United States. Purely informational for this PoC.
  INVESTOR_COUNTRY: 840,

  // Human-readable payload embedded in the KYC claim. In reality this would
  // typically be a hash/reference to off-chain KYC documentation, never PII.
  KYC_CLAIM_DATA: "KYC verified - Tokenized Real Estate PoC",

  // Initial supply minted to the issuer treasury in the transfer test (script 04).
  INITIAL_SUPPLY: 1_000_000n,
};
