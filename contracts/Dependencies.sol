// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/**
 * @title Dependencies
 * @notice This file does not contain any logic of its own. Its sole purpose is
 *         to `import` the concrete contracts shipped by the T-REX and OnchainID
 *         packages so that Hardhat compiles them and generates their artifacts
 *         (ABI + bytecode) under `artifacts/`.
 *
 *         The deployment scripts in `scripts/` then load those artifacts by
 *         their fully-qualified names and deploy them with ethers.js. Compiling
 *         from source (instead of relying on the pre-built artifacts shipped in
 *         the npm package) keeps this repository transparent and auditable: the
 *         exact bytecode you deploy is produced from the source you can read.
 *
 *         We only import the contracts we actually deploy:
 *
 *         OnchainID (decentralized identity layer):
 *           - Identity                : the identity contract implementation
 *           - ImplementationAuthority : points proxies at the Identity logic
 *           - IdFactory               : CREATE2 factory for identity proxies
 *           - ClaimIssuer             : an Identity that can sign/revoke claims
 *
 *         T-REX (ERC-3643 permissioned token suite):
 *           - Token                     : the ERC-3643 security token logic
 *           - IdentityRegistry          : maps wallets -> identities, verifies
 *           - IdentityRegistryStorage   : shared storage for the registry
 *           - ClaimTopicsRegistry       : the claim topics required to hold
 *           - TrustedIssuersRegistry    : the claim issuers the token trusts
 *           - ModularCompliance         : pluggable transfer-rule engine
 *           - TREXImplementationAuthority : versioned logic for all proxies
 *           - IAFactory                 : deploys per-token implementation auth
 *           - TREXFactory               : one-call deployment of a full suite
 */

// --- OnchainID ---------------------------------------------------------------
import "@onchain-id/solidity/contracts/Identity.sol";
import "@onchain-id/solidity/contracts/proxy/ImplementationAuthority.sol";
import "@onchain-id/solidity/contracts/factory/IdFactory.sol";
import "@onchain-id/solidity/contracts/ClaimIssuer.sol";

// --- T-REX (ERC-3643) --------------------------------------------------------
import "@tokenysolutions/t-rex/contracts/token/Token.sol";
import "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistry.sol";
import "@tokenysolutions/t-rex/contracts/registry/implementation/IdentityRegistryStorage.sol";
import "@tokenysolutions/t-rex/contracts/registry/implementation/ClaimTopicsRegistry.sol";
import "@tokenysolutions/t-rex/contracts/registry/implementation/TrustedIssuersRegistry.sol";
import "@tokenysolutions/t-rex/contracts/compliance/modular/ModularCompliance.sol";
import "@tokenysolutions/t-rex/contracts/proxy/authority/TREXImplementationAuthority.sol";
import "@tokenysolutions/t-rex/contracts/proxy/authority/IAFactory.sol";
import "@tokenysolutions/t-rex/contracts/factory/TREXFactory.sol";

// --- T-REX registry proxies (used to stand up the platform's SHARED registry) -
// The TREXFactory deploys these proxies internally for each token. The platform
// also deploys a standalone *shared* registry (storage + IR + CTR + TIR) that
// "whitelist all" tokens bind to, so we need their artifacts in the frontend.
import "@tokenysolutions/t-rex/contracts/proxy/IdentityRegistryProxy.sol";
import "@tokenysolutions/t-rex/contracts/proxy/IdentityRegistryStorageProxy.sol";
import "@tokenysolutions/t-rex/contracts/proxy/ClaimTopicsRegistryProxy.sol";
import "@tokenysolutions/t-rex/contracts/proxy/TrustedIssuersRegistryProxy.sol";
