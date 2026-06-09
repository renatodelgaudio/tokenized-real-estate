import type { PlatformDeployment } from "@/lib/deployments";

/**
 * Published (shared) platform deployments, keyed by chainId.
 *
 * WHY THIS EXISTS
 * ---------------
 * When an Admin deploys the infrastructure, the resulting addresses are saved
 * only in *their* browser's localStorage. That is fine for the person driving
 * the deployment, but a different visitor (e.g. someone you share the public
 * URL with) has no way to know the contract addresses — so the Explorer would
 * have nothing to read.
 *
 * To make the app work for everyone, the operator does this once after
 * deploying on a network:
 *   1. Admin tab → "Copy deployment JSON".
 *   2. Paste it below, keyed by its chainId (11155111 = Sepolia, 31337 = local).
 *   3. Commit & rebuild. Now any visitor sees that deployment with no wallet
 *      and no localStorage of their own.
 *
 * Resolution order (see hooks/useDeployment.ts):
 *   localStorage (the operator's own session)  →  PUBLISHED (this file)
 *
 * Reads (Explorer, balances, verification status) need NO wallet — they go
 * through the configured RPC for the deployment's chainId. Writes (Admin/KYC/
 * Issuer actions) still require a connected wallet.
 */
export const PUBLISHED: Record<number, PlatformDeployment | undefined> = {
  // Example — paste a real deployment to enable the public Sepolia explorer:
  //
  // 11155111: {
  //   chainId: 11155111,
  //   identityImplementation: "0x…",
  //   oidImplementationAuthority: "0x…",
  //   idFactory: "0x…",
  //   claimIssuer: "0x…",
  //   trexImplementationAuthority: "0x…",
  //   trexFactory: "0x…",
  //   iaFactory: "0x…",
  //   sharedIRS: "0x…",
  //   sharedCTR: "0x…",
  //   sharedTIR: "0x…",
  //   sharedIR: "0x…",
  //   platformRegistry: "0x…",
  //   deployedAt: "2026-01-01T00:00:00.000Z",
  // },

  
  "chainId": 11155111,
  "deployedAt": "2026-06-09T13:24:23.716Z",
  "artifactFingerprint": "60a0604052348015_60a0604052348015",
  "identityImplementation": "0xf35e38f901fad0a4e2242d90cd5af70db46fceaf",
  "oidImplementationAuthority": "0xc48e2ef6e6091bb554a543878c824f539c77ba59",
  "idFactory": "0x3673b26d468a4cab4e4bb0ad394e35486db71b33",
  "claimIssuer": "0xaec0de9eb6c63b5609ed970ae816039da5f2b953",
  "trexImplementationAuthority": "0xf5fc931ce4fc33664c89c3bdb54bbdd3d8786f1c",
  "trexFactory": "0x6b03ea64fb8db006136ddb2a311722771b445ab0",
  "iaFactory": "0x33f213efc7b928430aa7f47cc046440fe106dbe9",
  "sharedIRS": "0xaba0e456947066e41ff15979ecdd1e24d3850ee9",
  "sharedCTR": "0x98c9031032c4c9b024467a5895c1acda89777394",
  "sharedTIR": "0x012677501b5d604cd2989aaa85906ef97490fc97",
  "sharedIR": "0x2a48256e1d523128ca6cef16b85a9e79c30a4a57",
  "platformRegistry": "0xf51c6414378381a9169155289f32c5dad95871fd"

};



