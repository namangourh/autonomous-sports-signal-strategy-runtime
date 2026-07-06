import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { StrategySignal } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDL_PATH = path.resolve(__dirname, "../../../../target/idl/assr_v1.json");

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(homedir(), p.slice(1)) : p;
}

function loadWalletKeypair(): Keypair {
  const keypairPath = expandHome(process.env.SOLANA_WALLET_KEYPAIR_PATH ?? "~/.config/solana/id.json");
  const secret = JSON.parse(readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function getAssrProgram() {
  const idl = JSON.parse(readFileSync(IDL_PATH, "utf8"));
  const authority = loadWalletKeypair();
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(authority);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);
  return { program, authority };
}

function agentConfigPda(programId: PublicKey, authority: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("agent"), authority.toBuffer()], programId)[0];
}

function performancePda(programId: PublicKey, authority: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("perf"), authority.toBuffer()], programId)[0];
}

export interface AgentConfigView {
  active: boolean;
  maxPosUsdc: number;
  maxDrawdownBps: number;
}

export async function fetchAgentConfig(program: anchor.Program, authority: Keypair): Promise<AgentConfigView> {
  const agentConfig = agentConfigPda(program.programId, authority.publicKey);
  const account = await (program.account as any).agentConfig.fetch(agentConfig);
  return {
    active: account.active,
    maxPosUsdc: (account.riskParams.maxPosUsdc as anchor.BN).toNumber(),
    maxDrawdownBps: account.riskParams.maxDrawdownBps,
  };
}

/** Idempotent: if this authority already has an AgentConfig on-chain, does nothing. */
export async function ensureAgentInitialized(program: anchor.Program, authority: Keypair): Promise<void> {
  const agentConfig = agentConfigPda(program.programId, authority.publicKey);
  const existing = await program.provider.connection.getAccountInfo(agentConfig);
  if (existing) {
    console.log("agent already initialized:", agentConfig.toBase58());
    return;
  }

  const performance = performancePda(program.programId, authority.publicKey);
  console.log("initializing agent:", agentConfig.toBase58());
  await program.methods
    .initializeAgent(new anchor.BN(1), {
      maxPosUsdc: new anchor.BN(100_000_000),
      maxDrawdownBps: 2_000,
    })
    .accounts({
      authority: authority.publicKey,
      agentConfig,
      performance,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
}

export function signalTypeToU8(signalType: StrategySignal["signalType"]): number {
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
 * Different strategies can both fire on the very same raw event, sharing
 * fixtureId and timestampMillis — using timestampMillis alone as signal_seq
 * would make their SignalLog PDAs collide (same agent + fixture + seq), so
 * the second log_signal call would fail. Folding in the signal-type code
 * (1-9, same numbering as the on-chain signal_type byte) disambiguates them
 * while staying roughly time-ordered. Mirrored in apps/dashboard/lib/solana.ts
 * for PDA derivation there — keep both in sync if this changes.
 */
export function signalSeqFor(timestampMillis: number, signalType: StrategySignal["signalType"]): anchor.BN {
  return new anchor.BN(timestampMillis).muln(10).addn(signalTypeToU8(signalType));
}

export async function emergencyPauseOnChain(program: anchor.Program, authority: Keypair): Promise<string> {
  const agentConfig = agentConfigPda(program.programId, authority.publicKey);
  return program.methods
    .emergencyPause()
    .accounts({
      authority: authority.publicKey,
      agentConfig,
    })
    .signers([authority])
    .rpc();
}

/**
 * Logs a StrategySignal on-chain. `signalSeq` is derived from the source
 * event's timestampMillis plus the signal-type code (see signalSeqFor) so
 * it's unique per (agent, fixture, strategy) without extra state.
 *
 * `sizeUsdcMicros` and `executionPriceMicros` are the caller's job to
 * compute (Kelly sizing + a paper/real fill price) — this function is just
 * the on-chain wrapper.
 */
export async function logSignalOnChain(
  program: anchor.Program,
  authority: Keypair,
  signal: StrategySignal,
  sizeUsdcMicros: number,
  executionPriceMicros: number,
): Promise<{ signature: string; signalLogPda: string }> {
  const agentConfig = agentConfigPda(program.programId, authority.publicKey);
  const signalSeq = signalSeqFor(signal.timestampMillis, signal.signalType);
  const [signalLog] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("signal"),
      authority.publicKey.toBuffer(),
      Buffer.from(signal.fixtureId),
      signalSeq.toArrayLike(Buffer, "le", 8),
    ],
    program.programId,
  );

  const oracleHash = Array.from(Buffer.from(signal.oracleHash, "hex"));

  const signature = await program.methods
    .logSignal(
      signal.fixtureId,
      signalSeq,
      signalTypeToU8(signal.signalType),
      signal.direction,
      new anchor.BN(Math.round(sizeUsdcMicros)),
      oracleHash,
      new anchor.BN(Math.round(executionPriceMicros)),
      PublicKey.default,
    )
    .accounts({
      authority: authority.publicKey,
      agentConfig,
      signalLog,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return { signature, signalLogPda: signalLog.toBase58() };
}
