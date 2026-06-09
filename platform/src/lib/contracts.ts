import type { Abi } from "viem";
import artifacts from "@/contracts/artifacts.json";

/**
 * Typed access to the compiled ABIs + bytecode exported by the Hardhat project
 * (scripts/export_artifacts.js → src/contracts/artifacts.json).
 *
 * Proxy contracts are deployed using the *Proxy* artifact's bytecode, but
 * interacted with using the corresponding *implementation* ABI (because all
 * calls delegate to the implementation). The helpers below expose both.
 */
type Artifact = { abi: Abi; bytecode: `0x${string}` };
const bundle = artifacts as unknown as Record<string, Artifact>;

export type ContractName = keyof typeof artifacts;

export function getAbi(name: ContractName): Abi {
  return bundle[name].abi;
}

export function getBytecode(name: ContractName): `0x${string}` {
  return bundle[name].bytecode;
}
