/**
 * ============================================================================
 * Platform end-to-end validation (run on a local Hardhat node)
 * ============================================================================
 *
 * This script is NOT part of the four-step PoC flow. It exists to prove, on a
 * real chain, every on-chain interaction the web platform performs — BEFORE we
 * wrap them in a UI. If this passes, the frontend logic is sound; the UI just
 * calls the same sequence with the connected wallet.
 *
 * It validates:
 *   1. Admin deploys the full shared infrastructure (OID + T-REX + a SHARED
 *      IdentityRegistry/Storage/CTR/TIR + PlatformRegistry).
 *   2. KYC service onboards two investors into the SHARED registry.
 *   3. Issuer deploys Token A with the "whitelist ALL" policy → rebinds its
 *      registry to the shared storage. Both investors are instantly eligible,
 *      with NO per-investor transaction.
 *   4. Issuer deploys Token B with the "whitelist CUSTOM" policy → only the
 *      manually-registered investor is eligible.
 *   5. Distribution: mint + a compliant transfer succeeds, a transfer to an
 *      unverified wallet reverts.
 *
 * Run with:
 *   Terminal 1:  npx hardhat node
 *   Terminal 2:  npx hardhat run scripts/platform_e2e.js --network localhost
 * ============================================================================
 */
const { ethers, network } = require("hardhat");
const FQN = require("./lib/contracts");
const { onboardWallet, addressKey, buildKycClaim } = require("./lib/onboarding");
const { KYC_CLAIM_TOPIC, INVESTOR_COUNTRY } = require("./lib/constants");

const VERSION = { major: 4, minor: 0, patch: 0 };

async function deploy(name, signer, ...args) {
  const factory = await ethers.getContractFactory(name, signer);
  const c = await factory.deploy(...args);
  await c.waitForDeployment();
  return c;
}

