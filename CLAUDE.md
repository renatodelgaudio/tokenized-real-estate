# CLAUDE.md

Guidance for AI coding agents (and humans) working in this repository.

## What this project is

A **learning proof of concept** for the **ERC‑3643 ("T‑REX")** permissioned
security‑token standard. It tokenizes a *fictional* real‑estate asset (`TRE`)
and deploys the full T‑REX + OnchainID stack to the **Sepolia testnet** with
Hardhat. There is no real asset, no mainnet deployment, and no economic value.
The goal is **clarity and correctness as a reference implementation** — favor
readable, well‑commented code over cleverness.

The repo has **two layers**:
1. **Hardhat project** (root) — contracts + CLI scripts for the single-token
   walkthrough (the four `0x_*.js` steps).
2. **Web platform** (`platform/`) — a static Next.js SPA demonstrating a
   multi-tenant platform (Admin / KYC / Issuer / Explorer roles). It deploys and
   calls the **same** contracts from the browser via wagmi v2 + viem, using
   ABIs+bytecode exported by `scripts/export_artifacts.js`. See its own
   `platform/README.md` and the "Platform" section below.

## Golden rules

- **Sepolia / testnets only.** Never add mainnet networks or anything implying a
  real asset, real value, or a legal security offering. Keep the PoC framing.
- **Never commit secrets.** `.env` is git‑ignored. Only `.env.example` (with
  placeholders) is tracked. Never hard‑code private keys or RPC URLs.
- **Keep it a reference others learn from.** Comments explain *why*; scripts
  print clear, step‑by‑step progress; the README stays in sync with the code.
- **Don't vendor the upstream contracts.** T‑REX and OnchainID come from npm
  (`@tokenysolutions/t-rex`, `@onchain-id/solidity`). We compile them via
  `contracts/Dependencies.sol`; we do not copy their source into this repo.

## How it's built (key facts)

- **Solidity `0.8.17`**, optimizer `runs: 200`. Both are required: the version
  matches the upstream `pragma`, and the optimizer keeps `Token`/`TREXFactory`
  under the 24 KB EIP‑170 deploy limit. Don't change these casually.
- Contracts are **compiled from source** for auditability. `Dependencies.sol`
  only `import`s the concrete contracts we deploy — it has no logic.
- Scripts use **ethers v6** via `@nomicfoundation/hardhat-ethers` and look up
  artifacts by **fully‑qualified name** (see `scripts/lib/contracts.js`) because
  short names are ambiguous across the two packages.

## The four‑step flow

| Step | Script | Does |
|------|--------|------|
| 1 | `01_deploy_onchainid.js` | Identity impl + ImplementationAuthority + IdFactory + ClaimIssuer; grant CLAIM key. |
| 2 | `02_deploy_token.js` | 6 implementations → TREXImplementationAuthority (v4.0.0) → TREXFactory/IAFactory → `deployTREXSuite()`. |
| 3 | `03_register_investor.js` | Onboard an investor: create identity → register → add KYC claim. |
| 4 | `04_test_transfer.js` | Mint → transfer to unverified (revert) → onboard → transfer (success). |

Addresses persist to `deployments/<network>.json` between steps. Every script is
**idempotent** — preserve that property when editing (check state before acting).

## Shared libraries (`scripts/lib/`)

- `constants.js` — token name/symbol/decimals, salt, KYC topic, country, supply.
- `contracts.js` — fully‑qualified artifact names. Add new ones here.
- `deployments.js` — `load` / `save` / `require` addresses per network.
- `onboarding.js` — `onboardWallet(...)`: the reusable identity+register+KYC
  helper used by steps 3 **and** 4. Most identity logic lives here.
- `signers.js` — resolves the deployer and (optional) claim‑signer accounts.

## Domain gotchas (learned the hard way)

- A **management key (purpose 1)** satisfies *any* `keyHasPurpose` check in
  OnchainID, so the deployer can sign claims without an explicit CLAIM key.
- `createIdentityWithManagementKeys` **forbids listing the wallet itself** as a
  management key. So when onboarding the deployer's *own* wallet, use plain
  `createIdentity` (wallet becomes its own manager); for third parties, give the
  deployer a management key so it can attach claims on their behalf.
- The KYC claim signature is `signMessage(getBytes(keccak256(abi.encode(identity,
  topic, data))))` — EIP‑191 over the ABI‑encoded triple. This must match
  `ClaimIssuer.isClaimValid` exactly.
- **Tokens deploy paused.** Call `unpause()` (agent‑only) before transfers.
  `mint` works while paused, but the recipient must already be verified.
- Receiving tokens needs **no signature** — only the sender signs. That's why
  investor private keys are never required.

## How to validate changes (no Sepolia ETH needed)

```bash
npm run compile
npx hardhat node            # terminal 1 (persistent local chain)
npm run local:onchainid     # terminal 2
npm run local:token
npm run local:investor
npm run local:transfer
```

Step 4 ending in `🎉 All compliance checks passed.` means the full pipeline is
healthy. Clean up with `rm deployments/localhost.json` afterwards.

## Platform (web app in `platform/`)

- **Static SPA**, no backend: Next.js 15 `output: 'export'` → `out/`. wagmi v2 +
  viem, **injected (MetaMask) connector only** (no WalletConnect projectId).
- The browser deploys/calls contracts using `src/contracts/artifacts.json`,
  produced by `npm run export:artifacts` (root). **Regenerate it whenever any
  Solidity changes**, or the frontend will deploy stale bytecode.
- `src/lib/platform.ts` is the browser twin of `scripts/platform_e2e.js` — keep
  the two in sync. `platform_e2e.js` is the source of truth and the way to
  validate the on-chain logic without a browser.
- **"Whitelist all" mechanism:** onboarding writes investors into a *shared*
  `IdentityRegistryStorage` (via a shared IR the platform deploys). A
  whitelist-all token then does `sharedIRS.bindIdentityRegistry(tokenIR)` +
  `tokenIR.setIdentityRegistryStorage(sharedIRS)` — 2 txs, any investor count.
  "Whitelist custom" registers selected investors into the token's own registry.
- **One wallet plays all roles.** Onboarding the connected wallet itself must use
  `createIdentity` (not `createIdentityWithManagementKeys`, which forbids listing
  the wallet as its own manager) — `onboardInvestor` already branches on this.
- Deployment addresses persist in **localStorage** per chainId (the dApp analog
  of `deployments/<network>.json`), via `useDeployment`.
- Validate the frontend with `cd platform && npm run build` (type-checks + static
  export). Validate the *logic* with `npm run platform:e2e` (root, on localhost).

## When you change things

- Editing scripts or constants → keep the README's "Running the PoC" and
  "Design notes" sections accurate.
- Adding a contract to deploy → add its FQN to `scripts/lib/contracts.js`, its
  `import` to `contracts/Dependencies.sol`, then run `npm run export:artifacts`
  so the platform frontend can deploy it too.
- Adding compliance behavior → deploy a module and bind it via
  `ModularCompliance`; document it as an experiment in the README.
- Always re‑run the local‑node validation above before declaring success. For
  platform changes, run `npm run platform:e2e` and `cd platform && npm run build`.
