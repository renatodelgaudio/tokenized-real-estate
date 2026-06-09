/**
 * ============================================================================
 * Export compiled ABIs + bytecode for the web platform
 * ============================================================================
 *
 * The browser app deploys and calls the same contracts the scripts use, so it
 * needs their ABI (to encode calls) and bytecode (to deploy). This script reads
 * the Hardhat-compiled artifacts and writes a single JSON bundle the frontend
 * imports.
 *
 * Run with:  npm run export:artifacts   (or: node ... via hardhat run)
 *
 * Output:    platform/src/contracts/artifacts.json
 * ============================================================================
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const FQN = require("./lib/contracts");

const OUT_DIR = path.join(__dirname, "..", "platform", "src", "contracts");
const OUT_FILE = path.join(OUT_DIR, "artifacts.json");

async function main() {
  const bundle = {};
  for (const [name, fqn] of Object.entries(FQN)) {
    const artifact = await hre.artifacts.readArtifact(fqn);
    bundle[name] = {
      abi: artifact.abi,
      bytecode: artifact.bytecode, // "0x..." creation bytecode (for deployment)
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(bundle, null, 2)}\n`);

  const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
  console.log(`✓ Exported ${Object.keys(bundle).length} contract artifacts to`);
  console.log(`  ${path.relative(process.cwd(), OUT_FILE)} (${sizeKb} KB)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
