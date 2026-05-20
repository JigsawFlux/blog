# ADR-005: Kafka REST Proxy for the Weather Producer

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

The weather simulation model (`producers/models/weather.py`) needs to publish Avro-encoded
records to Kafka.  All other producers in the system use the `confluent-kafka` Python library's
`AvroProducer` directly against the broker.

During development, a second integration path was explored: the Confluent Kafka REST Proxy
(port 8082), which accepts HTTP POST requests with embedded schemas and records.

---

## Decision

The `Weather` producer uses the Kafka REST Proxy instead of a native Kafka producer client.

Implementation (`producers/models/weather.py:71-86`):

```python
resp = requests.post(
    f"{constants.Constants.rest_proxy_url}topics/{constants.Constants.weather_topic_name}",
    headers={"Content-Type": "application/vnd.kafka.avro.v2+json"},
    data=json.dumps({
        "key_schema":   json.dumps(Weather.key_schema),
        "value_schema": json.dumps(Weather.value_schema),
        "records": [{"value": {...}, "key": {"timestamp": self.time_millis()}}]
    }),
)
```

Schema JSON is inlined in every POST payload rather than being pre-registered with the Schema
Registry.  The REST Proxy handles registration transparently.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Native `AvroProducer` (used by other producers) | Both approaches produce identical results; REST Proxy was chosen to demonstrate the capability |
| `requests` posting to the broker directly | Kafka wire protocol is binary and not HTTP-accessible without a proxy |

---

## Consequences

**Positive**
- Demonstrates an HTTP-based integration path useful for polyglot producers (languages without a
  native Kafka client library).
- No Kafka client dependency required in the producing service.

**Negative / Risks**
- An additional network hop (producer → REST Proxy → broker) adds latency compared to the native
  client path.
- Inlining the full schema JSON in every request is wasteful; the Schema Registry already holds
  the schema after the first publish.
- Error handling on HTTP failures is minimal — a failed `raise_for_status()` logs the error but
  drops the weather event silently.
- Inconsistency: weather uses REST Proxy while all other producers use the native client,
  increasing cognitive overhead for maintainers.
