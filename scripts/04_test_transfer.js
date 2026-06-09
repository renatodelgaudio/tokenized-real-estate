/**
 * ============================================================================
 * Step 4 / 4 — End-to-end compliance test (the "does it actually work?" proof)
 * ============================================================================
 *
 * This script demonstrates the whole point of ERC-3643: transfers are gated by
 * on-chain identity verification. It walks through:
 *
 *   0. Onboard the issuer treasury (the deployer) so it can custody supply.
 *   1. Unpause the token and MINT the initial supply to the treasury.
 *   2. Attempt to transfer to a BRAND-NEW, UNVERIFIED wallet → expect REVERT.
 *   3. Onboard (KYC + register) that wallet → it becomes verified.
 *   4. Retry the same transfer → expect SUCCESS, and confirm balances.
 *   5. (Bonus) Transfer to the investor onboarded in step 3 → also succeeds.
 *
 * The "expected revert" in step 2 is checked with a static call (eth_call), so
 * it costs no gas and deterministically surfaces the revert reason.
 *
 * Run with:  npm run test:transfer   (requires steps 1-3 first)
 * ============================================================================
 */
const { ethers, network } = require("hardhat");
const FQN = require("./lib/contracts");
const { requirePersistentNetwork } = require("./lib/network");
const deployments = require("./lib/deployments");
const { getSigners } = require("./lib/signers");
const { onboardWallet, shorten } = require("./lib/onboarding");
const { INVESTOR_COUNTRY, INITIAL_SUPPLY } = require("./lib/constants");

const TRANSFER_AMOUNT = 100n;

// Small assertion helpers so the test output reads like a checklist.
function pass(msg) {
  console.log(`   ✅ PASS  ${msg}`);
}
function fail(msg) {
  throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  requirePersistentNetwork();
  const { deployer, claimSigner } = await getSigners();
  const treasury = await deployer.getAddress();

  const d = deployments.require(
    network.name,
    ["idFactory", "claimIssuer", "identityRegistry", "token"],
    "Run steps 1-3 first (onchainid, token, register:investor)."
  );

  console.log("\n============================================================");
  console.log(" Step 4 — End-to-end compliance test");
  console.log("============================================================");
  console.log(` Network:  ${network.name}`);
  console.log(` Treasury: ${treasury} (issuer/agent)`);
  console.log("------------------------------------------------------------");

  const token = await ethers.getContractAt(FQN.Token, d.token, deployer);
  const idFactory = await ethers.getContractAt(FQN.IdFactory, d.idFactory, deployer);
  const identityRegistry = await ethers.getContractAt(FQN.IdentityRegistry, d.identityRegistry, deployer);

  const onboardArgs = {
    idFactory,
    identityRegistry,
    claimIssuerAddress: d.claimIssuer,
    claimSigner,
    manager: deployer,
  };

  // --- 0. Verify the treasury so it can hold the minted supply --------------
  console.log("\n[0] Onboarding the issuer treasury so it can custody supply...");
  await onboardWallet({ wallet: treasury, country: INVESTOR_COUNTRY, ...onboardArgs });

  // --- 1. Unpause + mint ----------------------------------------------------
  console.log("\n[1] Unpausing token and minting initial supply...");
  if (await token.paused()) {
    await (await token.unpause()).wait();
    console.log("   ✓ token unpaused");
  } else {
    console.log("   • token already unpaused");
  }

  const treasuryBalance = await token.balanceOf(treasury);
  if (treasuryBalance < TRANSFER_AMOUNT) {
    await (await token.mint(treasury, INITIAL_SUPPLY)).wait();
    console.log(`   ✓ minted ${INITIAL_SUPPLY} TRE to treasury`);
  } else {
    console.log(`   • treasury already holds ${treasuryBalance} TRE`);
  }
  pass(`treasury balance is ${await token.balanceOf(treasury)} TRE`);

  // --- 2. Transfer to an UNVERIFIED wallet must REVERT ----------------------
  console.log("\n[2] Attempting transfer to an UNVERIFIED wallet (must revert)...");
  const unverified = ethers.Wallet.createRandom().address;
  console.log(`   New wallet: ${unverified}`);
  if (await identityRegistry.isVerified(unverified)) fail("fresh wallet should not be verified");
  pass(`isVerified(${shorten(unverified)}) == false`);

  try {
    // Static call: simulates the transfer via eth_call without sending a tx.
    await token.transfer.staticCall(unverified, TRANSFER_AMOUNT);
    fail("transfer to an unverified wallet should have reverted, but it succeeded");
  } catch (error) {
    if (error.message.startsWith("ASSERTION FAILED")) throw error;
    const reason = error.shortMessage || error.reason || error.message;
    pass(`transfer reverted as expected → "${reason}"`);
  }

  // --- 3. Onboard (verify) that wallet --------------------------------------
  console.log("\n[3] Onboarding (KYC + register) the previously-unverified wallet...");
  await onboardWallet({ wallet: unverified, country: INVESTOR_COUNTRY, ...onboardArgs });

  // --- 4. Retry the transfer — now it must SUCCEED --------------------------
  console.log("\n[4] Retrying the transfer to the now-verified wallet (must succeed)...");
  const beforeTreasury = await token.balanceOf(treasury);
  const beforeRecipient = await token.balanceOf(unverified);

  await (await token.transfer(unverified, TRANSFER_AMOUNT)).wait();

  const afterTreasury = await token.balanceOf(treasury);
  const afterRecipient = await token.balanceOf(unverified);

  if (afterRecipient !== beforeRecipient + TRANSFER_AMOUNT) fail("recipient balance did not increase correctly");
  if (afterTreasury !== beforeTreasury - TRANSFER_AMOUNT) fail("treasury balance did not decrease correctly");
  pass(`transfer of ${TRANSFER_AMOUNT} TRE succeeded`);
  console.log(`        treasury:  ${beforeTreasury} → ${afterTreasury} TRE`);
  console.log(`        recipient: ${beforeRecipient} → ${afterRecipient} TRE`);

  // --- 5. Bonus: transfer to the investor onboarded in step 3 ---------------
  if (d.investor && (await identityRegistry.isVerified(d.investor))) {
    console.log("\n[5] Bonus: transferring to the investor from step 3...");
    const before = await token.balanceOf(d.investor);
    await (await token.transfer(d.investor, TRANSFER_AMOUNT)).wait();
    const after = await token.balanceOf(d.investor);
    if (after !== before + TRANSFER_AMOUNT) fail("investor balance did not increase correctly");
    pass(`investor ${shorten(d.investor)} received ${TRANSFER_AMOUNT} TRE (balance ${after})`);
  }

  console.log("\n============================================================");
  console.log(" 🎉 All compliance checks passed.");
  console.log(" ERC-3643 enforced identity-gated transfers end to end:");
  console.log("   • unverified recipient  → transfer blocked");
  console.log("   • verified recipient    → transfer allowed");
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Step 4 failed:\n", error);
    process.exit(1);
  });
