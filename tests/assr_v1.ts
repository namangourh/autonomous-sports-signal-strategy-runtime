import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { assert } from "chai";
import { AssrV1 } from "../target/types/assr_v1";

describe("assr_v1", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.assrV1 as Program<AssrV1>;
  const authority = (program.provider as anchor.AnchorProvider).wallet;

  const [agentConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), authority.publicKey.toBuffer()],
    program.programId,
  );
  const [performancePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("perf"), authority.publicKey.toBuffer()],
    program.programId,
  );

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

  it("logs a signal referencing an oracle_hash", async () => {
    const fixtureId = "wc2026-fixture-001";
    const signalSeq = new anchor.BN(Date.now());
    const timestampMillis = Date.now();
    const rawPayload = Buffer.from('{"home":1.85,"draw":3.40,"away":4.20}', "utf8");

    // Same canonical format as docs/oracle-hash-spec.md.
    const hash = createHash("sha256");
    hash.update(Buffer.from(fixtureId, "utf8"));
    hash.update(Buffer.from("|", "utf8"));
    hash.update(rawPayload);
    hash.update(Buffer.from("|", "utf8"));
    hash.update(Buffer.from(String(timestampMillis), "utf8"));
    const oracleHash = Array.from(hash.digest());

    const [signalLogPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("signal"),
        authority.publicKey.toBuffer(),
        Buffer.from(fixtureId),
        signalSeq.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

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
      .rpc();

    const signalLog = await program.account.signalLog.fetch(signalLogPda);
    assert.equal(signalLog.fixtureId, fixtureId);
    assert.equal(signalLog.direction, 1);
    assert.equal(signalLog.sizeUsdc.toNumber(), 50_000_000);
    assert.deepEqual(Array.from(signalLog.oracleHash as unknown as number[]), oracleHash);
  });
});
