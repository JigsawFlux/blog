# ADR-002: Avro Schemas + Confluent Schema Registry for Message Contracts

<!-- truncate -->

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

Multiple independent processes — producers written in Python and stream processors written with
Faust and KSQL — exchange messages over Kafka.  Without a shared, versioned contract, a schema
change in a producer silently breaks downstream consumers.  The system needs:

1. A machine-readable schema for every message type.
2. A registry that enforces backward/forward compatibility on publish.
3. Consumers that can deserialise messages without embedding the schema in every message.

---

## Decision

Apache Avro is the default serialisation format for first-party Kafka topics, with Confluent
Schema Registry (port 8081) acting as the central schema store.  Python producers that use the
shared producer base class publish Avro-encoded messages via `AvroProducer`, and consumers use
Avro deserialisation for those Avro-backed topics via `AvroConsumer` from
`confluent-kafka-python`.

There are explicit exceptions to that default path.  Weather data is produced via the REST Proxy
(`producers/models/weather.py`) rather than through `AvroProducer`.  The dashboard also consumes
some JSON topics with `is_avro=False` in `consumers/server.py`, including the stations table and
the `TURNSTILE_SUMMARY` topic.
Schema files are stored as JSON alongside the producer models:

```
producers/models/schemas/
  arrival_key.json
  arrival_value.json
  turnstile_key.json
  turnstile_value.json
  weather_key.json
  weather_value.json
```

Representative schema (`arrival_value.json`):
```json
{
  "namespace": "com.udacity",
  "type": "record",
  "name": "arrival.value",
  "fields": [
    {"name": "station_id",       "type": "int"},
    {"name": "train_id",         "type": "string"},
    {"name": "direction",        "type": "string"},
    {"name": "line",             "type": ["null","string"]},
    {"name": "train_status",     "type": ["null","string"]},
    {"name": "prev_station_id",  "type": ["null","int"]},
    {"name": "prev_direction",   "type": ["null","string"]}
  ]
}
```

The producer base class wires schemas at construction time
(`producers/models/producer.py:75-77`):
```python
self.avroProducer = AvroProducer(
    {"bootstrap.servers": "...", "schema.registry.url": "http://localhost:8081"},
    default_key_schema=self.key_schema, default_value_schema=self.value_schema)
```

The exception is the `TURNSTILE_SUMMARY` topic produced by KSQL, which uses JSON encoding
(VALUE_FORMAT='JSON') and is consumed without Avro deserialisation
(`consumers/server.py:87-91`).

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| JSON (plain) | No schema enforcement; brittle under field renames |
| Protobuf | Supported by Confluent but less native to the Python confluent-kafka library at the time |
| MessagePack | No registry ecosystem; debugging harder |

---

## Consequences

**Positive**
- Schema Registry enforces compatibility before messages are published.
- Schema IDs are embedded in the Avro wire format — consumers can always retrieve the exact schema
  used to write a message.
- Faust's `faust.Record` dataclasses mirror the Avro schema structure, making the contract
  explicit in both the registry and the Python type system
  (`consumers/faust_stream.py:14-33`).

**Negative / Risks**
- `AvroProducer` is marked as a legacy API in newer Confluent SDK versions; migration to
  `SerializingProducer` with `AvroSerializer` will be needed.
- The KSQL `TURNSTILE_SUMMARY` topic diverges from the Avro convention (uses JSON), creating an
  inconsistency that consumers must handle explicitly (`is_avro=False`).
- Schema files live inside `producers/` only; the consumer side has no local copy, creating a
  coupling between producer deployment and consumer startup.
