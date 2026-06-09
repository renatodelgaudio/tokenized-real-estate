/**
 * ============================================================================
 * Step 2 / 4 — Deploy the ERC-3643 (T-REX) token suite via the TREXFactory
 * ============================================================================
 *
 * The T-REX suite is built from upgradeable proxies that all point at a shared
 * set of implementation contracts, indexed by version in a
 * TREXImplementationAuthority. The flow is:
 *
 *   1. Deploy the 6 implementation contracts (Token, IdentityRegistry,
 *      IdentityRegistryStorage, ClaimTopicsRegistry, TrustedIssuersRegistry,
 *      ModularCompliance).
 *   2. Deploy the TREXImplementationAuthority (as the "reference" contract) and
 *      register version 4.0.0 -> those implementations.
 *   3. Deploy the TREXFactory (wired to the authority + the OnchainID IdFactory),
 *      then the IAFactory, and link them to the authority.
 *   4. Authorize the TREXFactory on the IdFactory so it may create the token's
 *      own OnchainID during deployment.
 *   5. Call `deployTREXSuite(...)` — one transaction that deploys and wires the
 *      full per-token proxy suite, sets the deployer as token & registry agent,
 *      and trusts our Claim Issuer for the KYC claim topic.
 *
 * Run with:  npm run deploy:token   (requires step 1 to have run first)
 * ============================================================================
 */
const { ethers, network } = require("hardhat");
const FQN = require("./lib/contracts");
const deployments = require("./lib/deployments");
const { getSigners } = require("./lib/signers");
const { requirePersistentNetwork } = require("./lib/network");
const {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_DECIMALS,
  TOKEN_SALT,
  KYC_CLAIM_TOPIC,
} = require("./lib/constants");

