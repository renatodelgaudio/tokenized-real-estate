import { createConfig, http } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Two supported networks:
 *   - hardhat  (chainId 31337) : a local `npx hardhat node` for free testing.
 *   - sepolia  (chainId 11155111) : the public testnet.
 *
 * The Sepolia RPC URL is read from NEXT_PUBLIC_SEPOLIA_RPC_URL at build time
 * (inlined into the static bundle). If absent, wagmi falls back to a public
 * endpoint, which is fine for light read/write but may rate-limit.
 */
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  // `multiInjectedProviderDiscovery` (EIP-6963, on by default) makes EVERY
  // installed browser wallet (MetaMask, Core, Rabby, …) show up as its own
  // connector, so the UI can offer a wallet picker instead of silently using
  // whichever extension grabbed `window.ethereum`. We keep a generic `injected`
  // connector as a fallback for wallets that don't announce themselves.
  multiInjectedProviderDiscovery: true,
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(sepoliaRpc || undefined),
  },
  ssr: false,
});

export const SUPPORTED_CHAINS = {
  [hardhat.id]: { name: "Localhost (Hardhat)", explorer: "" },
  [sepolia.id]: { name: "Sepolia", explorer: "https://sepolia.etherscan.io" },
} as const;

export function explorerAddressUrl(chainId: number, address: string): string {
  const base = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]?.explorer;
  return base ? `${base}/address/${address}` : "";
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const base = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS]?.explorer;
  return base ? `${base}/tx/${hash}` : "";
}
