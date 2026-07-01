import { describe, expect, it } from "vitest";
import { computeOracleHash } from "./oracleHash.js";

describe("computeOracleHash", () => {
  /**
   * Cross-language conformance vector — the Java equivalent lives at
   * services/signal-engine/src/test/java/.../OracleHashUtilTest.java. Both
   * MUST assert the same expectedHash for these inputs (see
   * docs/oracle-hash-spec.md). If you change the canonical format, update
   * both tests together.
   */
  it("matches the cross-language conformance vector", () => {
    const fixtureId = "wc2026-fixture-001";
    const rawPayload = Buffer.from('{"home":1.85,"draw":3.40,"away":4.20}', "utf8");
    const timestampMillis = 1751328000000;
    const expectedHash = "07412353647fd859890792dddc12b7db547ae1bddba93d79841b7214853cba38";

    const actual = computeOracleHash(fixtureId, rawPayload, timestampMillis);

    expect(actual).toBe(expectedHash);
  });
});
