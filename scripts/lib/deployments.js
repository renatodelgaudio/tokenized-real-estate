const fs = require("fs");
const path = require("path");

/**
 * Tiny helper for persisting deployed contract addresses between scripts.
 *
 * Each network gets its own JSON file under `deployments/<network>.json`, e.g.
 * `deployments/sepolia.json`. Scripts read what previous scripts wrote, so the
 * four-step flow (onchainid -> token -> register -> test) can be run as
 * separate commands without copy-pasting addresses by hand.
 */

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "..", "deployments");

function filePathFor(network) {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

/** Load the saved deployment object for a network (empty object if none yet). */
function load(network) {
  const file = filePathFor(network);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Merge `data` into the saved deployment object and write it back to disk. */
function save(network, data) {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  const merged = { ...load(network), ...data, network, updatedAt: new Date().toISOString() };
  fs.writeFileSync(filePathFor(network), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

/**
 * Load the deployment object and assert that every key in `required` is present.
 * Throws a helpful error telling the user which earlier script to run otherwise.
 */
function require_(network, required, hint) {
  const data = load(network);
  const missing = required.filter((key) => !data[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing deployment value(s) [${missing.join(", ")}] for network "${network}".` +
        (hint ? `\n   → ${hint}` : "")
    );
  }
  return data;
}

module.exports = { load, save, require: require_, filePathFor };
