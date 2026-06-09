require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/**
 * Hardhat configuration for the Tokenized Real Estate (ERC-3643 / T-REX) PoC.
 *
 * The Solidity version is pinned to 0.8.17 because that is the exact compiler
 * version used by the @tokenysolutions/t-rex (v4.1.6) and @onchain-id/solidity
 * (v2.2.1) contracts that we compile from source. Using a different version
 * would fail to match their `pragma solidity 0.8.17;` directives.
 *
 * The optimizer (runs: 200) is required: several T-REX implementation
 * contracts (notably the Token) are large and must stay under the 24 KB
 * EIP-170 contract-size limit to be deployable on a real network like Sepolia.
 */

const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

// Only register the deployer account if a key is present, so that read-only
// commands (e.g. `hardhat compile`) work without a configured `.env`.
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // The local in-process network, handy for `hardhat compile` and quick checks.
    hardhat: {},

    // The one and only target for this PoC: the Sepolia testnet.
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts,
      chainId: 11155111,
    },
  },
};
