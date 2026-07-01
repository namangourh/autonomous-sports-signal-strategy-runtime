CREATE TABLE matches (
    fixture_id       VARCHAR2(64) PRIMARY KEY,
    home_team        VARCHAR2(128) NOT NULL,
    away_team        VARCHAR2(128) NOT NULL,
    kickoff_at       TIMESTAMP NOT NULL,
    status           VARCHAR2(32) NOT NULL,
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE TABLE odds_snapshots (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fixture_id       VARCHAR2(64) NOT NULL REFERENCES matches(fixture_id),
    book             VARCHAR2(64) NOT NULL,
    market           VARCHAR2(64) NOT NULL,
    home_odds        NUMBER(10,4),
    draw_odds        NUMBER(10,4),
    away_odds        NUMBER(10,4),
    raw_payload      CLOB NOT NULL,
    txline_signature CLOB NOT NULL,
    oracle_hash      VARCHAR2(64) NOT NULL,
    snapshot_at      TIMESTAMP NOT NULL,
    ingested_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_odds_fixture ON odds_snapshots(fixture_id, snapshot_at);

CREATE TABLE score_events (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fixture_id       VARCHAR2(64) NOT NULL REFERENCES matches(fixture_id),
    event_type       VARCHAR2(32) NOT NULL,
    minute           NUMBER(3),
    home_score       NUMBER(3) NOT NULL,
    away_score       NUMBER(3) NOT NULL,
    raw_payload      CLOB NOT NULL,
    oracle_hash      VARCHAR2(64) NOT NULL,
    event_at         TIMESTAMP NOT NULL,
    ingested_at      TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX idx_score_fixture ON score_events(fixture_id, event_at);

CREATE TABLE paper_trades (
    id               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signal_pda       VARCHAR2(64) NOT NULL,
    fixture_id       VARCHAR2(64) NOT NULL,
    strategy_id      VARCHAR2(64) NOT NULL,
    direction        NUMBER(1) NOT NULL,
    size_usdc        NUMBER(18,6) NOT NULL,
    assumed_fill     NUMBER(18,6),
    tx_signature     VARCHAR2(128),
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);