function ok(msg) {
  console.log(`   ✅ ${msg}`);
}
function bad(msg) {
  throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function deployTokenSuite(trexFactory, issuer, salt, name, symbol, claimIssuer) {
  const tokenDetails = {
    owner: issuer,
    name,
    symbol,
    decimals: 0,
    irs: ethers.ZeroAddress,
    ONCHAINID: ethers.ZeroAddress,
    irAgents: [issuer],
    tokenAgents: [issuer],
    complianceModules: [],
    complianceSettings: [],
  };
  const claimDetails = {
    claimTopics: [KYC_CLAIM_TOPIC],
    issuers: [claimIssuer],
    issuerClaims: [[KYC_CLAIM_TOPIC]],
  };
  const tx = await trexFactory.deployTREXSuite(salt, tokenDetails, claimDetails);
  const receipt = await tx.wait();
  const ev = receipt.logs
    .map((l) => {
      try {
        return trexFactory.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((p) => p && p.name === "TREXSuiteDeployed");
  if (!ev) throw new Error("TREXSuiteDeployed not found");
  return ev.args._token;
}

async function main() {
  if (network.name === "hardhat") {
    throw new Error("Run against a persistent node: npx hardhat node + --network localhost");
  }

  const [admin] = await ethers.getSigners();
  const adminAddr = await admin.getAddress();
  // Distinct demo wallets (only `admin` is funded / signs txs).
  const investor1 = ethers.Wallet.createRandom().address;
  const investor2 = ethers.Wallet.createRandom().address;

  console.log("\n================ PLATFORM E2E (localhost) ================\n");
  console.log(` Admin/Issuer/KYC : ${adminAddr}`);
  console.log(` Investor 1       : ${investor1}`);
  console.log(` Investor 2       : ${investor2}\n`);

  // ===================================================================
  // 1. ADMIN — deploy shared infrastructure
  // ===================================================================
  console.log("[1] Admin: deploying shared infrastructure...");

  // OnchainID layer
  const identityImpl = await deploy(FQN.Identity, admin, adminAddr, true);
  const oidAuthority = await deploy(FQN.OID_ImplementationAuthority, admin, await identityImpl.getAddress());
  const idFactory = await deploy(FQN.IdFactory, admin, await oidAuthority.getAddress());
  const claimIssuer = await deploy(FQN.ClaimIssuer, admin, adminAddr);
  const claimIssuerAddr = await claimIssuer.getAddress();

  // T-REX implementations
  const tokenImpl = await deploy(FQN.Token, admin);
  const ctrImpl = await deploy(FQN.ClaimTopicsRegistry, admin);
  const irImpl = await deploy(FQN.IdentityRegistry, admin);
  const irsImpl = await deploy(FQN.IdentityRegistryStorage, admin);
  const tirImpl = await deploy(FQN.TrustedIssuersRegistry, admin);
  const mcImpl = await deploy(FQN.ModularCompliance, admin);

  // TREX implementation authority + version
  const trexAuthority = await deploy(
    FQN.TREXImplementationAuthority,
    admin,
    true,
    ethers.ZeroAddress,
    ethers.ZeroAddress
  );
  await (
    await trexAuthority.addAndUseTREXVersion(VERSION, {
      tokenImplementation: await tokenImpl.getAddress(),
      ctrImplementation: await ctrImpl.getAddress(),
      irImplementation: await irImpl.getAddress(),
      irsImplementation: await irsImpl.getAddress(),
      tirImplementation: await tirImpl.getAddress(),
      mcImplementation: await mcImpl.getAddress(),
    })
  ).wait();

  // Factories
  const trexFactory = await deploy(
    FQN.TREXFactory,
    admin,
    await trexAuthority.getAddress(),
    await idFactory.getAddress()
  );
  const trexFactoryAddr = await trexFactory.getAddress();
  const iaFactory = await deploy(FQN.IAFactory, admin, trexFactoryAddr);
  await (await trexAuthority.setTREXFactory(trexFactoryAddr)).wait();
  await (await trexAuthority.setIAFactory(await iaFactory.getAddress())).wait();
  await (await idFactory.addTokenFactory(trexFactoryAddr)).wait();

  // SHARED registry (storage + CTR + TIR + IR), the heart of "whitelist all"
  const iaAddr = await trexAuthority.getAddress();
  const sharedIRS = await deploy(FQN.IdentityRegistryStorageProxy, admin, iaAddr);
  const sharedCTR = await deploy(FQN.ClaimTopicsRegistryProxy, admin, iaAddr);
  const sharedTIR = await deploy(FQN.TrustedIssuersRegistryProxy, admin, iaAddr);
  const sharedIR = await deploy(
    FQN.IdentityRegistryProxy,
    admin,
    iaAddr,
    await sharedTIR.getAddress(),
    await sharedCTR.getAddress(),
    await sharedIRS.getAddress()
  );

  // Interact with proxies through their logic ABIs.
  const sharedIRSc = await ethers.getContractAt(FQN.IdentityRegistryStorage, await sharedIRS.getAddress(), admin);
  const sharedCTRc = await ethers.getContractAt(FQN.ClaimTopicsRegistry, await sharedCTR.getAddress(), admin);
  const sharedTIRc = await ethers.getContractAt(FQN.TrustedIssuersRegistry, await sharedTIR.getAddress(), admin);
  const sharedIRc = await ethers.getContractAt(FQN.IdentityRegistry, await sharedIR.getAddress(), admin);

  await (await sharedIRSc.bindIdentityRegistry(await sharedIR.getAddress())).wait();
  await (await sharedCTRc.addClaimTopic(KYC_CLAIM_TOPIC)).wait();
  await (await sharedTIRc.addTrustedIssuer(claimIssuerAddr, [KYC_CLAIM_TOPIC])).wait();
  await (await sharedIRc.addAgent(adminAddr)).wait(); // KYC service can register

  const platformRegistry = await deploy(FQN.PlatformRegistry, admin);

  ok("infrastructure deployed (OID + T-REX + shared registry + PlatformRegistry)");

  // ===================================================================
  // 2. KYC SERVICE — onboard two investors into the SHARED registry
  // ===================================================================
  console.log("\n[2] KYC service: onboarding investors into the shared registry...");
  const onboardArgs = {
    idFactory,
    identityRegistry: sharedIRc,
    claimIssuerAddress: claimIssuerAddr,
    claimSigner: admin,
    manager: admin,
  };
  const id1 = await onboardWallet({ wallet: investor1, country: INVESTOR_COUNTRY, ...onboardArgs });
  const id2 = await onboardWallet({ wallet: investor2, country: INVESTOR_COUNTRY, ...onboardArgs });
  await (await platformRegistry.recordInvestor(investor1, id1, INVESTOR_COUNTRY)).wait();
  await (await platformRegistry.recordInvestor(investor2, id2, INVESTOR_COUNTRY)).wait();
  if ((await platformRegistry.investorCount()) !== 2n) bad("expected 2 investors recorded");
  ok("two investors onboarded into shared registry & indexed");

  // Multi-wallet: link a SECOND wallet to investor1's entity (same identity),
  // with NO new KYC. It must be verified purely by reusing the existing claim.
  const investor1SecondWallet = ethers.Wallet.createRandom().address;
  await (await sharedIRc.registerIdentity(investor1SecondWallet, id1, INVESTOR_COUNTRY)).wait();
  if (!(await sharedIRc.isVerified(investor1SecondWallet)))
    bad("linked second wallet should be verified via the entity's existing identity/claim");
  const linkedIdentity = await sharedIRc.identity(investor1SecondWallet);
  if (linkedIdentity.toLowerCase() !== id1.toLowerCase())
    bad("linked wallet must resolve to the SAME identity as investor1");
  ok("second wallet linked to investor1's entity — verified with NO new KYC (shared identity)");

  // ===================================================================
  // 3. ISSUER — Token A with WHITELIST ALL
  // ===================================================================
  console.log("\n[3] Issuer: deploying Token A (policy = WHITELIST ALL)...");
  const tokenAAddr = await deployTokenSuite(trexFactory, adminAddr, "PLATFORM-A", "Building A", "BLDA", claimIssuerAddr);
  const tokenA = await ethers.getContractAt(FQN.Token, tokenAAddr, admin);
  const irAAddr = await tokenA.identityRegistry();
  const irA = await ethers.getContractAt(FQN.IdentityRegistry, irAAddr, admin);

  // The 2 transactions that implement "whitelist all": rebind to shared storage.
  await (await sharedIRSc.bindIdentityRegistry(irAAddr)).wait();
  await (await irA.setIdentityRegistryStorage(await sharedIRS.getAddress())).wait();
  await (
    await platformRegistry.recordToken(tokenAAddr, adminAddr, "Building A", "BLDA", 1 /* WhitelistAll */)
  ).wait();

  if (!(await irA.isVerified(investor1))) bad("Token A should see investor1 as verified (shared IRS)");
  if (!(await irA.isVerified(investor2))) bad("Token A should see investor2 as verified (shared IRS)");
  ok("Token A: BOTH investors auto-eligible via shared storage (0 per-investor txs)");

  // ===================================================================
  // 4. ISSUER — Token B with WHITELIST CUSTOM
  // ===================================================================
  console.log("\n[4] Issuer: deploying Token B (policy = WHITELIST CUSTOM, only investor1)...");
  const tokenBAddr = await deployTokenSuite(trexFactory, adminAddr, "PLATFORM-B", "Building B", "BLDB", claimIssuerAddr);
  const tokenB = await ethers.getContractAt(FQN.Token, tokenBAddr, admin);
  const irB = await ethers.getContractAt(FQN.IdentityRegistry, await tokenB.identityRegistry(), admin);

  // Custom: register ONLY investor1 into token B's own (separate) registry.
  await (await irB.registerIdentity(investor1, id1, INVESTOR_COUNTRY)).wait();
  await (
    await platformRegistry.recordToken(tokenBAddr, adminAddr, "Building B", "BLDB", 0 /* WhitelistCustom */)
  ).wait();

  if (!(await irB.isVerified(investor1))) bad("Token B should see investor1 as verified (custom)");
  if (await irB.isVerified(investor2)) bad("Token B must NOT see investor2 as verified (not whitelisted)");
  ok("Token B: investor1 eligible, investor2 correctly excluded");

  // ===================================================================
  // 5. DISTRIBUTION — mint + transfer gating on Token A
  // ===================================================================
  console.log("\n[5] Issuer: distributing Token A...");
  // Onboard the issuer treasury (admin wallet) so it can custody supply.
  await onboardWallet({ wallet: adminAddr, country: INVESTOR_COUNTRY, ...onboardArgs });
  await (await platformRegistry.recordInvestor(adminAddr, await idFactory.getIdentity(adminAddr), INVESTOR_COUNTRY)).wait();

  await (await tokenA.unpause()).wait();
  await (await tokenA.mint(adminAddr, 1000)).wait();
  await (await tokenA.transfer(investor1, 100)).wait();
  if ((await tokenA.balanceOf(investor1)) !== 100n) bad("investor1 should hold 100");
  ok("minted 1000, transferred 100 to verified investor1");

  const stranger = ethers.Wallet.createRandom().address;
  try {
    await tokenA.transfer.staticCall(stranger, 50);
    bad("transfer to unverified stranger should revert");
  } catch (e) {
    if (e.message.startsWith("ASSERTION FAILED")) throw e;
    ok(`transfer to unverified wallet reverted as expected`);
  }

  console.log("\n================ ✅ PLATFORM E2E PASSED ================");
  console.log(" The whitelist-all (shared storage) and whitelist-custom");
  console.log(" mechanisms both work. UI can safely wrap this sequence.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n✗ platform e2e failed:\n", e);
    process.exit(1);
  });
