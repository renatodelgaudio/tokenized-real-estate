import {
  deployContract,
  writeContract,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  signMessage,
  type Config,
} from "@wagmi/core";
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  stringToHex,
  parseEventLogs,
  zeroAddress,
  type Address,
} from "viem";
import { getAbi, getBytecode, artifactFingerprint, type ContractName } from "./contracts";
import {
  KYC_CLAIM_TOPIC,
  CLAIM_SCHEME_ECDSA,
  KYC_CLAIM_DATA,
  Policy,
} from "./constants";
import type { PlatformDeployment } from "./deployments";

const VERSION = { major: 4, minor: 0, patch: 0 };

// --- low-level helpers -------------------------------------------------------

async function deployByName(
  config: Config,
  account: Address,
  name: ContractName,
  args: unknown[] = []
): Promise<Address> {
  const hash = await deployContract(config, {
    abi: getAbi(name),
    bytecode: getBytecode(name),
    args,
    account,
  });
  const receipt = await waitForTransactionReceipt(config, { hash });
  if (!receipt.contractAddress) throw new Error(`Deployment of ${name} produced no address`);
  return receipt.contractAddress;
}

async function send(
  config: Config,
  account: Address,
  address: Address,
  abiName: ContractName,
  functionName: string,
  args: unknown[] = []
): Promise<void> {
  const hash = await writeContract(config, {
    address,
    abi: getAbi(abiName),
    functionName,
    args,
    account,
  });
  await waitForTransactionReceipt(config, { hash });
}

async function read<T>(
  config: Config,
  address: Address,
  abiName: ContractName,
  functionName: string,
  args: unknown[] = [],
  chainId?: number
): Promise<T> {
  // Passing `chainId` makes the read go through that chain's RPC transport
  // regardless of whether (or where) a wallet is connected — this is what lets
  // the Explorer work with no wallet at all.
  return (await readContract(config, {
    address,
    abi: getAbi(abiName),
    functionName,
    args,
    ...(chainId ? { chainId } : {}),
  })) as T;
}

/** keccak256(abi.encode(address)) — the ERC-734 key representation of a wallet. */
function addressKey(address: Address): `0x${string}` {
  return keccak256(encodeAbiParameters(parseAbiParameters("address"), [address]));
}

// ============================================================================
// 1. ADMIN — deploy the shared infrastructure, step by step
// ============================================================================

export type StepStatus = "pending" | "running" | "done";
export interface StepUpdate {
  index: number;
  label: string;
  status: StepStatus;
  address?: Address;
}

/**
 * Deploys the full shared platform infrastructure, invoking `onStep` before and
 * after each on-chain action so the UI can render live progress.
 */
