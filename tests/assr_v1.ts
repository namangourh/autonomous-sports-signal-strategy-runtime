import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { assert } from "chai";
import { AssrV1 } from "../target/types/assr_v1";

describe("assr_v1", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.assrV1 as Program<AssrV1>;
  const provider = program.provider as anchor.AnchorProvider;

  // A fresh throwaway keypair per test run — agent_config/performance PDAs
  // derive from this authority, and emergency_pause is a one-way kill
  // switch, so reusing a persistent identity would make this suite fail on
  // any second run (already-initialized / already-paused).
  const authority = anchor.web3.Keypair.generate();

  const [agentConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), authority.publicKey.toBuffer()],
    program.programId,
  );
  const [performancePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("perf"), authority.publicKey.toBuffer()],
    program.programId,
  );

  before(async () => {
    // Fund the throwaway authority from the provider's own (already-funded)
    // devnet wallet rather than the devnet faucet, which is flaky/rate-limited.
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: authority.publicKey,
        lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(transferTx);
  });

  it("initializes an agent and its performance record", async () => {
    await program.methods
      .initializeAgent(new anchor.BN(1), {
        maxPosUsdc: new anchor.BN(1_000_000),
        maxDrawdownBps: 500,
      })
      .accounts({
        authority: authority.publicKey,
        agentConfig: agentConfigPda,
        performance: performancePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const agentConfig = await program.account.agentConfig.fetch(agentConfigPda);
    assert.equal(agentConfig.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(agentConfig.strategyId.toNumber(), 1);
    assert.equal(agentConfig.active, true);
    assert.equal(agentConfig.riskParams.maxPosUsdc.toNumber(), 1_000_000);

    const performance = await program.account.performancePda.fetch(performancePda);
    assert.equal(performance.totalSignals.toNumber(), 0);
    assert.equal(performance.cumulativePnlUsdc.toNumber(), 0);
  });

  function deriveSignalLogPda(fixtureId: string, signalSeq: anchor.BN) {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("signal"),
        authority.publicKey.toBuffer(),
        Buffer.from(fixtureId),
        signalSeq.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    )[0];
  }

  async function logSignal(fixtureId: string, signalSeq: anchor.BN) {
    const timestampMillis = signalSeq.toNumber();
    const rawPayload = Buffer.from('{"home":1.85,"draw":3.40,"away":4.20}', "utf8");

    // Same canonical format as docs/oracle-hash-spec.md.
    const hash = createHash("sha256");
    hash.update(Buffer.from(fixtureId, "utf8"));
    hash.update(Buffer.from("|", "utf8"));
    hash.update(rawPayload);
    hash.update(Buffer.from("|", "utf8"));
    hash.update(Buffer.from(String(timestampMillis), "utf8"));
    const oracleHash = Array.from(hash.digest());

    const signalLogPda = deriveSignalLogPda(fixtureId, signalSeq);

    await program.methods
      .logSignal(
        fixtureId,
        signalSeq,
        1,
        1,
        new anchor.BN(50_000_000),
        oracleHash,
        new anchor.BN(185),
        anchor.web3.PublicKey.default,
      )
      .accounts({
        authority: authority.publicKey,
        agentConfig: agentConfigPda,
        signalLog: signalLogPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    return { signalLogPda, oracleHash };
  }

  it("logs a signal referencing an oracle_hash", async () => {
    const fixtureId = "wc2026-fixture-001";
    const signalSeq = new anchor.BN(Date.now());

    const { signalLogPda, oracleHash } = await logSignal(fixtureId, signalSeq);

    const signalLog = await program.account.signalLog.fetch(signalLogPda);
    assert.equal(signalLog.fixtureId, fixtureId);
    assert.equal(signalLog.direction, 1);
    assert.equal(signalLog.sizeUsdc.toNumber(), 50_000_000);
    assert.equal(signalLog.settled, false);
    assert.deepEqual(Array.from(signalLog.oracleHash as unknown as number[]), oracleHash);
  });

  it("settles signals' P&L into the performance record, tracking drawdown", async () => {
    // A win first (establishes a peak), then a loss (creates a measurable
    // drawdown off that peak) — a loss-first sequence would divide by a
    // near-zero peak and saturate max_drawdown_bps at u16::MAX, which isn't
    // a meaningful assertion.
    const { signalLogPda: winPda } = await logSignal("wc2026-fixture-002", new anchor.BN(Date.now()));
    await program.methods
      .updatePerformance(new anchor.BN(100_000_000))
      .accounts({
        authority: authority.publicKey,
        agentConfig: agentConfigPda,
        performance: performancePda,
        signalLog: winPda,
      })
      .signers([authority])
      .rpc();

    const { signalLogPda: lossPda } = await logSignal("wc2026-fixture-003", new anchor.BN(Date.now()));
    await program.methods
      .updatePerformance(new anchor.BN(-25_000_000))
      .accounts({
        authority: authority.publicKey,
        agentConfig: agentConfigPda,
        performance: performancePda,
        signalLog: lossPda,
      })
      .signers([authority])
      .rpc();

    const performance = await program.account.performancePda.fetch(performancePda);
    assert.equal(performance.totalSignals.toNumber(), 2);
    assert.equal(performance.cumulativePnlUsdc.toNumber(), 75_000_000);
    assert.equal(performance.winCount.toNumber(), 1);
    assert.equal(performance.lossCount.toNumber(), 1);
    assert.equal(performance.maxDrawdownBps, 2_500); // 25,000,000 / 100,000,000 peak = 25%

    const signalLog = await program.account.signalLog.fetch(lossPda);
    assert.equal(signalLog.settled, true);

    // Settling the same signal twice must fail.
    let failed = false;
    try {
      await program.methods
        .updatePerformance(new anchor.BN(-1))
        .accounts({
          authority: authority.publicKey,
          agentConfig: agentConfigPda,
          performance: performancePda,
          signalLog: lossPda,
        })
        .signers([authority])
        .rpc();
    } catch (err) {
      failed = true;
    }
    assert.isTrue(failed, "expected re-settling an already-settled signal to fail");
  });

  it("pauses the agent and rejects further signals", async () => {
    await program.methods
      .emergencyPause()
      .accounts({
        authority: authority.publicKey,
        agentConfig: agentConfigPda,
      })
      .signers([authority])
      .rpc();

    const agentConfig = await program.account.agentConfig.fetch(agentConfigPda);
    assert.equal(agentConfig.active, false);

    let failed = false;
    try {
      await logSignal("wc2026-fixture-004", new anchor.BN(Date.now()));
    } catch (err) {
      failed = true;
    }
    assert.isTrue(failed, "expected log_signal to fail once the agent is paused");
  });
});
