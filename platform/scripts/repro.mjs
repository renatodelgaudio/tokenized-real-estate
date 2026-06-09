/**
 * Reproduces the EXACT browser flow using viem (the same lib the UI uses),
 * driven by Hardhat account #0 (0xf39F…2266 — the user's connected wallet).
 *
 * Purpose: determine whether "mint to onboarded self on a whitelist-all token"
 * fails due to a viem-specific bug in the frontend logic, or whether the UI
 * logic is correct (pointing to a browser state issue instead).
 *
 * Run (with a hardhat node on :8545):
 *   node platform/scripts/repro.mjs
 */
import { createWalletClient, createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, stringToHex, zeroAddress, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const artifacts = require("../src/contracts/artifacts.json");

const KYC = 1n;
const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"); // hh #0
const chain = { id: 31337, name: "hh", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } } };
const wallet = createWalletClient({ account, chain, transport: http() });
const pub = createPublicClient({ chain, transport: http() });

const abi = (n) => artifacts[n].abi;
const bytecode = (n) => artifacts[n].bytecode;

async function dep(n, args = []) {
  const hash = await wallet.deployContract({ abi: abi(n), bytecode: bytecode(n), args });
  const r = await pub.waitForTransactionReceipt({ hash });
  return r.contractAddress;
}
async function send(address, n, fn, args = []) {
  const hash = await wallet.writeContract({ address, abi: abi(n), functionName: fn, args });
  await pub.waitForTransactionReceipt({ hash });
}
async function read(address, n, fn, args = []) {
  return pub.readContract({ address, abi: abi(n), functionName: fn, args });
}
const akey = (a) => keccak256(encodeAbiParameters(parseAbiParameters("address"), [a]));

async function main() {
  const me = account.address;
  console.log("account:", me);

  // --- infra (mirror deployInfrastructure) ---
  const identityImpl = await dep("Identity", [me, true]);
  const oidIA = await dep("OID_ImplementationAuthority", [identityImpl]);
  const idFactory = await dep("IdFactory", [oidIA]);
  const claimIssuer = await dep("ClaimIssuer", [me]);
  const tokenImpl = await dep("Token");
  const ctrImpl = await dep("ClaimTopicsRegistry");
  const irImpl = await dep("IdentityRegistry");
  const irsImpl = await dep("IdentityRegistryStorage");
  const tirImpl = await dep("TrustedIssuersRegistry");
  const mcImpl = await dep("ModularCompliance");
  const trexIA = await dep("TREXImplementationAuthority", [true, zeroAddress, zeroAddress]);
  await send(trexIA, "TREXImplementationAuthority", "addAndUseTREXVersion", [
    { major: 4, minor: 0, patch: 0 },
    { tokenImplementation: tokenImpl, ctrImplementation: ctrImpl, irImplementation: irImpl, irsImplementation: irsImpl, tirImplementation: tirImpl, mcImplementation: mcImpl },
  ]);
  const trexFactory = await dep("TREXFactory", [trexIA, idFactory]);
  const iaFactory = await dep("IAFactory", [trexFactory]);
  await send(trexIA, "TREXImplementationAuthority", "setTREXFactory", [trexFactory]);
  await send(trexIA, "TREXImplementationAuthority", "setIAFactory", [iaFactory]);
  await send(idFactory, "IdFactory", "addTokenFactory", [trexFactory]);
  const sharedIRS = await dep("IdentityRegistryStorageProxy", [trexIA]);
  const sharedCTR = await dep("ClaimTopicsRegistryProxy", [trexIA]);
  const sharedTIR = await dep("TrustedIssuersRegistryProxy", [trexIA]);
  const sharedIR = await dep("IdentityRegistryProxy", [trexIA, sharedTIR, sharedCTR, sharedIRS]);
  await send(sharedIRS, "IdentityRegistryStorage", "bindIdentityRegistry", [sharedIR]);
  await send(sharedCTR, "ClaimTopicsRegistry", "addClaimTopic", [KYC]);
  await send(sharedTIR, "TrustedIssuersRegistry", "addTrustedIssuer", [claimIssuer, [KYC]]);
  await send(sharedIR, "IdentityRegistry", "addAgent", [me]);
  console.log("infra ok");

  // --- onboard SELF (mirror onboardInvestor self-branch) ---
  await send(idFactory, "IdFactory", "createIdentity", [me, me]);
  const identity = await read(idFactory, "IdFactory", "getIdentity", [me]);
  await send(sharedIR, "IdentityRegistry", "registerIdentity", [me, identity, 840]);
  const data = stringToHex("KYC verified - Tokenized Real Estate Platform PoC");
  const dataHash = keccak256(encodeAbiParameters(parseAbiParameters("address,uint256,bytes"), [identity, KYC, data]));
  const signature = await wallet.signMessage({ account, message: { raw: dataHash } });
  await send(identity, "Identity", "addClaim", [KYC, 1n, claimIssuer, signature, data, ""]);
  console.log("onboarded self, identity:", identity);
  console.log("verified on SHARED IR:", await read(sharedIR, "IdentityRegistry", "isVerified", [me]));

  // --- deploy whitelist-ALL token (mirror deployToken) ---
  const tokenDetails = { owner: me, name: "Milan Office Building", symbol: "MILAN2", decimals: 0, irs: zeroAddress, ONCHAINID: zeroAddress, irAgents: [me], tokenAgents: [me], complianceModules: [], complianceSettings: [] };
  const claimDetails = { claimTopics: [KYC], issuers: [claimIssuer], issuerClaims: [[KYC]] };
  const h = await wallet.writeContract({ address: trexFactory, abi: abi("TREXFactory"), functionName: "deployTREXSuite", args: [`MILAN2-${Date.now()}`, tokenDetails, claimDetails] });
  const rec = await pub.waitForTransactionReceipt({ hash: h });
  const ev = parseEventLogs({ abi: abi("TREXFactory"), logs: rec.logs, eventName: "TREXSuiteDeployed" });
  const token = ev[0].args._token;
  const tokenIR = await read(token, "Token", "identityRegistry", []);
  await send(sharedIRS, "IdentityRegistryStorage", "bindIdentityRegistry", [tokenIR]);
  await send(tokenIR, "IdentityRegistry", "setIdentityRegistryStorage", [sharedIRS]);
  console.log("token:", token, "tokenIR:", tokenIR);

  // --- THE CHECK: is self verified ON THE TOKEN, and can we mint? ---
  const verifiedOnToken = await read(tokenIR, "IdentityRegistry", "isVerified", [me]);
  console.log(">>> isVerified(self) on TOKEN registry:", verifiedOnToken);

  await send(token, "Token", "unpause", []);
  try {
    await send(token, "Token", "mint", [me, 1000n]);
    console.log(">>> MINT SUCCEEDED, balance:", await read(token, "Token", "balanceOf", [me]));
    console.log("\nRESULT: ✅ UI logic is correct — the user's issue is browser/state, not code.");
  } catch (e) {
    console.log(">>> MINT FAILED:", e.shortMessage || e.message);
    console.log("\nRESULT: ❌ reproduced a real bug in the UI logic.");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