export async function deployInfrastructure(
  config: Config,
  account: Address,
  chainId: number,
  onStep: (u: StepUpdate) => void
): Promise<PlatformDeployment> {
  const d: Partial<PlatformDeployment> = { chainId, deployedAt: new Date().toISOString(), artifactFingerprint: artifactFingerprint() };
  let i = 0;

  // A tiny runner that emits running/done around each step.
  async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const index = i++;
    onStep({ index, label, status: "running" });
    const result = await fn();
    onStep({
      index,
      label,
      status: "done",
      address: typeof result === "string" ? (result as Address) : undefined,
    });
    return result;
  }

  // --- OnchainID layer ---
  d.identityImplementation = await step("Identity (logic)", () =>
    deployByName(config, account, "Identity", [account, true])
  );
  d.oidImplementationAuthority = await step("OID ImplementationAuthority", () =>
    deployByName(config, account, "OID_ImplementationAuthority", [d.identityImplementation])
  );
  d.idFactory = await step("IdFactory", () =>
    deployByName(config, account, "IdFactory", [d.oidImplementationAuthority])
  );
  d.claimIssuer = await step("ClaimIssuer (KYC authority)", () =>
    deployByName(config, account, "ClaimIssuer", [account])
  );

  // --- T-REX implementation contracts ---
  const tokenImpl = await step("Token (logic)", () => deployByName(config, account, "Token"));
  const ctrImpl = await step("ClaimTopicsRegistry (logic)", () =>
    deployByName(config, account, "ClaimTopicsRegistry")
  );
  const irImpl = await step("IdentityRegistry (logic)", () =>
    deployByName(config, account, "IdentityRegistry")
  );
  const irsImpl = await step("IdentityRegistryStorage (logic)", () =>
    deployByName(config, account, "IdentityRegistryStorage")
  );
  const tirImpl = await step("TrustedIssuersRegistry (logic)", () =>
    deployByName(config, account, "TrustedIssuersRegistry")
  );
  const mcImpl = await step("ModularCompliance (logic)", () =>
    deployByName(config, account, "ModularCompliance")
  );

  // --- TREX implementation authority + version ---
  d.trexImplementationAuthority = await step("TREXImplementationAuthority", () =>
    deployByName(config, account, "TREXImplementationAuthority", [true, zeroAddress, zeroAddress])
  );
  await step("Register T-REX version 4.0.0", () =>
    send(config, account, d.trexImplementationAuthority as Address, "TREXImplementationAuthority", "addAndUseTREXVersion", [
      VERSION,
      {
        tokenImplementation: tokenImpl,
        ctrImplementation: ctrImpl,
        irImplementation: irImpl,
        irsImplementation: irsImpl,
        tirImplementation: tirImpl,
        mcImplementation: mcImpl,
      },
    ])
  );

  // --- Factories ---
  d.trexFactory = await step("TREXFactory", () =>
    deployByName(config, account, "TREXFactory", [d.trexImplementationAuthority, d.idFactory])
  );
  d.iaFactory = await step("IAFactory", () =>
    deployByName(config, account, "IAFactory", [d.trexFactory])
  );
  await step("Link authority → TREXFactory", () =>
    send(config, account, d.trexImplementationAuthority as Address, "TREXImplementationAuthority", "setTREXFactory", [d.trexFactory])
  );
  await step("Link authority → IAFactory", () =>
    send(config, account, d.trexImplementationAuthority as Address, "TREXImplementationAuthority", "setIAFactory", [d.iaFactory])
  );
  await step("Authorize TREXFactory on IdFactory", () =>
    send(config, account, d.idFactory as Address, "IdFactory", "addTokenFactory", [d.trexFactory])
  );

  // --- Shared registry (storage + CTR + TIR + IR) ---
  const ia = d.trexImplementationAuthority as Address;
  d.sharedIRS = await step("Shared IdentityRegistryStorage", () =>
    deployByName(config, account, "IdentityRegistryStorageProxy", [ia])
  );
  d.sharedCTR = await step("Shared ClaimTopicsRegistry", () =>
    deployByName(config, account, "ClaimTopicsRegistryProxy", [ia])
  );
  d.sharedTIR = await step("Shared TrustedIssuersRegistry", () =>
    deployByName(config, account, "TrustedIssuersRegistryProxy", [ia])
  );
  d.sharedIR = await step("Shared IdentityRegistry", () =>
    deployByName(config, account, "IdentityRegistryProxy", [ia, d.sharedTIR, d.sharedCTR, d.sharedIRS])
  );
  await step("Bind shared IR ↔ shared storage", () =>
    send(config, account, d.sharedIRS as Address, "IdentityRegistryStorage", "bindIdentityRegistry", [d.sharedIR])
  );
  await step("Require KYC topic on shared registry", () =>
    send(config, account, d.sharedCTR as Address, "ClaimTopicsRegistry", "addClaimTopic", [KYC_CLAIM_TOPIC])
  );
  await step("Trust ClaimIssuer on shared registry", () =>
    send(config, account, d.sharedTIR as Address, "TrustedIssuersRegistry", "addTrustedIssuer", [d.claimIssuer, [KYC_CLAIM_TOPIC]])
  );
  await step("Make KYC service an agent of shared registry", () =>
    send(config, account, d.sharedIR as Address, "IdentityRegistry", "addAgent", [account])
  );

  // --- UI index ---
  d.platformRegistry = await step("PlatformRegistry (UI index)", () =>
    deployByName(config, account, "PlatformRegistry")
  );

  return d as PlatformDeployment;
}

// ============================================================================
// 2. KYC SERVICE — onboard an investor into the shared registry
// ============================================================================

