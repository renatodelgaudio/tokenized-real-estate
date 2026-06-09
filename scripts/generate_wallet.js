/**
 * Generate a fresh, random Ethereum keypair for use as the testnet deployer.
 *
 * This script deliberately produces a NEW key on every run. The output is
 * intended to be pasted into your `.env` file. The key is ONLY suitable for
 * testnets (Sepolia, Holesky, …) — never use it to custody real funds.
 *
 * Usage:
 *   npm run generate:wallet
 */
const { ethers } = require("ethers");

function separator(char = "─", width = 64) {
  return char.repeat(width);
}

const wallet = ethers.Wallet.createRandom();

console.log("\n" + separator("═"));
console.log("  🔑  New testnet wallet generated");
console.log(separator("═"));
console.log(`
  Address     : ${wallet.address}
  Private key : ${wallet.privateKey}
  Mnemonic    : ${wallet.mnemonic.phrase}
`);
console.log(separator("─"));
console.log(`
  NEXT STEPS
  ──────────
  1. Copy the private key into your .env file:

       DEPLOYER_PRIVATE_KEY="${wallet.privateKey}"

  2. Fund the address on Sepolia — pick any faucet:

       Alchemy     https://sepoliafaucet.com
                   (free after creating an Alchemy account)

       Infura      https://www.infura.io/faucet/sepolia
                   (free after creating an Infura account)

       Google      https://cloud.google.com/application/web3/faucet/ethereum/sepolia
                   (no account needed — gives 0.05 ETH/day)

       QuickNode   https://faucet.quicknode.com/ethereum/sepolia
                   (free, requires QuickNode account)

       PoW faucet  https://sepolia-faucet.pk910.de
                   (no account needed — mine testnet ETH in-browser)

  3. Verify the balance at https://sepolia.etherscan.io/address/${wallet.address}

  4. Run the PoC:

       npm run deploy:onchainid
       npm run deploy:token
       npm run register:investor
       npm run test:transfer
`);
console.log(separator("─"));
console.log(`
  ⚠  SECURITY REMINDERS
  ─────────────────────
  • Keep the .env file out of version control (.gitignore already covers it).
  • This address is for TESTNET ONLY — never send real ETH here.
  • Store the mnemonic safely if you want to recover this key in MetaMask.
  • If you accidentally commit the private key, generate a new one immediately
    and treat the exposed key as compromised (even on testnet, for good habits).
`);
console.log(separator("═") + "\n");
