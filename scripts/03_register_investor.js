/**
 * ============================================================================
 * Step 3 / 4 — Onboard an investor (identity + KYC claim + registration)
 * ============================================================================
 *
 * This is the "compliance" half of ERC-3643 in action. To let a wallet hold the
 * TRE token we must, as the issuer:
 *
 *   1. Create an OnchainID identity contract for the investor's wallet.
 *   2. Register the wallet -> identity link in the token's IdentityRegistry.
 *   3. Attach a KYC claim, signed by the trusted Claim Issuer, to the identity.
 *
 * After this, `identityRegistry.isVerified(investor)` returns true and the token
 * will accept transfers to that wallet. All three steps are performed by the
 * reusable `onboardWallet` helper (see scripts/lib/onboarding.js), which the
 * transfer test reuses as well.
 *
 * The investor address comes from INVESTOR_ADDRESS in .env. If it is not set, a
 * random address is generated and printed (the investor is only ever a token
 * recipient, so its private key is never required).
 *
 * Run with:  npm run register:investor   (requires steps 1 & 2 first)
 * ============================================================================
 */
const { ethers, network } = require("hardhat");
const FQN = require("./lib/contracts");
const { requirePersistentNetwork } = require("./lib/network");
const deployments = require("./lib/deployments");
const { getSigners } = require("./lib/signers");
const { onboardWallet } = require("./lib/onboarding");
const { INVESTOR_COUNTRY } = require("./lib/constants");

async function main() {
  requirePersistentNetwork();
  const { deployer, claimSigner } = await getSigners();

  const d = deployments.require(
    network.name,
    ["idFactory", "claimIssuer", "identityRegistry"],
    "Run `npm run deploy:onchainid` and `npm run deploy:token` first."
  );

  // Resolve the investor address (configured, or freshly generated).
  let investor = process.env.INVESTOR_ADDRESS;
  if (!investor || investor.trim() === "") {
    investor = ethers.Wallet.createRandom().address;
    console.log(`\n⚠  INVESTOR_ADDRESS not set — generated a random investor: ${investor}`);
  } else {
    investor = ethers.getAddress(investor.trim()); // checksum / validate
  }

  console.log("\n============================================================");
  console.log(" Step 3 — Onboard investor (KYC)");
  console.log("============================================================");
  console.log(` Network:  ${network.name}`);
  console.log(` Investor: ${investor}`);
  console.log("------------------------------------------------------------");

  const idFactory = await ethers.getContractAt(FQN.IdFactory, d.idFactory, deployer);
  const identityRegistry = await ethers.getContractAt(FQN.IdentityRegistry, d.identityRegistry, deployer);

  const identityAddress = await onboardWallet({
    wallet: investor,
    country: INVESTOR_COUNTRY,
    idFactory,
    identityRegistry,
    claimIssuerAddress: d.claimIssuer,
    claimSigner,
    manager: deployer,
  });

  deployments.save(network.name, {
    investor,
    investorIdentity: identityAddress,
  });

  console.log("\n------------------------------------------------------------");
  console.log(` Investor onboarded and saved to deployments/${network.name}.json`);
  console.log(" Next: npm run test:transfer");
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Step 3 failed:\n", error);
    process.exit(1);
  });
