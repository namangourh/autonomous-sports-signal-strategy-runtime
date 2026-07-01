import { createHash } from "node:crypto";

/**
 * Reference TypeScript implementation of the oracle_hash canonical spec
 * (docs/oracle-hash-spec.md). Must stay byte-identical to
 * services/signal-engine's OracleHashUtil for the same inputs — see that
 * spec doc before changing this.
 */
export function computeOracleHash(
  fixtureId: string,
  rawPayloadBytes: Buffer,
  timestampMillis: number,
): string {
  const delimiter = Buffer.from("|", "utf8");
  const hash = createHash("sha256");
  hash.update(Buffer.from(fixtureId, "utf8"));
  hash.update(delimiter);
  hash.update(rawPayloadBytes);
  hash.update(delimiter);
  hash.update(Buffer.from(String(timestampMillis), "utf8"));
  return hash.digest("hex");
}
