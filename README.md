# Tokenized Real Estate — an ERC‑3643 (T‑REX) Proof of Concept

> A complete, runnable reference implementation of a **permissioned security
> token** built on the [ERC‑3643](https://eips.ethereum.org/EIPS/eip-3643)
> ("T‑REX") standard, deployed to the **Sepolia** testnet with
> [Hardhat](https://hardhat.org/).

This project tokenizes a **fictional** real‑estate asset — the *Tokenized Real
Estate Token* (`TRE`) — and demonstrates the one feature that distinguishes a
security token from a plain ERC‑20: **transfers are only possible between
identity‑verified, KYC'd wallets.** Send tokens to a wallet that has not been
verified and the transfer *reverts on‑chain*.

> [!WARNING]
> **This is a learning proof of concept.** There is **no real asset**, no legal
> wrapper, and no economic value. It runs on a **testnet only**. Do not reuse
> the keys, addresses, or claims here for anything that matters. It exists so
> that others can learn how ERC‑3643 fits together from a working example.

> [!TIP]
> **Prefer a visual, click-through experience?** This repo also ships a web app
> in [`platform/`](platform/) — a static single-page dApp that demonstrates a
> **multi-tenant tokenization platform** with separate **Admin**, **KYC
> service**, **Issuer**, and **Explorer** roles (deploy infrastructure, onboard
> investors, issue tokens with "whitelist all" / "whitelist custom" policies,
> mint and transfer). See [platform/README.md](platform/README.md). The CLI
> scripts below are the lower-level, single-token walkthrough of the same ideas.

---

## Table of contents

1. [What is ERC‑3643 (T‑REX)?](#what-is-erc3643-t-rex)
2. [Why permissioned tokens?](#why-permissioned-tokens)
3. [Architecture](#architecture)
4. [The actors in this PoC](#the-actors-in-this-poc)
5. [Project structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Wallet setup (dedicated testnet account)](#wallet-setup-dedicated-testnet-account)
8. [Setup](#setup)
9. [Running the PoC, step by step](#running-the-poc-step-by-step)
10. [How identity verification actually works](#how-identity-verification-actually-works)
11. [Standard vs. this PoC — what's invariant and what we chose](#standard-vs-this-poc--whats-invariant-and-what-we-chose)
12. [Design notes & decisions](#design-notes--decisions)
13. [Troubleshooting](#troubleshooting)
14. [References & credits](#references--credits)
15. [License](#license)

---

## What is ERC‑3643 (T‑REX)?

**ERC‑3643** is an Ethereum standard for **permissioned tokens** representing
real‑world securities (equity, debt, funds, real estate, …). It was originally
developed by [Tokeny](https://tokeny.com/) under the name **T‑REX**
("Token for Regulated EXchanges") and later standardized as an ERC.

Where ERC‑20 says *"anyone holding a token can send it to anyone else"*,
ERC‑3643 says *"a transfer is only valid if both parties are eligible."*
Eligibility is enforced **at the smart‑contract level, on every transfer**, by
checking two things:

| Check | Question it answers | Enforced by |
|-------|---------------------|-------------|
| **Identity** | *Does this wallet belong to a verified, KYC'd party?* | `IdentityRegistry` + OnchainID claims |
| **Compliance** | *Does this specific transfer respect the rules?* (caps, country limits, lockups, …) | `ModularCompliance` + modules |

The standard is built from a well‑defined set of contracts working together —
that set is what we deploy here.

## Why permissioned tokens?

A regulated security cannot legally be held by an anonymous, unvetted wallet.
Issuers must enforce KYC/AML, jurisdiction rules, holder caps, lock‑ups, and the
ability to recover or freeze assets. ERC‑3643 bakes these requirements into the
token itself, so compliance is **guaranteed by code** rather than hoped for
off‑chain. The token can be freely traded on any venue and *still* remain
compliant, because the rules travel with the asset.

---

## Architecture

ERC‑3643 is not a single contract — it is a **suite** of cooperating contracts.
This PoC deploys two layers.

### Layer 1 — OnchainID (the identity layer)

[OnchainID](https://www.onchainid.com/) provides **self‑sovereign on‑chain
identities** (ERC‑734/735). Each real‑world party gets an `Identity` contract
that holds **claims** (signed attestations such as "this party passed KYC").

```
Identity (impl)  ──used by──►  ImplementationAuthority  ──configures──►  IdFactory
                                                                              │
                                                                       deploys identities
                                                                              │
ClaimIssuer  ──signs KYC claims that get attached to──►  investor Identity ◄──┘
```

| Contract | Role |
|----------|------|
| `Identity` | Logic contract for every identity (deployed once, reused via proxies). |
| `ImplementationAuthority` | Tells identity proxies which logic version to use. |
| `IdFactory` | CREATE2 factory that deploys an identity for each wallet. |
| `ClaimIssuer` | A special identity (owned by the issuer) that **signs** KYC claims. The token is configured to *trust* it. |

### Layer 2 — T‑REX (the token suite)

Every contract below is an **upgradeable proxy** pointing at shared
implementation logic, indexed by version in the `TREXImplementationAuthority`.
The whole suite is deployed in a **single transaction** by the `TREXFactory`.

```
                         TREXFactory.deployTREXSuite()
                                      │
        ┌─────────────────┬───────────┴───────────┬─────────────────────┐
        ▼                 ▼                       ▼                     ▼
     Token (TRE)   IdentityRegistry        ModularCompliance     (token's OnchainID)
        │                 │                       │
        │      ┌──────────┼───────────┐           └─ transfer rule modules (none in this PoC)
        │      ▼          ▼           ▼
        │  IdentityRegistry  ClaimTopics   TrustedIssuers
        │     Storage        Registry        Registry
        │      (who's       (which claims  (which issuers
        │     verified)      are required)  are trusted)
        ▼
   every transfer() asks: identityRegistry.isVerified(to) && compliance.canTransfer(from,to,amt)
```

| Contract | Role |
|----------|------|
| `Token` | The ERC‑3643 token. Overrides `transfer`/`mint` to enforce eligibility. |
| `IdentityRegistry` | Maps each wallet → its OnchainID and exposes `isVerified()`. |
| `IdentityRegistryStorage` | Shared storage backing one or more registries. |
| `ClaimTopicsRegistry` | The list of claim topics a holder **must** have (here: KYC). |
| `TrustedIssuersRegistry` | The claim issuers the token trusts (here: our `ClaimIssuer`). |
| `ModularCompliance` | Pluggable engine for extra transfer rules (no modules here → always allows). |
| `TREXImplementationAuthority` | Holds the versioned implementation addresses for all proxies. |
| `TREXFactory` / `IAFactory` | Deploy a full, correctly‑wired suite in one call. |

### The golden rule, in code

Inside the `Token` contract, every transfer ultimately runs this check
(simplified from the upstream source):

```solidity
if (identityRegistry.isVerified(_to) && compliance.canTransfer(from, _to, _amount)) {
    // ... move the tokens
}
revert("Transfer not possible");
```

That single line is what this entire PoC exists to demonstrate.

---

## The actors in this PoC

To keep setup friction low, **one funded account** plays several roles. This is
fine for a PoC; in production these would be separate, secured keys.

| Actor | Who | Needs ETH? | Responsibilities |
|-------|-----|:---------:|------------------|
| **Deployer / Issuer / Agent / Treasury** | `DEPLOYER_PRIVATE_KEY` | ✅ Yes | Deploys everything; owns the token & registries; mints; registers identities; custodies the initial supply. |
| **Claim signer** | `CLAIM_SIGNER_PRIVATE_KEY` (optional; defaults to deployer) | ❌ No | Cryptographically signs KYC claims. Only signs off‑chain. |
| **Investor** | `INVESTOR_ADDRESS` (optional; auto‑generated) | ❌ No | A token *recipient*. Receiving never requires a signature, so no private key is needed. |

---

## Project structure

```
tokenized-real-estate/
├── contracts/
│   ├── Dependencies.sol          # imports T-REX + OnchainID so Hardhat compiles them
│   └── PlatformRegistry.sol      # thin on-chain index of investors & tokens (used by the web app)
├── scripts/
│   ├── lib/
│   │   ├── constants.js          # token params, claim topic, country, supply
│   │   ├── contracts.js          # fully-qualified artifact names
│   │   ├── deployments.js        # load/save deployed addresses per network
│   │   ├── network.js            # guard against the ephemeral "hardhat" network
│   │   ├── onboarding.js         # reusable "create identity + register + KYC" helper
│   │   └── signers.js            # resolves deployer & claim-signer accounts
│   ├── 01_deploy_onchainid.js    # Step 1: identity layer + ClaimIssuer
│   ├── 02_deploy_token.js        # Step 2: full T-REX token suite via TREXFactory
│   ├── 03_register_investor.js   # Step 3: onboard an investor (KYC)
│   ├── 04_test_transfer.js       # Step 4: mint → blocked transfer → verify → success
│   ├── generate_wallet.js        # create a dedicated testnet wallet
│   ├── platform_e2e.js           # validates the full multi-tenant platform flow on localhost
│   └── export_artifacts.js       # exports ABIs+bytecode to platform/src/contracts/artifacts.json
├── platform/                     # 🌐 the web app (static Next.js SPA) — see platform/README.md
├── deployments/                  # generated <network>.json files (git-ignored)
├── .env.example                  # copy to .env and fill in
├── hardhat.config.js             # Solidity 0.8.17 + Sepolia network
├── package.json
├── CLAUDE.md                     # guidance for AI coding agents
└── README.md
```

---

## Prerequisites

- **Node.js ≥ 18** (LTS recommended) and npm.
- A **Sepolia RPC URL** — free from [Alchemy](https://alchemy.com),
  [Infura](https://infura.io), or any public provider.
- A **dedicated testnet wallet** with a small amount of Sepolia ETH — see the
  next section for the one‑command way to generate one.

---

## Wallet setup (dedicated testnet account)

> [!IMPORTANT]
> **Always use a wallet you created specifically for this PoC.** Never reuse a
> key that holds real ETH or mainnet tokens. The private key lives in a
> plain‑text `.env` file — accidentally committing or leaking that file is a
> real risk. With a testnet‑only key, the worst outcome is an inconvenience;
> with a mainnet key it is a loss of real funds.
>
> MetaMask "Create Account" is **not enough**: all MetaMask accounts share the
> same seed phrase, so exporting any one private key also exposes your other
> accounts. Generate a fully independent keypair instead.

### 1. Generate a fresh keypair

After running `npm install`, a helper script is available. It uses the project's
own ethers.js dependency — no extra tools required.

```bash
npm run generate:wallet
```

Sample output:

```
  Address     : 0xAbCd…1234
  Private key : 0xdeadbeef…
  Mnemonic    : word word word word word word word word word word word word
```

Copy the **private key** into your `.env`:

```dotenv
DEPLOYER_PRIVATE_KEY="0xdeadbeef…"
```

Save the mnemonic somewhere safe if you want to import this key into MetaMask
later. You don't need MetaMask to run the PoC.

### 2. Fund the address with Sepolia ETH

Paste the **address** (not the private key) into one of these faucets. A small
fraction of an ETH is more than enough for the full four‑step run.

| Faucet | Signup required? | Notes |
|--------|:----------------:|-------|
| [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | No | 0.05 ETH/day per wallet. Easiest to start with. |
| [Alchemy Sepolia Faucet](https://sepoliafaucet.com) | Yes (free) | 0.5 ETH/day. Reliable. |
| [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia) | Yes (free) | 0.5 ETH/day. Reliable. |
| [QuickNode Faucet](https://faucet.quicknode.com/ethereum/sepolia) | Yes (free) | 0.1 ETH/day. |
| [PoW Faucet](https://sepolia-faucet.pk910.de) | No | Mines test ETH in your browser. No signup, but slower. |

### 3. Verify the balance

Check that the ETH arrived before running the deploy scripts:

```
https://sepolia.etherscan.io/address/<YOUR_ADDRESS>
```

Once the balance shows up (usually within 30 seconds), you are ready to continue
with the [Setup](#setup) section.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env        # macOS / Linux
# copy .env.example .env    # Windows (cmd)

# 3. Edit .env and set at least:
#    SEPOLIA_RPC_URL      = your RPC endpoint
#    DEPLOYER_PRIVATE_KEY = a funded Sepolia test key

# 4. Compile (downloads solc 0.8.17 and builds the T-REX + OnchainID sources)
npm run compile
```

> The contracts are **compiled from source** (not loaded from prebuilt
> artifacts), so the bytecode you deploy comes from code you can read in
> `node_modules/@tokenysolutions/t-rex` and `node_modules/@onchain-id/solidity`.

---

## Running the PoC, step by step

Run the four scripts in order. Each one saves its results to
`deployments/sepolia.json`, so the next step can pick up where the last left
off. Every script is **idempotent** — safe to re‑run; already‑completed work is
detected and skipped.

### Step 1 — Deploy the identity layer + Claim Issuer

```bash
npm run deploy:onchainid
```

Deploys the OnchainID `Identity` logic, its `ImplementationAuthority`, the
`IdFactory`, and the `ClaimIssuer`, then grants the claim‑signer key the CLAIM
purpose so its signatures will be trusted.

### Step 2 — Deploy the T‑REX token suite

```bash
npm run deploy:token
```

Deploys the six implementation contracts, registers them as version `4.0.0` in
the `TREXImplementationAuthority`, deploys the `TREXFactory` + `IAFactory`,
authorizes the factory on the `IdFactory`, and finally calls `deployTREXSuite()`
to deploy the fully‑wired **TRE** token — configured to require a **KYC claim**
issued by our `ClaimIssuer`.

### Step 3 — Onboard an investor (KYC)

```bash
npm run register:investor
```

For the configured `INVESTOR_ADDRESS` (or a freshly generated one), this:
creates an OnchainID identity → registers it in the `IdentityRegistry` →
attaches a Claim‑Issuer‑signed **KYC claim**. Afterwards
`isVerified(investor)` returns `true`.

### Step 4 — Prove the compliance gate end to end

```bash
npm run test:transfer
```

This is the payoff. It:

1. Onboards the treasury and **mints** the initial `TRE` supply to it.
2. Tries to transfer to a **brand‑new, unverified** wallet → **reverts**
   (checked via a gas‑free static call) ✅
3. **Onboards** that wallet (KYC + register) → it becomes verified.
4. **Retries** the transfer → **succeeds**, and balances are asserted ✅

Expected tail of the output:

```
   ✅ PASS  transfer reverted as expected → "...'Transfer not possible'"
   ...
   ✅ PASS  transfer of 100 TRE succeeded
 🎉 All compliance checks passed.
```

> 💡 You can also run any step against a **local Hardhat node** for free
> (no Sepolia ETH): start `npx hardhat node` in one terminal, then run the
> scripts with `--network localhost`. This is exactly how the scripts in this
> repo were validated.

---

## How identity verification actually works

This is the conceptual heart of ERC‑3643. A wallet is **verified** when, for
every claim topic the token requires, the linked identity holds a **valid
claim** from a **trusted issuer**.

```
                 ┌──────────────────────────────────────────────────────┐
                 │  Token.transfer(to, amount)                           │
                 │     └─► identityRegistry.isVerified(to) ?             │
                 └───────────────────────┬──────────────────────────────┘
                                         │
            ┌────────────────────────────┼─────────────────────────────────┐
            ▼                            ▼                                  ▼
   wallet → Identity            required topics                     trusted issuers
   (IdentityRegistry)           (ClaimTopicsRegistry: [KYC])        (TrustedIssuersRegistry: [ClaimIssuer])
            │                            │                                  │
            └──────────► For each required topic, the identity must hold a claim
                         whose signature recovers to a CLAIM key of a trusted issuer.
```

The **KYC claim** itself is produced like this (see `scripts/lib/onboarding.js`):

```js
dataHash  = keccak256(abi.encode(identityAddress, KYC_TOPIC, data))
signature = claimSigner.signMessage(getBytes(dataHash))   // EIP-191 personal_sign
identity.addClaim(KYC_TOPIC, scheme, claimIssuer, signature, data, "")
```

When the registry later calls `claimIssuer.isClaimValid(...)`, it re‑derives the
same hash, recovers the signer, and checks that the signer holds a **CLAIM
purpose** key on the trusted `ClaimIssuer`. If so → the claim is valid → the
holder is verified → the transfer is allowed.

---

## Standard vs. this PoC — what's invariant and what we chose

If you know REST, you know that "it's a REST API" tells you the *rules*
(resources, HTTP verbs, statelessness), while the *specific* endpoints and auth
are a design choice. Same here — but there are **three layers**, and it's worth
being able to tell them apart so you know what's guaranteed versus what is just
*our* decision.

| Layer | REST analogy | What it is |
|-------|--------------|------------|
| **1. ERC‑3643** | REST principles | The standard: interfaces + the transfer‑gating behavior. True of *every* ERC‑3643 system. |
| **2. T‑REX** | a framework (Express/Spring) | Tokeny's reference implementation (proxies, factory, modular compliance, OnchainID). Used by ~all real deployments, but a *choice*. |
| **3. This PoC** | your specific API design | Everything *we* decided on top. |

### Layer 1 — ERC‑3643: the invariant (every system has this)

**The golden rule** — a transfer succeeds **only if**
`identityRegistry.isVerified(to)` **and** `compliance.canTransfer(from, to, amount)`;
otherwise it reverts.

**The mandatory contracts** — `Token`, `IdentityRegistry`,
`IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`,
`Compliance`, and `Identity`+`Claims` (OnchainID / ERC‑734/735).

**The verification rule** — a wallet is *verified* if, for **every** required
claim topic, its identity holds a **valid claim** signed by a **trusted issuer**.

**The roles** — `owner` (configures), `agent` (mint / burn / forcedTransfer /
freeze / pause / recover), `trusted issuer` (signs accepted claims).

> If you swapped to a different ERC‑3643 implementation, *all of the above still
> holds.* That is the contract you can rely on.

### Layer 2 — T‑REX: the reference implementation (common, but a choice)

Present in this repo, **not** mandated by the EIP: upgradeable **proxies +
`ImplementationAuthority` + versioning**; **`TREXFactory.deployTREXSuite()`**
(one‑tx suite deployment); **`ModularCompliance` + pluggable modules**; the
**OnchainID `IdFactory`**.

### Layer 3 — this PoC's specific choices (where we had freedom)

This is the "API design" column — read it to know what is **us**, not the
standard:

| Aspect | Standard / typical production | **This PoC's choice** | Why |
|---|---|---|---|
| Roles / keys | Separate parties, each its own secured key | **One wallet plays all roles** | Demo simplicity |
| Claim signer | Dedicated, guarded CLAIM‑purpose key | **Deployer's management key signs claims** | Mgmt key satisfies the purpose check |
| Trusted issuer | Often per‑issuer / mutual recognition | **One platform‑wide `ClaimIssuer`** | Multi‑tenant shared‑KYC demo |
| Claim topics | Several (KYC, AML, accreditation, country…) | **A single topic `1` = "KYC"** | Keep the gate easy to see |
| Claim contents | A hash/reference to off‑chain data; never PII | **A plaintext demo string** | Readability; clearly fake |
| Identity PII | Off‑chain in the KYC provider's secured DB | **Labels in browser localStorage** (platform app) | No backend; simulates the off‑chain DB |
| Compliance rules | Real modules (country, max‑holders, lockups…) | **Zero modules → `canTransfer` always true** | Isolate the *identity* gate |
| Token decimals | Issuer's choice | **0 (1 token = 1 share)** | Clean demo math |
| "Whitelist all" | Share one `IdentityRegistryStorage` across tokens | **Rebind each token's fresh storage to a shared one after deploy** | Our orchestration of that capability |
| Investor/token discovery | Platform's backend database | **`PlatformRegistry.sol` — a non‑standard contract we invented** | No backend; the standard doesn't enumerate |
| Wallet linking | Entity calls `IdFactory.linkWallet` itself | **Operator links at the registry level** | One operator drives everything |
| Identity control | The investor controls their own identity | **Operator holds a mgmt key on investor identities** | So the operator can attach claims in the demo |
| Network / build | Mainnet, audited, ops‑hardened | **Sepolia/localhost, compiled from source, PoC only** | Learning |

### The one‑sentence test

- *"Would this be true on any other ERC‑3643 token?"* → **Layer 1 (standard).**
- *"Is this about proxies, the factory, modular compliance, or OnchainID's
  factory?"* → **Layer 2 (T‑REX).**
- Everything in the right‑hand column above → **Layer 3 (ours).**
  `PlatformRegistry.sol` is the clearest "this is ours" marker: it has **no
  equivalent in the standard at all.**

---

## Design notes & decisions

- **0 decimals.** `1 TRE = 1 indivisible share` of the property. This keeps the
  demo arithmetic free of 18‑decimal `wei`‑style scaling. ERC‑3643 supports
  0–18 decimals; change `TOKEN_DECIMALS` in `scripts/lib/constants.js` if you
  prefer fractional shares.
- **Compiled from source.** `contracts/Dependencies.sol` imports the concrete
  T‑REX/OnchainID contracts so the bytecode is built locally and auditable.
- **Solidity 0.8.17** is pinned to match the upstream `pragma` exactly.
- **Optimizer `runs: 200`** keeps the large `Token`/`TREXFactory`
  implementations under the 24 KB EIP‑170 deploy limit (verified during build).
- **One funded key.** Only the deployer needs ETH; investors are pure
  recipients, so the demo never needs their private keys.
- **Idempotent scripts.** Each step checks on‑chain/persisted state before
  acting, so re‑runs don't double‑deploy or error out.
- **No compliance modules.** `ModularCompliance` is deployed with zero modules,
  so it always permits transfers — isolating the *identity* gate for clarity.
  Adding e.g. a `CountryRestrictModule` or `MaxBalanceModule` is a natural next
  experiment.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `No deployer account configured` | `DEPLOYER_PRIVATE_KEY` missing in `.env`, or you forgot `--network sepolia`. |
| `insufficient funds for gas` | Fund the deployer with Sepolia ETH from a faucet. |
| `Missing deployment value(s) [...]` | Run the earlier step(s) first; they populate `deployments/sepolia.json`. |
| `could not detect network` / RPC timeouts | Check `SEPOLIA_RPC_URL`; some public RPCs rate‑limit — use Alchemy/Infura. |
| `salt already taken` / `token already deployed` | You already deployed this suite. The scripts normally detect and reuse it; delete `deployments/sepolia.json` only if you intend a clean redeploy. |
| Want a free dry run | Use a local node: `npx hardhat node` + `--network localhost`. |

---

## References & credits

- **ERC‑3643 standard** — <https://eips.ethereum.org/EIPS/eip-3643>
- **T‑REX (Tokeny)** — <https://github.com/TokenySolutions/T-REX> ·
  npm: [`@tokenysolutions/t-rex`](https://www.npmjs.com/package/@tokenysolutions/t-rex)
- **OnchainID** — <https://www.onchainid.com/> ·
  npm: [`@onchain-id/solidity`](https://www.npmjs.com/package/@onchain-id/solidity)
- **ERC‑734 / ERC‑735** (key & claim holder standards) — the identity primitives.
- **ERC‑3643 Association** — <https://www.erc3643.org/>

The T‑REX and OnchainID smart contracts are © Tokeny Solutions and are used
here as published npm packages. This repository only adds deployment scripts,
configuration, and documentation around them.

## License

This PoC's own code (scripts, config, docs) is released under **GPL‑3.0**, to
stay aligned with the license of the underlying T‑REX contracts it builds upon.
See the upstream packages for their full license terms.
