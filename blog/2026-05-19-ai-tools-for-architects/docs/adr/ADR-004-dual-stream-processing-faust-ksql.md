# ADR-004: Dual Stream-Processing Engines — Faust (Python) + KSQL

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

Two distinct stream-processing requirements exist:

1. **Station enrichment** — raw station rows arriving from the JDBC connector carry boolean
   `red`/`blue`/`green` columns.  A downstream topic is needed that replaces these booleans with
   a single `line` string field and retains only the fields required by the UI model.

2. **Turnstile aggregation** — individual turnstile-entry events must be aggregated into a count
   per station so the dashboard can display a single rider-count per station rather than a
   stream of raw entry records.

These two problems have different shapes: the first is a stateless record-by-record
transformation; the second is a stateful GROUP BY aggregation.

---

## Decision

Two separate stream-processing tools are used, each chosen for its natural fit with one problem:

### Faust — station transformation (`consumers/faust_stream.py`)

Faust is a Python-native stream-processing library.  It is used to:
- Subscribe to `com.cta.stations.data.rawt001.stations`
- Produce `TransformedStation` records to `org.chicago.cta.stations.table.v1t001`
- Maintain an in-memory Faust Table as a materialised view keyed by `station_id`

```python
@app.agent(in_topic)
async def transform_stations(in_stations):
    async for sn in in_stations:
        t = TransformedStation(sn.station_id, sn.station_name, sn.order, "na")
        if sn.red:   t.line = "red"
        elif sn.blue: t.line = "blue"
        elif sn.green: t.line = "green"
        else: continue
        table[sn.station_id] = t
```

### KSQL — turnstile aggregation (`consumers/ksql.py`)

KSQL (now ksqlDB) is used to express a SQL aggregation over the turnstile topic:

```sql
CREATE TABLE turnstile ( ... )
WITH (KAFKA_TOPIC='com.cta.stations.turnstile.entry', VALUE_FORMAT='AVRO', KEY='station_id');

CREATE TABLE TURNSTILE_SUMMARY WITH (VALUE_FORMAT='JSON') AS
    SELECT station_id, count(station_id) as COUNT
    FROM turnstile GROUP BY station_id;
```

The KSQL statement is submitted via the KSQL REST API at consumer start-up and is idempotent —
it is skipped if `TURNSTILE_SUMMARY` already exists.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Kafka Streams (Java) | Project is Python-only; JVM dependency is undesirable |
| Single Faust app for both transformations | Aggregation with Faust Tables is more complex than KSQL GROUP BY; KSQL is more expressive for SQL aggregations |
| Single KSQL for both transformations | KSQL cannot natively run arbitrary Python logic cleanly; Faust keeps the transformation in the same language as the rest of the application |

---

## Consequences

**Positive**
- Each tool is used for its core strength: Faust for Python-idiomatic record transformation,
  KSQL for declarative aggregation.
- The Faust app and KSQL statements are independently deployable and restartable.

**Negative / Risks**
- Two different stream-processing runtimes increase operational surface area (two separate
  processes to start, monitor, and upgrade).
- The Faust Table uses `store="memory://"` — state is lost on restart; the table is rebuilt from
  Kafka on each startup, which adds startup latency.
- KSQL's output (`TURNSTILE_SUMMARY`) uses JSON while all other topics use Avro, creating
  a serialisation inconsistency (see ADR-002).
- The `consumers/server.py` startup guard (`topic_check`) blocks the dashboard if either Faust
  or KSQL has not yet produced its output topic, creating an implicit startup ordering dependency.
