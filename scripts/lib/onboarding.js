const { ethers } = require("hardhat");
const FQN = require("./contracts");
const {
  KYC_CLAIM_TOPIC,
  CLAIM_SCHEME_ECDSA,
  KYC_CLAIM_DATA,
} = require("./constants");

const abi = ethers.AbiCoder.defaultAbiCoder();

/**
 * keccak256(abi.encode(address)) — the on-chain representation of a "key" in an
 * OnchainID identity (ERC-734). A wallet address is hashed before being stored.
 */
function addressKey(address) {
  return ethers.keccak256(abi.encode(["address"], [address]));
}

/**
 * Build and sign a KYC claim for a given identity.
 *
 * The signature format is dictated by OnchainID's `ClaimIssuer.isClaimValid`:
 *   dataHash     = keccak256(abi.encode(identity, topic, data))
 *   signedDigest = EIP-191 personal_sign over dataHash
 * `wallet.signMessage(getBytes(dataHash))` reproduces exactly that digest.
 */
async function buildKycClaim(identityAddress, claimSigner) {
  const data = ethers.toUtf8Bytes(KYC_CLAIM_DATA);
  const dataHash = ethers.keccak256(
    abi.encode(["address", "uint256", "bytes"], [identityAddress, KYC_CLAIM_TOPIC, data])
  );
  const signature = await claimSigner.signMessage(ethers.getBytes(dataHash));
  return { data, signature };
}

/**
 * Fully onboard a wallet so it can hold / receive the ERC-3643 token:
 *
 *   1. Deploy (or reuse) an OnchainID identity for the wallet via the IdFactory.
 *   2. Register the wallet -> identity mapping in the IdentityRegistry.
 *   3. Add a KYC claim (signed by the trusted Claim Issuer) to the identity.
 *
 * Every step is idempotent: re-running it on a wallet that is already onboarded
 * is a no-op, which makes the scripts safe to re-run on a live testnet.
 *
 * @param {object}  args
 * @param {string}  args.wallet              address to onboard (holder/investor)
 * @param {number}  args.country             ISO numeric country code
 * @param {Contract} args.idFactory          OnchainID IdFactory (deployer-owned)
 * @param {Contract} args.identityRegistry   T-REX IdentityRegistry
 * @param {string}  args.claimIssuerAddress  trusted ClaimIssuer address
 * @param {Signer}  args.claimSigner         key that signs the KYC claim
 * @param {Signer}  args.manager             account managing identities (deployer)
 * @returns {Promise<string>} the identity contract address
 */
async function onboardWallet({
  wallet,
  country,
  idFactory,
  identityRegistry,
  claimIssuerAddress,
  claimSigner,
  manager,
}) {
  const managerAddress = await manager.getAddress();
  const idFactoryAsManager = idFactory.connect(manager);
  const registryAsManager = identityRegistry.connect(manager);

  // --- 1. Identity ----------------------------------------------------------
  let identityAddress = await idFactoryAsManager.getIdentity(wallet);
  if (identityAddress === ethers.ZeroAddress) {
    // The salt must be unique per identity. Using the wallet address guarantees
    // uniqueness and determinism.
    const salt = wallet;
    if (wallet.toLowerCase() === managerAddress.toLowerCase()) {
      // The manager is onboarding itself: the wallet becomes its own management
      // key (createIdentityWithManagementKeys forbids listing the wallet itself).
      await (await idFactoryAsManager.createIdentity(wallet, salt)).wait();
    } else {
      // For a third party, give the manager (deployer) a management key on the
      // identity so it can attach claims on the investor's behalf in this PoC.
      await (
        await idFactoryAsManager.createIdentityWithManagementKeys(wallet, salt, [
          addressKey(managerAddress),
        ])
      ).wait();
    }
    identityAddress = await idFactoryAsManager.getIdentity(wallet);
    console.log(`   ✓ identity deployed:    ${identityAddress}`);
  } else {
    console.log(`   • identity exists:      ${identityAddress}`);
  }

  // --- 2. Register in the IdentityRegistry ----------------------------------
  if (await registryAsManager.contains(wallet)) {
    console.log(`   • already registered    in IdentityRegistry`);
  } else {
    await (await registryAsManager.registerIdentity(wallet, identityAddress, country)).wait();
    console.log(`   ✓ registered (country ${country}) in IdentityRegistry`);
  }

  // --- 3. Add the KYC claim -------------------------------------------------
  const identity = await ethers.getContractAt(FQN.Identity, identityAddress, manager);
  // claimId = keccak256(abi.encode(issuer, topic)) per ERC-735.
  const claimId = ethers.keccak256(
    abi.encode(["address", "uint256"], [claimIssuerAddress, KYC_CLAIM_TOPIC])
  );
  const existing = await identity.getClaim(claimId);
  if (existing.issuer !== ethers.ZeroAddress) {
    console.log(`   • KYC claim exists      (topic ${KYC_CLAIM_TOPIC})`);
  } else {
    const { data, signature } = await buildKycClaim(identityAddress, claimSigner);
    await (
      await identity.addClaim(
        KYC_CLAIM_TOPIC,
        CLAIM_SCHEME_ECDSA,
        claimIssuerAddress,
        signature,
        data,
        "" // uri: empty for the PoC
      )
    ).wait();
    console.log(`   ✓ KYC claim added       (topic ${KYC_CLAIM_TOPIC})`);
  }

  // --- 4. Sanity check ------------------------------------------------------
  const verified = await identityRegistry.isVerified(wallet);
  console.log(`   → isVerified(${shorten(wallet)}): ${verified}`);
  if (!verified) {
    throw new Error(
      `Onboarding completed but ${wallet} is still not verified. Check that the ` +
        `claim signer key has CLAIM purpose on the ClaimIssuer.`
    );
  }

  return identityAddress;
}

function shorten(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

module.exports = { onboardWallet, addressKey, buildKycClaim, shorten };
