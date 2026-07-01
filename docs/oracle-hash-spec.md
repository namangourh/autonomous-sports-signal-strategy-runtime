# oracle_hash canonical spec

`oracle_hash` links an on-chain `SignalLog` entry back to the exact TxLINE payload that produced it. Both the signal engine (Java) and the execution client (TypeScript) must be able to compute this hash independently and get an identical result, so a third party can verify a signal against the original TxLINE data without trusting either service.

## Definition

```
oracle_hash = hex(SHA-256(fixture_id_bytes ++ 0x7C ++ raw_payload_bytes ++ 0x7C ++ timestamp_bytes))
```

Where:

- `fixture_id_bytes` — the TxLINE fixture ID, UTF-8 encoded, exactly as returned by the API (no trimming/casing changes).
- `0x7C` — a single literal `|` byte, used as a delimiter on both sides of the payload.
- `raw_payload_bytes` — the **exact raw bytes** of the relevant TxLINE response body (or sub-object) as received over the wire. This must be the untouched byte sequence — not a value re-serialized from a parsed object — because JSON key ordering and number formatting are not guaranteed identical across a Java JSON library and a TypeScript one.
- `timestamp_bytes` — the snapshot/event epoch-millis timestamp (as supplied by TxLINE, or ingestion time if TxLINE doesn't supply one — see below), formatted as its base-10 ASCII string, UTF-8 encoded (e.g. `1751328000000`).

Concatenation is byte concatenation, not string concatenation with implicit re-encoding — decode to bytes first if the host language's string type isn't already UTF-8 bytes.

## Why raw bytes, not a reconstructed object

If each side reconstructs its own JSON representation of the odds/score snapshot before hashing, differences in key order, number precision, or whitespace will silently produce different hashes. Hashing the untouched wire bytes sidesteps this entirely. Practical implication: the ingestion layer must persist/forward the raw payload bytes (or a byte-identical copy, e.g. base64) alongside the parsed fields — not just the parsed fields.

## Conformance test

Before either side is trusted, run the same `(fixture_id, raw_payload, timestamp)` triple through both implementations and assert the hex digests are byte-identical. See `services/signal-engine` (`OracleHashUtil`) and `services/execution-client` (`oracleHash.ts`) for the reference implementations.