export async function onboardInvestor(
  config: Config,
  account: Address,
  d: PlatformDeployment,
  wallet: Address,
  country: number
): Promise<Address> {
  // 1. Identity
  let identity = await read<Address>(config, d.idFactory as Address, "IdFactory", "getIdentity", [wallet]);
  if (identity === zeroAddress) {
    const salt = wallet; // unique & deterministic per wallet
    if (wallet.toLowerCase() === account.toLowerCase()) {
      await send(config, account, d.idFactory as Address, "IdFactory", "createIdentity", [wallet, salt]);
    } else {
      await send(config, account, d.idFactory as Address, "IdFactory", "createIdentityWithManagementKeys", [
        wallet,
        salt,
        [addressKey(account)],
      ]);
    }
    identity = await read<Address>(config, d.idFactory as Address, "IdFactory", "getIdentity", [wallet]);
  }

  // 2. Register in the shared registry
  const contained = await read<boolean>(config, d.sharedIR as Address, "IdentityRegistry", "contains", [wallet]);
  if (!contained) {
    await send(config, account, d.sharedIR as Address, "IdentityRegistry", "registerIdentity", [wallet, identity, country]);
  }

  // 3. Add the KYC claim (if not present)
  const claimId = keccak256(
    encodeAbiParameters(parseAbiParameters("address,uint256"), [d.claimIssuer as Address, KYC_CLAIM_TOPIC])
  );
  const existing = (await read<{ issuer: Address }>(config, identity, "Identity", "getClaim", [claimId])) as {
    issuer: Address;
  };
  if (existing.issuer === zeroAddress) {
    const data = stringToHex(KYC_CLAIM_DATA);
    const dataHash = keccak256(
      encodeAbiParameters(parseAbiParameters("address,uint256,bytes"), [identity, KYC_CLAIM_TOPIC, data])
    );
    const signature = await signMessage(config, { account, message: { raw: dataHash } });
    await send(config, account, identity, "Identity", "addClaim", [
      KYC_CLAIM_TOPIC,
      CLAIM_SCHEME_ECDSA,
      d.claimIssuer,
      signature,
      data,
      "",
    ]);
  }

  // 4. Index for the UI
  await send(config, account, d.platformRegistry as Address, "PlatformRegistry", "recordInvestor", [wallet, identity, country]);
  return identity;
}

/**
 * Re-issue (or add) the KYC claim on an identity that already exists.
 * Safe to call even when a claim is already present — addClaim replaces it.
 */
export async function reissueClaim(
  config: Config,
  account: Address,
  d: PlatformDeployment,
  identity: Address
): Promise<void> {
  const data = stringToHex(KYC_CLAIM_DATA);
  const dataHash = keccak256(
    encodeAbiParameters(parseAbiParameters("address,uint256,bytes"), [identity, KYC_CLAIM_TOPIC, data])
  );
  const signature = await signMessage(config, { account, message: { raw: dataHash } });
  await send(config, account, identity, "Identity", "addClaim", [
    KYC_CLAIM_TOPIC,
    CLAIM_SCHEME_ECDSA,
    d.claimIssuer,
    signature,
    data,
    "",
  ]);
}

/** The identity contract a wallet is registered against, per the shared registry. */
export async function identityOf(config: Config, d: PlatformDeployment, wallet: Address): Promise<Address> {
  return read<Address>(config, d.sharedIR as Address, "IdentityRegistry", "identity", [wallet], d.chainId);
}

/**
 * Link an ADDITIONAL wallet to an existing entity (identity) — the multi-wallet
 * model: KYC is done once per entity, and extra wallets reuse the same identity
 * and its claims, with NO new KYC.
 *
 * We model the link at the registry level (register the new wallet against the
 * same identity), which is what actually enables transfers. Note: OnchainID's
 * `IdFactory.linkWallet` records the same association in the factory, but it can
 * only be called by a wallet already owned by the entity — so in this
 * operator-driven PoC we link at the registry level instead.
 */
export async function linkWalletToEntity(
  config: Config,
  account: Address,
  d: PlatformDeployment,
  entityIdentity: Address,
  newWallet: Address,
  country: number
): Promise<void> {
  const contained = await read<boolean>(config, d.sharedIR as Address, "IdentityRegistry", "contains", [newWallet]);
  if (!contained) {
    await send(config, account, d.sharedIR as Address, "IdentityRegistry", "registerIdentity", [
      newWallet,
      entityIdentity,
      country,
    ]);
  }
  // Index the new wallet under the SAME identity so the UI groups it correctly.
  await send(config, account, d.platformRegistry as Address, "PlatformRegistry", "recordInvestor", [
    newWallet,
    entityIdentity,
    country,
  ]);
}

// ============================================================================
// 3. ISSUER — deploy a token and apply a KYC policy
// ============================================================================

export interface DeployTokenParams {
  name: string;
  symbol: string;
  decimals: number;
  policy: Policy;
  /** For WhitelistCustom: the investor wallets to register on this token. */
  customInvestors?: Address[];
  country?: number;
}

export interface DeployedToken {
  token: Address;
  identityRegistry: Address;
}

