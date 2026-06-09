const { network } = require("hardhat");

/**
 * Hardhat has two distinct "local" network modes that look similar but behave
 * very differently:
 *
 *  "hardhat"   — the default ephemeral in-process network. Every `hardhat run`
 *                invocation starts a BRAND-NEW empty chain. Contracts deployed
 *                in step 1 are GONE by the time step 2 runs. The saved
 *                deployments/hardhat.json addresses point to the wrong contracts
 *                on each fresh chain, causing silent misbehaviour or reverts.
 *
 *  "localhost" — connects to an already-running `npx hardhat node` process on
 *                127.0.0.1:8545. The chain is persistent across script runs, so
 *                the four-step deployment flow works correctly.
 *
 * This guard aborts with a clear message when a multi-step script is invoked on
 * the ephemeral network, preventing the confusing "wrong contract at address"
 * failures that otherwise occur.
 */
function requirePersistentNetwork() {
  if (network.name === "hardhat") {
    console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ERROR: running on the ephemeral "hardhat" network           ║
╠══════════════════════════════════════════════════════════════╣
║  Each "npx hardhat run" without --network starts a fresh     ║
║  empty chain. Contracts from a previous step are gone, so    ║
║  the multi-step deployment flow cannot work.                 ║
║                                                              ║
║  For LOCAL testing:                                          ║
║    Terminal 1:  npx hardhat node                             ║
║    Terminal 2:  npm run local:onchainid                      ║
║                 npm run local:token                          ║
║                 npm run local:investor                       ║
║                 npm run local:transfer                       ║
║                                                              ║
║  For Sepolia:                                                ║
║    npm run deploy:onchainid  (needs funded key in .env)      ║
║    npm run deploy:token                                      ║
║    npm run register:investor                                 ║
║    npm run test:transfer                                     ║
╚══════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }
}

module.exports = { requirePersistentNetwork };
