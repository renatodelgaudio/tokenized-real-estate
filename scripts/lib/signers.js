const { ethers } = require("hardhat");

/**
 * Resolves the signers used across the scripts.
 *
 *  - deployer:    account[0] from the Hardhat network config (DEPLOYER_PRIVATE_KEY).
 *                 Owns everything, pays all gas, and acts as the treasury.
 *  - claimSigner: the account whose key signs KYC claims. Defaults to the
 *                 deployer, but can be a separate key via CLAIM_SIGNER_PRIVATE_KEY.
 *                 It only signs messages off-chain, so it never needs ETH.
 */
async function getSigners() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account configured. Set DEPLOYER_PRIVATE_KEY in your .env and " +
        "run with `--network sepolia`."
    );
  }

  let claimSigner = deployer;
  const claimSignerKey = process.env.CLAIM_SIGNER_PRIVATE_KEY;
  if (claimSignerKey && claimSignerKey.trim() !== "") {
    // The claim signer signs off-chain; connecting to the provider is enough.
    claimSigner = new ethers.Wallet(claimSignerKey.trim(), ethers.provider);
  }

  return { deployer, claimSigner };
}

module.exports = { getSigners };