export async function deployToken(
  config: Config,
  account: Address,
  d: PlatformDeployment,
  params: DeployTokenParams
): Promise<DeployedToken> {
  const salt = `${params.symbol}-${Date.now()}`;
  const tokenDetails = {
    owner: account,
    name: params.name,
    symbol: params.symbol,
    decimals: params.decimals,
    irs: zeroAddress,
    ONCHAINID: zeroAddress,
    irAgents: [account],
    tokenAgents: [account],
    complianceModules: [],
    complianceSettings: [],
  };
  const claimDetails = {
    claimTopics: [KYC_CLAIM_TOPIC],
    issuers: [d.claimIssuer],
    issuerClaims: [[KYC_CLAIM_TOPIC]],
  };

  const hash = await writeContract(config, {
    address: d.trexFactory as Address,
    abi: getAbi("TREXFactory"),
    functionName: "deployTREXSuite",
    args: [salt, tokenDetails, claimDetails],
    account,
  });
  const receipt = await waitForTransactionReceipt(config, { hash });

  const events = parseEventLogs({
    abi: getAbi("TREXFactory"),
    logs: receipt.logs,
    eventName: "TREXSuiteDeployed",
  });
  if (events.length === 0) throw new Error("TREXSuiteDeployed event not found");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (events[0] as any).args._token as Address;

  const identityRegistry = await read<Address>(config, token, "Token", "identityRegistry", []);

  // Apply the KYC policy.
  if (params.policy === Policy.WhitelistAll) {
    // Two transactions, independent of investor count: rebind this token's
    // registry to the shared storage that already holds every investor.
    await send(config, account, d.sharedIRS as Address, "IdentityRegistryStorage", "bindIdentityRegistry", [identityRegistry]);
    await send(config, account, identityRegistry, "IdentityRegistry", "setIdentityRegistryStorage", [d.sharedIRS]);
  } else {
    // Register only the manually selected wallets into this token's registry.
    // Resolve each wallet's identity from the SHARED registry (works for both
    // primary and linked wallets, unlike IdFactory.getIdentity).
    const country = params.country ?? 840;
    for (const wallet of params.customInvestors ?? []) {
      const identity = await read<Address>(config, d.sharedIR as Address, "IdentityRegistry", "identity", [wallet], d.chainId);
      await send(config, account, identityRegistry, "IdentityRegistry", "registerIdentity", [wallet, identity, country]);
    }
  }

  await send(config, account, d.platformRegistry as Address, "PlatformRegistry", "recordToken", [
    token,
    account,
    params.name,
    params.symbol,
    params.policy,
  ]);

  return { token, identityRegistry };
}

/**
 * Whitelist an already-onboarded wallet for a specific WHITELIST-CUSTOM token,
 * after the token has been deployed. Registers the wallet into the token's own
 * registry, reusing the identity it already has in the shared registry (so no
 * new KYC). No-op for whitelist-all tokens (they read the shared registry).
 */
export async function whitelistWalletOnToken(
  config: Config,
  account: Address,
  d: PlatformDeployment,
  token: Address,
  wallet: Address,
  country: number
): Promise<void> {
  const ir = await read<Address>(config, token, "Token", "identityRegistry", [], d.chainId);
  const identity = await read<Address>(config, d.sharedIR as Address, "IdentityRegistry", "identity", [wallet], d.chainId);
  if (identity === zeroAddress) {
    throw new Error("That wallet isn't onboarded on the platform yet — onboard it in the KYC tab first.");
  }
  // Verify the KYC claim is actually present — if it's missing, isVerified() will
  // return false during transfer even though the wallet is registered.
  const claimId = keccak256(
    encodeAbiParameters(parseAbiParameters("address,uint256"), [d.claimIssuer as Address, KYC_CLAIM_TOPIC])
  );
  const claim = (await read<{ issuer: Address }>(config, identity, "Identity", "getClaim", [claimId], d.chainId));
  if (claim.issuer === zeroAddress) {
    throw new Error("That wallet's identity is missing the KYC claim. Use 'Re-issue claim' in the KYC tab first, then retry.");
  }
  const contained = await read<boolean>(config, ir, "IdentityRegistry", "contains", [wallet]);
  if (contained) return;
  await send(config, account, ir, "IdentityRegistry", "registerIdentity", [wallet, identity, country]);
}

/**
 * Returns the subset of `candidates` that are registered in this token's own
 * IdentityRegistry (i.e. currently whitelisted for the token).
 */
