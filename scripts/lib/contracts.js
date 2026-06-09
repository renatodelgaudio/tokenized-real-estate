/**
 * Fully-qualified contract names (FQNs).
 *
 * Because we compile contracts from BOTH the T-REX and OnchainID packages, some
 * short names are ambiguous (e.g. there is more than one `ImplementationAuthority`
 * in scope). Hardhat therefore requires fully-qualified names of the form
 * `path/to/File.sol:ContractName` when looking up artifacts. Centralizing them
 * here keeps the deploy scripts readable and avoids typos.
 */
module.exports = {
  // --- OnchainID ---
  Identity: "@onchain-id/solidity/contracts/Identity.sol:Identity",
  OID_ImplementationAuthority:
    "@onchain-id/solidity/contracts/proxy/ImplementationAuthority.sol:ImplementationAuthority",
  IdFactory: "@onchain-id/solidity/contracts/factory/IdFactory.sol:IdFactory",
  ClaimIssuer: "@onchain-id/solidity/contracts/ClaimIssuer.sol:ClaimIssuer",

  // --- T-REX (ERC-3643) ---
  Token: "@tokenysolutions/t-rex/contracts/token/Token.sol:Token",
  IdentityRegistry:
    "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol:IdentityRegistry",
  IdentityRegistryStorage:
    "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistryStorage.sol:IdentityRegistryStorage",
  ClaimTopicsRegistry:
    "@tokenysolutions/t-rex/contracts/registry/implementation/ClaimTopicsRegistry.sol:ClaimTopicsRegistry",
  TrustedIssuersRegistry:
    "@tokenysolutions/t-rex/contracts/registry/implementation/TrustedIssuersRegistry.sol:TrustedIssuersRegistry",
  ModularCompliance:
    "@tokenysolutions/t-rex/contracts/compliance/modular/ModularCompliance.sol:ModularCompliance",
  TREXImplementationAuthority:
    "@tokenysolutions/t-rex/contracts/proxy/authority/TREXImplementationAuthority.sol:TREXImplementationAuthority",
  IAFactory:
    "@tokenysolutions/t-rex/contracts/proxy/authority/IAFactory.sol:IAFactory",
  TREXFactory:
    "@tokenysolutions/t-rex/contracts/factory/TREXFactory.sol:TREXFactory",

  // --- T-REX registry proxies (for the platform's shared registry) ---
  IdentityRegistryProxy:
    "@tokenysolutions/t-rex/contracts/proxy/IdentityRegistryProxy.sol:IdentityRegistryProxy",
  IdentityRegistryStorageProxy:
    "@tokenysolutions/t-rex/contracts/proxy/IdentityRegistryStorageProxy.sol:IdentityRegistryStorageProxy",
  ClaimTopicsRegistryProxy:
    "@tokenysolutions/t-rex/contracts/proxy/ClaimTopicsRegistryProxy.sol:ClaimTopicsRegistryProxy",
  TrustedIssuersRegistryProxy:
    "@tokenysolutions/t-rex/contracts/proxy/TrustedIssuersRegistryProxy.sol:TrustedIssuersRegistryProxy",

  // --- This project's UI index contract ---
  PlatformRegistry: "contracts/PlatformRegistry.sol:PlatformRegistry",
};
