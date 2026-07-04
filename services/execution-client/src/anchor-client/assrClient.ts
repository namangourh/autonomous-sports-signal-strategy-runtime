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

function signalTypeToU8(signalType: StrategySignal["signalType"]): number {
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
 * Logs a StrategySignal on-chain. `signalSeq` reuses the source event's
 * timestampMillis (see docs/oracle-hash-spec.md and the Rust doc-comment on
 * log_signal) so it's unique per (agent, fixture) without extra state.
 *
 * TODO(Day 5): size_usdc/execution_price are fixed placeholders — replace
 * with real Kelly sizing (src/risk/kellySizing.ts) and a paper/real fill
 * price once the execution layer exists.
 */
export async function logSignalOnChain(
  program: anchor.Program,
  authority: Keypair,
  signal: StrategySignal,
): Promise<string> {
  const agentConfig = agentConfigPda(program.programId, authority.publicKey);
  const signalSeq = new anchor.BN(signal.timestampMillis);
  const [signalLog] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("signal"),
      authority.publicKey.toBuffer(),
      Buffer.from(signal.fixtureId),
      signalSeq.toArrayLike(Buffer, "le", 8),
    ],
    program.programId,
  );

  const sizeUsdc = new anchor.BN(10_000_000);
  const executionPrice = new anchor.BN(0);
  const oracleHash = Array.from(Buffer.from(signal.oracleHash, "hex"));

  return program.methods
    .logSignal(
      signal.fixtureId,
      signalSeq,
      signalTypeToU8(signal.signalType),
      signal.direction,
      sizeUsdc,
      oracleHash,
      executionPrice,
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
}