export async function getTokenWhitelist(
  config: Config,
  token: Address,
  candidates: Address[],
  chainId?: number
): Promise<Address[]> {
  const ir = await read<Address>(config, token, "Token", "identityRegistry", [], chainId);
  const checks = await Promise.all(
    candidates.map((w) => read<boolean>(config, ir, "IdentityRegistry", "contains", [w], chainId))
  );
  return candidates.filter((_, i) => checks[i]);
}

// ============================================================================
// 4. DISTRIBUTION + reads
// ============================================================================

export async function tokenPaused(config: Config, token: Address): Promise<boolean> {
  return read<boolean>(config, token, "Token", "paused", []);
}

export async function unpauseToken(config: Config, account: Address, token: Address): Promise<void> {
  await send(config, account, token, "Token", "unpause", []);
}

/**
 * Dry-run a write via eth_call first, so a would-be revert surfaces its REAL
 * reason (e.g. "Identity is not verified.", "AgentRole: caller does not have the
 * Agent role") instead of the wallet's opaque gas-estimation/gas-cap error.
 */
async function simulateThenSend(
  config: Config,
  account: Address,
  address: Address,
  abiName: ContractName,
  functionName: string,
  args: unknown[]
): Promise<void> {
  await simulateContract(config, { address, abi: getAbi(abiName), functionName, args, account });
  await send(config, account, address, abiName, functionName, args);
}

export async function mintToken(config: Config, account: Address, token: Address, to: Address, amount: bigint): Promise<void> {
  await simulateThenSend(config, account, token, "Token", "mint", [to, amount]);
}

export async function transferToken(config: Config, account: Address, token: Address, to: Address, amount: bigint): Promise<void> {
  await simulateThenSend(config, account, token, "Token", "transfer", [to, amount]);
}

/**
 * Diagnose, condition-by-condition, why a wallet is or isn't verified FOR A
 * SPECIFIC TOKEN. Reads the token's own registry, claim-topics, trusted-issuers,
 * and the wallet's identity/claim — so the exact missing piece is obvious.
 */
export interface DiagItem {
  label: string;
  ok: boolean;
  detail?: string;
}

export async function diagnoseVerification(
  config: Config,
  d: PlatformDeployment,
  token: Address,
  wallet: Address
): Promise<{ items: DiagItem[]; identity: Address; verified: boolean }> {
  const ir = await read<Address>(config, token, "Token", "identityRegistry", [], d.chainId);
  const registered = await read<boolean>(config, ir, "IdentityRegistry", "contains", [wallet], d.chainId);
  const identity = registered
    ? await read<Address>(config, ir, "IdentityRegistry", "identity", [wallet], d.chainId)
    : await read<Address>(config, d.idFactory as Address, "IdFactory", "getIdentity", [wallet], d.chainId);

  const items: DiagItem[] = [];
  items.push({
    label: "Wallet is registered in THIS token's registry",
    ok: registered,
    detail: registered
      ? undefined
      : "Not in the registry this token reads. Whitelist-custom: use the amber Whitelist box. Whitelist-all: onboard the wallet in the KYC tab.",
  });

  const ctr = await read<Address>(config, ir, "IdentityRegistry", "topicsRegistry", [], d.chainId);
  const tir = await read<Address>(config, ir, "IdentityRegistry", "issuersRegistry", [], d.chainId);
  const topics = await read<bigint[]>(config, ctr, "ClaimTopicsRegistry", "getClaimTopics", [], d.chainId);
  items.push({ label: `Token requires the KYC claim topic (${KYC_CLAIM_TOPIC})`, ok: topics.some((t) => t === KYC_CLAIM_TOPIC) });

  const trusted = await read<Address[]>(config, tir, "TrustedIssuersRegistry", "getTrustedIssuersForClaimTopic", [KYC_CLAIM_TOPIC], d.chainId);
  const issuerTrusted = trusted.map((a) => a.toLowerCase()).includes((d.claimIssuer as string).toLowerCase());
  items.push({
    label: "Platform ClaimIssuer is trusted by this token for KYC",
    ok: issuerTrusted,
    detail: issuerTrusted ? undefined : "This token trusts a different issuer — likely deployed against an older infrastructure. Redeploy cleanly.",
  });

  let hasClaim = false;
  let claimValid = false;
  if (identity !== zeroAddress) {
    const claimId = keccak256(encodeAbiParameters(parseAbiParameters("address,uint256"), [d.claimIssuer as Address, KYC_CLAIM_TOPIC]));
    const claim = (await read<{ issuer: Address; signature: `0x${string}`; data: `0x${string}` }>(config, identity, "Identity", "getClaim", [claimId], d.chainId));
    hasClaim = !!claim.issuer && claim.issuer !== zeroAddress;
    if (hasClaim) {
      claimValid = await read<boolean>(config, d.claimIssuer as Address, "ClaimIssuer", "isClaimValid", [identity, KYC_CLAIM_TOPIC, claim.signature, claim.data], d.chainId);
    }
  }
  items.push({
    label: "Identity holds a KYC claim from the platform ClaimIssuer",
    ok: hasClaim,
    detail: hasClaim ? undefined : "Claim was never added — onboarding didn't complete the addClaim step.",
  });
  items.push({
    label: "The KYC claim's signature is valid",
    ok: claimValid,
    detail: hasClaim && !claimValid ? "Claim exists but its signature doesn't validate (signed by a key without CLAIM purpose on the ClaimIssuer)." : undefined,
  });

  const verified = registered && hasClaim && claimValid && issuerTrusted && topics.some((t) => t === KYC_CLAIM_TOPIC);
  return { items, identity, verified };
}

