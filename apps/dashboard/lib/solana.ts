import { PublicKey } from "@solana/web3.js";

/**
 * Server-side only: PDA derivation needs Node's Buffer, which isn't reliably
 * available in the browser without extra polyfill config. Keep this out of
 * client components — page.tsx (a Server Component) computes these and
 * passes plain strings down.
 */

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ASSR_PROGRAM_ID ?? "2QwzfNdZx8DGbeu6VbSzcn9jaNidstZbC2XRL8Vy9ZrB",
);
const EXPLORER_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export function derivePerformancePda(agent: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("perf"), agent.toBuffer()], PROGRAM_ID)[0];
}

export function deriveAgentConfigPda(agent: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("agent"), agent.toBuffer()], PROGRAM_ID)[0];
}

/** Mirrors services/execution-client/src/anchor-client/assrClient.ts's signalTypeToU8 — keep in sync. */
function signalTypeToU8(signalType: string): number {
  switch (signalType) {
    case "VALUE_BET":
      return 1;
    case "MOMENTUM":
      return 2;
    case "GOAL_IMPACT":
      return 3;
    default:
      throw new Error(`unknown signal type: ${signalType}`);
  }
}

/**
 * Mirrors the execution client's signalSeqFor: timestampMillis*10 + signal-type
 * code, so two strategies firing on the same event (same fixtureId + timestamp)
 * derive different PDAs instead of colliding. Keep both in sync if this changes.
 */
export function deriveSignalLogPda(
  agent: PublicKey,
  fixtureId: string,
  timestampMillis: number,
  signalType: string,
): PublicKey {
  const signalSeq = BigInt(timestampMillis) * BigInt(10) + BigInt(signalTypeToU8(signalType));
  const seqBuf = Buffer.alloc(8);
  seqBuf.writeBigUInt64LE(signalSeq);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("signal"), agent.toBuffer(), Buffer.from(fixtureId), seqBuf],
    PROGRAM_ID,
  )[0];
}

export function explorerAddressUrl(address: PublicKey | string): string {
  return `https://explorer.solana.com/address/${address.toString()}?cluster=${EXPLORER_CLUSTER}`;
}
