# ASSR — Autonomous Sports-Signal Strategy Runtime

Verifiable, on-chain infrastructure for running autonomous trading strategies driven by live sports oracle data on Solana. ASSR ingests TxLINE's cryptographically signed sports data, evaluates pluggable trading strategies against it, routes position decisions toward Drift/Jupiter, and writes every decision plus the source data's cryptographic hash to Solana — producing an immutable, auditable execution trail.

Built for the TxODDS World Cup Hackathon (Trading Tools & Agents track).

## How it works

1. **Ingestion** — a poller reads TxLINE's REST API (fixtures, odds, scores) and publishes raw events onto a Kafka topic.
2. **Signal processing** — a strategy engine consumes those events, runs a set of pluggable strategies (value-bet detection, odds-momentum detection, ...) against them, and applies risk controls (position sizing, drawdown circuit breaker, stale-data checks).
3. **On-chain proof** — every signal that crosses a strategy's threshold is logged on Solana via an Anchor program, referencing a hash of the exact TxLINE payload that triggered it.
4. **Execution** — a TypeScript client turns qualifying signals into Drift/Jupiter orders (paper-trading in this version; see roadmap).
5. **Observability** — a REST/WebSocket API and a small dashboard expose live signals, on-chain performance, and historical backtests.

## Repository layout

```
programs/assr_v1/          Anchor program (Rust) — on-chain state and instructions
services/signal-engine/    Signal processing engine — ingestion, strategies, risk manager, API
services/execution-client/ TypeScript execution client — Drift/Jupiter/Jito integration
apps/dashboard/             Dashboard (Next.js)
db/migrations/              Database schema
infra/                       Local development infrastructure (Docker Compose)
migrations/                  Anchor deploy script
tests/                       Anchor program tests
```

## Prerequisites

- JDK 21, Maven/Gradle
- Node.js 20+
- Docker Desktop
- Rust, Solana CLI, Anchor CLI (Anchor's CLI requires a Linux environment — use WSL2 on Windows)
- A TxLINE developer account (free World Cup tier)

## Getting started

```bash
# local infra (Kafka + database)
docker compose -f infra/docker-compose.yml up -d

# Anchor program
anchor build
anchor deploy --provider.cluster devnet

# Anchor tests
anchor test
```

Per-service setup instructions live in each service's own directory.

## Deployment

See [docs/deployment.md](docs/deployment.md) for deploying the backend (Kafka, signal-engine, execution-client) and dashboard to the cloud.

## Status

Early development — see the roadmap for what's implemented versus planned.