/** The connected wallet's authority over a token (and its registry). */
export interface TokenRoles {
  isTokenAgent: boolean; // can mint / burn / pause / freeze
  isRegistryAgent: boolean; // can modify the whitelist (register identities)
  tokenOwner: Address; // can change config / agents
  identityRegistry: Address;
}

export async function getTokenRoles(
  config: Config,
  d: PlatformDeployment,
  token: Address,
  wallet: Address
): Promise<TokenRoles> {
  const [isTokenAgent, tokenOwner, identityRegistry] = await Promise.all([
    read<boolean>(config, token, "Token", "isAgent", [wallet], d.chainId),
    read<Address>(config, token, "Token", "owner", [], d.chainId),
    read<Address>(config, token, "Token", "identityRegistry", [], d.chainId),
  ]);
  const isRegistryAgent = await read<boolean>(config, identityRegistry, "IdentityRegistry", "isAgent", [wallet], d.chainId);
  return { isTokenAgent, isRegistryAgent, tokenOwner, identityRegistry };
}

export async function balanceOf(config: Config, token: Address, owner: Address): Promise<bigint> {
  return read<bigint>(config, token, "Token", "balanceOf", [owner]);
}

export async function totalSupplyOf(config: Config, token: Address, chainId?: number): Promise<bigint> {
  return read<bigint>(config, token, "Token", "totalSupply", [], chainId);
}

export async function isVerifiedOnToken(config: Config, token: Address, wallet: Address): Promise<boolean> {
  const ir = await read<Address>(config, token, "Token", "identityRegistry", []);
  return read<boolean>(config, ir, "IdentityRegistry", "isVerified", [wallet]);
}

// --- PlatformRegistry reads (for the dashboards) ---

export interface InvestorRow {
  wallet: Address;
  identity: Address;
  country: number;
  onboardedAt: bigint;
}

export interface TokenRow {
  token: Address;
  issuer: Address;
  name: string;
  symbol: string;
  policy: number;
  issuedAt: bigint;
}

export async function listInvestors(config: Config, d: PlatformDeployment): Promise<InvestorRow[]> {
  const reg = d.platformRegistry as Address;
  const wallets = await read<Address[]>(config, reg, "PlatformRegistry", "getInvestors", [], d.chainId);
  const rows: InvestorRow[] = [];
  for (const wallet of wallets) {
    const r = (await read<unknown[]>(config, reg, "PlatformRegistry", "investors", [wallet], d.chainId)) as [
      Address,
      Address,
      number,
      bigint,
      boolean
    ];
    rows.push({ wallet: r[0], identity: r[1], country: Number(r[2]), onboardedAt: r[3] });
  }
  return rows;
}

export async function listTokens(config: Config, d: PlatformDeployment): Promise<TokenRow[]> {
  const reg = d.platformRegistry as Address;
  const addrs = await read<Address[]>(config, reg, "PlatformRegistry", "getTokens", [], d.chainId);
  const rows: TokenRow[] = [];
  for (const token of addrs) {
    const r = (await read<unknown[]>(config, reg, "PlatformRegistry", "tokens", [token], d.chainId)) as [
      Address,
      Address,
      string,
      string,
      number,
      bigint,
      boolean
    ];
    rows.push({ token: r[0], issuer: r[1], name: r[2], symbol: r[3], policy: Number(r[4]), issuedAt: r[5] });
  }
  return rows;
}
