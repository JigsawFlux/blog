# ADR-001: Apache Kafka as the Central Event Bus

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

The CTA (Chicago Transit Authority) public transport optimisation system must ingest and distribute
high-frequency, heterogeneous events from multiple sources:

- Train arrivals at every station on three colour lines (Blue, Red, Green), each carrying 10 trains
- Turnstile entry counts produced per time-step at every station
- Hourly weather readings
- Static station reference data held in a relational database

A naive polling or REST-request-per-event approach would not scale to the volume, would couple
producers tightly to consumers, and would make it difficult to replay or replay events for new
consumers.

---

## Decision

Apache Kafka (Confluent Platform 5.2.2) is used as the single, central event streaming backbone.
All data flows in and out of Kafka topics; no service communicates directly with another.

Evidence from code:

| Source | Topic | Producer mechanism |
|--------|-------|--------------------|
| Train simulation | `org.chicago.cta.station.arrivals.t001` | `confluent_kafka` `AvroProducer` |
| Turnstile simulation | `com.cta.stations.turnstile.entry` | `confluent_kafka` `AvroProducer` |
| Weather simulation | `org.chicago.cta.weather.v1` | Kafka REST Proxy (HTTP POST) |
| PostgreSQL stations table | `com.cta.stations.data.rawt001.stations` | Kafka Connect JDBC Source |
| Faust stream processor | `org.chicago.cta.stations.table.v1t001` | Faust internal producer |
| KSQL aggregation | `TURNSTILE_SUMMARY` | KSQL internal producer |

Topics are created with LZ4 compression, a short delete-retention window (2 s) suitable for
real-time transit dashboards, and 10 partitions by default for arrival topics
(`producers/models/producer.py:18-32`).

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| RabbitMQ / AMQP | No log-replay; difficult to add consumers without re-engineering |
| REST polling from dashboard | Tight coupling, synchronous latency, no fan-out |
| Redis Streams | Weaker ecosystem for schema enforcement and SQL-style aggregations |

---

## Consequences

**Positive**
- Producers and consumers are fully decoupled; new consumers (e.g. analytics) can subscribe
  independently without touching producers.
- Log retention enables late-joining consumers to replay from the earliest offset
  (`offset_earliest=True` in `consumers/server.py:73-91`).
- Kafka's partition model provides horizontal scale-out for high-throughput arrival events.

**Negative / Risks**
- Single-broker setup (`kafka0` in `docker-compose.yaml`) is a single point of failure for local
  development; production would require at minimum 3 brokers.
- Replication factor is set to `1` throughout — data loss on broker failure.
- Hard-coded `localhost:9092` in producer bootstrap config (`producers/models/producer.py:66`)
  couples the code to the local Docker environment.
