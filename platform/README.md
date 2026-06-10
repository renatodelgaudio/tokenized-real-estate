# Tokenized Real Estate — Platform PoC (web app)

A static single-page dApp that demonstrates a **multi-tenant ERC-3643 (T-REX)
tokenization platform**. It puts a face on the contracts deployed by the parent
Hardhat project, showing the distinct roles that make up a **non-custodial**
platform like [Tokeny](https://tokeny.com/) or [Backed Finance](https://backed.fi/).

> [!NOTE]
> **Non-custodial means the platform never holds your keys.** Every action is a
> transaction signed directly by the user's own wallet (MetaMask). This is the
> model used by most on-chain RWA platforms (see [rwa.xyz](https://rwa.xyz) for
> examples). It is **different** from custodial infrastructure providers such as
> [Taurus](https://www.taurushq.com/) or [Fireblocks](https://www.fireblocks.com/),
> where the platform manages private keys on behalf of clients and investors
> interact through platform accounts rather than self-custody wallets.

> [!WARNING]
> Learning proof of concept. Testnet only. No real asset, no value. One
> connected wallet plays every role for simplicity.

---

## The four roles (tabs)

| Tab | Real-world actor | What you can do |
|-----|------------------|-----------------|
| 🔧 **Admin** | Platform operator | Deploy the shared infrastructure once per network (OnchainID layer, T-REX implementations + factories, a **shared** identity registry, and the `PlatformRegistry` index). Each contract deploys one-by-one with live progress. |
| 🪪 **KYC Service** | Identity provider (e.g. Onfido) | Onboard an **entity** (one OnchainID + one KYC claim), then **link additional wallets** to it with no repeat KYC. Done once per entity for the whole platform. |
| 🏢 **Issuer** | Asset owner (e.g. Meridian Capital) | Deploy a security token, choose a KYC policy (**whitelist all** vs **whitelist custom**), then unpause, mint and transfer. |
| 📊 **Explorer** | Anyone | Read-only overview of all tokens and the shared investor base. **No wallet required** (reads go through the RPC). |

### Entities, wallets, and privacy

KYC is performed **once per entity** (a person or company), producing **one
OnchainID identity** that carries the KYC claim. An entity can then **link
several wallets** (hot, cold, treasury) to that same identity — every linked
wallet is automatically verified, with no repeat KYC.

```
   ENTITY "Alice"  ──►  ONE identity (KYC claim here)
                          ├── wallet A (hot)
                          ├── wallet B (cold)
                          └── wallet C (treasury)
```

**Privacy:** real identity data (names, passports) is **never stored on-chain** —
that would violate GDPR and the ERC-3643 design, where the chain holds only the
signed *claim*. In production the KYC provider keeps PII off-chain in its own
database. This PoC simulates that with a browser-local label store
(`src/lib/labels.ts`); the friendly names you type are stored **only in your
browser**, never on-chain.

### The two KYC policies (the interesting part)

- **Whitelist all** — the token's registry is rebound to the platform's
  **shared `IdentityRegistryStorage`**. Every investor ever onboarded (and every
  future one) is automatically eligible. Costs **2 transactions per token**,
  regardless of how many investors exist.
- **Whitelist custom** — only the investors you select are registered into this
  token's own registry. Costs one transaction per selected investor.

Both mechanisms are validated on-chain by `scripts/platform_e2e.js` in the
parent project.

---

## Architecture

- **No backend.** Every action is a direct blockchain transaction signed by the
  user's wallet. The chain is the database.
- **Static export.** `next build` produces a plain `out/` folder (HTML/CSS/JS) —
  hostable free on Cloudflare Pages, GitHub Pages, Vercel, etc.
- **Stack:** Next.js 15 (App Router, `output: export`), wagmi v2, viem,
  TanStack Query, Tailwind. Wallet via the **injected** connector (MetaMask) —
  no WalletConnect project ID needed.
- **Contract ABIs + bytecode** come from `src/contracts/artifacts.json`, which
  is generated from the Hardhat compilation (see below). The browser deploys and
  calls the exact same contracts the CLI scripts use.

```
platform/
├── src/
│   ├── app/            # Next.js app shell (layout, page, providers)
│   ├── components/     # ConnectBar + the 4 role panels + UI primitives
│   ├── hooks/          # useDeployment, useRegistry
│   ├── lib/            # wagmi config, contract helpers, the on-chain flows
│   └── contracts/      # artifacts.json (generated)
└── next.config.js      # output: 'export'
```

---

## Run it locally

### Option A — against a local Hardhat chain (free, recommended first)

From the **parent project root** (`tokenized-real-estate/`):

```bash
# 1. Compile contracts and export their ABIs+bytecode for the frontend
npm install
npm run compile
npm run export:artifacts          # writes platform/src/contracts/artifacts.json

# 2. Start a local blockchain (leave running in its own terminal)
npx hardhat node
```

Then in the **platform folder**:

```bash
cd platform
npm install
npm run dev                       # http://localhost:3000
```

In the browser:
1. Add the local network to MetaMask (RPC `http://127.0.0.1:8545`, chain id `31337`)
   and import one of the test private keys printed by `hardhat node`.
2. Connect your wallet, select **Localhost (Hardhat)** in the network dropdown.
3. **Admin** → Deploy Platform Infrastructure.
4. **KYC** → onboard a couple of investor addresses (and your own wallet).
5. **Issuer** → deploy a token (try both policies), unpause, mint, transfer.
6. **Explorer** → see it all.

> Restarting `hardhat node` wipes the chain. Use **Admin → Forget deployment**
> (or clear site data) and redeploy.

### Option B — against Sepolia

```bash
cd platform
cp .env.example .env.local
# set NEXT_PUBLIC_SEPOLIA_RPC_URL to your Alchemy/Infura Sepolia URL
npm run dev
```

Connect MetaMask on Sepolia (a funded testnet account — see the parent README's
wallet setup), select **Sepolia**, and use the same Admin → KYC → Issuer flow.
Each deployment costs real testnet gas.

---

## Deploy the website (live at <https://tokenized-real-estate.renatodelgaudio.com/>)

The app is a static export, so hosting is trivial.

```bash
cd platform
npm run build                     # produces ./out
```

**Via the Cloudflare dashboard (no CLI):**
1. Push this repo to GitHub.
2. Cloudflare Pages → Create project → connect the repo.
3. Build settings:
   - **Root directory:** `platform`
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Environment variable:** `NEXT_PUBLIC_SEPOLIA_RPC_URL` = your RPC URL
4. Deploy. You get a `*.pages.dev` URL.

**Via Wrangler CLI:**
```bash
npm install -g wrangler
wrangler pages deploy out --project-name tokenized-real-estate
```

> Note: `artifacts.json` must exist before building. If you cloned fresh, run
> `npm run compile && npm run export:artifacts` in the parent project first. On
> Cloudflare, either commit `artifacts.json` (it is not git-ignored) or add the
> export step to the build command.

---

## Making the Explorer public (sharing a deployment)

When you deploy via the **Admin** tab, the addresses are saved only in *your*
browser's localStorage. Another visitor (or the public Explorer) has no way to
know them. To share a deployment so anyone can view it with no wallet:

1. **Admin** tab → **Copy deployment JSON**.
2. Paste it into [`src/config/published.ts`](src/config/published.ts), keyed by
   its chainId (`11155111` = Sepolia, `31337` = local).
3. Commit and rebuild/redeploy.

Now the app resolves addresses as **localStorage → published config**, so:
- the operator keeps using their own session, and
- everyone else (and the Explorer, with no wallet) sees the published platform.

Reads (Explorer, balances, verification) never need a wallet — they go through
the RPC for the selected network. Only writes (Admin/KYC/Issuer) need one.

## Regenerating contract artifacts

If you change any Solidity (e.g. `PlatformRegistry.sol`), refresh the bundle the
frontend deploys:

```bash
# from the parent project root
npm run compile
npm run export:artifacts
```