async function deploy(name, signer, ...args) {
  const factory = await ethers.getContractFactory(name, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  console.log(`   ✓ ${name.split(":").pop().padEnd(28)} ${await contract.getAddress()}`);
  return contract;
}

async function main() {
  requirePersistentNetwork();
  const { deployer } = await getSigners();
  const deployerAddress = await deployer.getAddress();

  const prior = deployments.require(
    network.name,
    ["idFactory", "claimIssuer"],
    "Run `npm run deploy:onchainid` first."
  );

  console.log("\n============================================================");
  console.log(" Step 2 — ERC-3643 (T-REX) token suite");
  console.log("============================================================");
  console.log(` Network:  ${network.name}`);
  console.log(` Deployer: ${deployerAddress}`);
  console.log(` Token:    ${TOKEN_NAME} (${TOKEN_SYMBOL}), decimals=${TOKEN_DECIMALS}`);
  console.log("------------------------------------------------------------");

  // --- 1. Implementation contracts -----------------------------------------
  console.log("\n[1] Deploying T-REX implementation (logic) contracts...");
  const tokenImpl = await deploy(FQN.Token, deployer);
  const ctrImpl = await deploy(FQN.ClaimTopicsRegistry, deployer);
  const irImpl = await deploy(FQN.IdentityRegistry, deployer);
  const irsImpl = await deploy(FQN.IdentityRegistryStorage, deployer);
  const tirImpl = await deploy(FQN.TrustedIssuersRegistry, deployer);
  const mcImpl = await deploy(FQN.ModularCompliance, deployer);

  // --- 2. Implementation authority + version --------------------------------
  console.log("\n[2] Deploying TREXImplementationAuthority (reference) + version...");
  // constructor(referenceStatus, trexFactory, iaFactory): we are the reference
  // (main) authority, and set the factory addresses afterwards.
  const trexAuthority = await deploy(
    FQN.TREXImplementationAuthority,
    deployer,
    true,
    ethers.ZeroAddress,
    ethers.ZeroAddress
  );

  const version = { major: 4, minor: 0, patch: 0 };
  const contractsStruct = {
    tokenImplementation: await tokenImpl.getAddress(),
    ctrImplementation: await ctrImpl.getAddress(),
    irImplementation: await irImpl.getAddress(),
    irsImplementation: await irsImpl.getAddress(),
    tirImplementation: await tirImpl.getAddress(),
    mcImplementation: await mcImpl.getAddress(),
  };
  await (await trexAuthority.addAndUseTREXVersion(version, contractsStruct)).wait();
  console.log(`   ✓ registered & selected version 4.0.0`);

  // --- 3. Factories ---------------------------------------------------------
  console.log("\n[3] Deploying TREXFactory + IAFactory and linking them...");
  const trexFactory = await deploy(
    FQN.TREXFactory,
    deployer,
    await trexAuthority.getAddress(),
    prior.idFactory
  );
  const trexFactoryAddress = await trexFactory.getAddress();

  const iaFactory = await deploy(FQN.IAFactory, deployer, trexFactoryAddress);

  await (await trexAuthority.setTREXFactory(trexFactoryAddress)).wait();
  await (await trexAuthority.setIAFactory(await iaFactory.getAddress())).wait();
  console.log("   ✓ authority linked to TREXFactory & IAFactory");

  // --- 4. Authorize the factory on the OnchainID IdFactory ------------------
  const idFactory = await ethers.getContractAt(FQN.IdFactory, prior.idFactory, deployer);
  if (await idFactory.isTokenFactory(trexFactoryAddress)) {
    console.log("   • TREXFactory already authorized on IdFactory");
  } else {
    await (await idFactory.addTokenFactory(trexFactoryAddress)).wait();
    console.log("   ✓ TREXFactory authorized on IdFactory");
  }

  // --- 5. Deploy the token suite -------------------------------------------
  console.log("\n[4] Deploying the TRE token suite (deployTREXSuite)...");

  // Idempotency: if a token already exists for this salt, reuse it.
  let tokenAddress = await trexFactory.getToken(TOKEN_SALT);
  if (tokenAddress !== ethers.ZeroAddress) {
    console.log(`   • suite already deployed for salt "${TOKEN_SALT}": ${tokenAddress}`);
  } else {
    const tokenDetails = {
      owner: deployerAddress,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      decimals: TOKEN_DECIMALS,
      irs: ethers.ZeroAddress, // deploy a fresh IdentityRegistryStorage
      ONCHAINID: ethers.ZeroAddress, // let the factory create the token's OID
      irAgents: [deployerAddress], // deployer may register identities
      tokenAgents: [deployerAddress], // deployer may mint / manage the token
      complianceModules: [], // no extra transfer rules in this PoC
      complianceSettings: [],
    };
    const claimDetails = {
      claimTopics: [KYC_CLAIM_TOPIC], // holders must carry a KYC claim
      issuers: [prior.claimIssuer], // ...issued by our Claim Issuer
      issuerClaims: [[KYC_CLAIM_TOPIC]], // ...which is trusted for that topic
    };

    const tx = await trexFactory.deployTREXSuite(TOKEN_SALT, tokenDetails, claimDetails);
    const receipt = await tx.wait();

    // Parse the TREXSuiteDeployed event to discover the proxy addresses.
    const event = receipt.logs
      .map((log) => {
        try {
          return trexFactory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed && parsed.name === "TREXSuiteDeployed");

    if (!event) throw new Error("TREXSuiteDeployed event not found in receipt.");
    tokenAddress = event.args._token;
    console.log(`   ✓ suite deployed (tx ${receipt.hash})`);
  }

  // Resolve the suite's sub-contracts from the token itself.
  const token = await ethers.getContractAt(FQN.Token, tokenAddress, deployer);
  const identityRegistryAddress = await token.identityRegistry();
  const complianceAddress = await token.compliance();
  const tokenOnchainId = await token.onchainID();

  console.log("\n   Suite addresses:");
  console.log(`     Token (TRE):         ${tokenAddress}`);
  console.log(`     IdentityRegistry:    ${identityRegistryAddress}`);
  console.log(`     ModularCompliance:   ${complianceAddress}`);
  console.log(`     Token ONCHAINID:     ${tokenOnchainId}`);

  // --- Persist --------------------------------------------------------------
  deployments.save(network.name, {
    trexImplementationAuthority: await trexAuthority.getAddress(),
    trexFactory: trexFactoryAddress,
    iaFactory: await iaFactory.getAddress(),
    token: tokenAddress,
    identityRegistry: identityRegistryAddress,
    compliance: complianceAddress,
    tokenOnchainId,
    tokenSalt: TOKEN_SALT,
  });

  console.log("\n------------------------------------------------------------");
  console.log(` Saved to deployments/${network.name}.json`);
  console.log(" Next: npm run register:investor");
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Step 2 failed:\n", error);
    process.exit(1);
  });
