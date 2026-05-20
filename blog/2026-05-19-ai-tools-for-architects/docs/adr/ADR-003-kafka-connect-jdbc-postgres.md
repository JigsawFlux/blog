# ADR-003: Kafka Connect JDBC Source for PostgreSQL Station Data

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

Station reference data (stop IDs, names, line membership, ordering) is stored in a PostgreSQL
table (`stations`) seeded from a CSV file at container start-up (`load_stations.sql`).  The
consumer side needs this data in Kafka so that stream processors (Faust) can enrich and transform
it alongside real-time event streams.

Two ingestion options were on the table:
1. Write a bespoke Python producer that reads from the database and publishes to Kafka.
2. Use a managed connector that understands JDBC semantics.

---

## Decision

Confluent Kafka Connect with the `JdbcSourceConnector` is used to stream the `stations` table
from PostgreSQL into Kafka automatically.

The connector is configured programmatically at simulation start-up via the Kafka Connect REST API
(`producers/connector.py:16-57`):

| Config key | Value | Rationale |
|------------|-------|-----------|
| `connector.class` | `io.confluent.connect.jdbc.JdbcSourceConnector` | Standard JDBC source |
| `mode` | `incrementing` | Detects new rows via monotonically increasing `stop_id` |
| `incrementing.column.name` | `stop_id` | Primary key / surrogate key for new-row detection |
| `table.whitelist` | `stations` | Scope connector to a single table |
| `topic.prefix` | `com.cta.stations.data.rawt001.` | Output topic = prefix + table name |
| `poll.interval.ms` | `3600000` (1 h) | Station data is quasi-static; hourly polling is sufficient |
| `batch.max.rows` | `500` | Limits per-poll memory footprint |

The connector is idempotent — if it already exists the setup function returns early
(`producers/connector.py:19-22`).

Faust then reads from the output topic `com.cta.stations.data.rawt001.stations`
(`consumers/faust_stream.py:40`).

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Custom Python producer reading from PostgreSQL | More code to maintain; no built-in retry or offset tracking |
| Debezium CDC connector | Overkill for quasi-static reference data; requires PostgreSQL WAL configuration |
| Reading CSV directly in producer | Bypasses the Kafka pipeline; consumers cannot subscribe independently |

---

## Consequences

**Positive**
- Zero custom ingestion code; the connector handles polling, batching, and offset management.
- Decouples the database schema from producer code — schema changes propagate via the connector.
- New consumers of station data subscribe to the Kafka topic without touching the database.

**Negative / Risks**
- `incrementing` mode only detects inserts, not updates or deletes; stale station data will not
  be corrected unless the connector is reset.
- Hard-coded credentials (`cta_admin` / `chicago`) in `connector.py:43-44` must be externalised
  for any non-local environment.
- The connector is registered once at simulation start; a crash before registration completes
  leaves no station data in Kafka.
