/**
 * ============================================================================
 * Step 1 / 4 — Deploy the OnchainID identity layer + the Claim Issuer
 * ============================================================================
 *
 * ERC-3643 tokens are "permissioned": only wallets with a verified on-chain
 * identity that carries the required claims may hold them. That identity layer
 * is provided by OnchainID. Before we can deploy a token we need:
 *
 *   1. Identity (implementation)   — the logic contract for every identity.
 *   2. ImplementationAuthority     — tells identity proxies which logic to use.
 *   3. IdFactory                   — a CREATE2 factory that deploys identities.
 *   4. ClaimIssuer                 — a special identity, owned by the issuer,
 *                                    that signs the KYC claims investors carry.
 *
 * We also grant the "claim signer" key (the deployer, or CLAIM_SIGNER_PRIVATE_KEY
 * if set) the CLAIM purpose (3) on the ClaimIssuer, so the signatures it produces
 * are accepted as valid by the token's identity registry.
 *
 * Run with:  npm run deploy:onchainid
 * ============================================================================
 */
const { ethers, network } = require("hardhat");
const FQN = require("./lib/contracts");
const deployments = require("./lib/deployments");
const { getSigners } = require("./lib/signers");
const { addressKey } = require("./lib/onboarding");
const { requirePersistentNetwork } = require("./lib/network");

// ERC-734 key purposes.
const PURPOSE_MANAGEMENT = 1;
const PURPOSE_CLAIM = 3;
// ERC-734 key type: 1 = ECDSA.
const KEY_TYPE_ECDSA = 1;

async function deploy(name, signer, ...args) {
  const factory = await ethers.getContractFactory(name, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`   ✓ ${labelFor(name).padEnd(26)} ${address}`);
  return contract;
}

function labelFor(fqn) {
  return fqn.split(":").pop();
}

async function main() {
  requirePersistentNetwork();
  const { deployer, claimSigner } = await getSigners();
  const deployerAddress = await deployer.getAddress();
  const claimSignerAddress = await claimSigner.getAddress();

  console.log("\n============================================================");
  console.log(" Step 1 — OnchainID identity layer + Claim Issuer");
  console.log("============================================================");
  console.log(` Network:      ${network.name}`);
  console.log(` Deployer:     ${deployerAddress}`);
  console.log(` Claim signer: ${claimSignerAddress}`);
  console.log("------------------------------------------------------------");

  // --- 1. Identity implementation ------------------------------------------
  // Deployed as a "library" (second constructor arg = true) so it can only be
  // used as logic behind proxies, never as a standalone identity.
  console.log("\n[1] Deploying OnchainID core...");
  const identityImpl = await deploy(FQN.Identity, deployer, deployerAddress, true);

  // --- 2. Implementation authority -----------------------------------------
  const oidAuthority = await deploy(
    FQN.OID_ImplementationAuthority,
    deployer,
    await identityImpl.getAddress()
  );

  // --- 3. Identity factory --------------------------------------------------
  const idFactory = await deploy(FQN.IdFactory, deployer, await oidAuthority.getAddress());

  // --- 4. Claim issuer ------------------------------------------------------
  // The ClaimIssuer is itself an identity whose management key is the deployer.
  console.log("\n[2] Deploying Claim Issuer (the KYC authority)...");
  const claimIssuer = await deploy(FQN.ClaimIssuer, deployer, deployerAddress);
  const claimIssuerAddress = await claimIssuer.getAddress();

  // Grant the claim signer the CLAIM purpose so its signatures are trusted.
  const signerKey = addressKey(claimSignerAddress);
  if (await claimIssuer.keyHasPurpose(signerKey, PURPOSE_CLAIM)) {
    console.log("   • claim signer already has CLAIM purpose");
  } else {
    await (await claimIssuer.addKey(signerKey, PURPOSE_CLAIM, KEY_TYPE_ECDSA)).wait();
    console.log(`   ✓ granted CLAIM purpose to ${claimSignerAddress}`);
  }
  // (The deployer already holds the MANAGEMENT purpose from the constructor.)
  void PURPOSE_MANAGEMENT;

  // --- Persist addresses ----------------------------------------------------
  const saved = deployments.save(network.name, {
    deployer: deployerAddress,
    claimSigner: claimSignerAddress,
    identityImplementation: await identityImpl.getAddress(),
    oidImplementationAuthority: await oidAuthority.getAddress(),
    idFactory: await idFactory.getAddress(),
    claimIssuer: claimIssuerAddress,
  });

  console.log("\n------------------------------------------------------------");
  console.log(` Saved to deployments/${network.name}.json`);
  console.log(" Next: npm run deploy:token");
  console.log("============================================================\n");
  return saved;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Step 1 failed:\n", error);
    process.exit(1);
  });
