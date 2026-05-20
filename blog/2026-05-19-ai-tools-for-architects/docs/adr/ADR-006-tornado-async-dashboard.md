# ADR-006: Tornado Async Web Server for the Real-Time Transit Dashboard

**Date:** 2026-03-12
**Status:** Accepted
**Deciders:** Engineering Team

---

## Context

The consumer layer must simultaneously:
1. Poll four Kafka topics continuously and update in-memory state (weather, line status, arrivals,
   turnstile counts).
2. Serve HTTP GET requests that render the current state as an HTML page.

A blocking web server would stall Kafka consumption while handling HTTP requests.  A blocking
Kafka consumer would stall HTTP responses while waiting for new messages.

---

## Decision

The Tornado asynchronous web framework is used as the server runtime
(`consumers/server.py`).  Kafka consumers are scheduled as Tornado IO loop callbacks:

```python
for consumer in consumers:
    tornado.ioloop.IOLoop.current().spawn_callback(consumer.consume)
tornado.ioloop.IOLoop.current().start()
```

Each `KafkaConsumer.consume()` is an `async` coroutine that yields control between polls
via `await gen.sleep(self.sleep_secs)` (`consumers/consumer.py:70-76`).  The HTTP handler
renders state synchronously on GET without blocking Kafka consumption.

Four consumers are registered on startup:

| Consumer | Topic | Avro? |
|----------|-------|-------|
| Weather | `org.chicago.cta.weather.v1` | Yes |
| Stations table | `^org.chicago.cta.stations.table.*` | No (regex, JSON) |
| Train arrivals | `^org.chicago.cta.station.arrivals.*` | Yes (regex) |
| Turnstile summary | `TURNSTILE_SUMMARY` | No (JSON) |

All consumers share a single `group.id` (`com.chicago.transport.consumer.group.1`).

The server listens on port 8888 and serves a single route (`/`) rendered from
`consumers/templates/status.html`.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| Flask / Django (synchronous) | Cannot multiplex Kafka polling with HTTP serving without threads |
| asyncio + aiohttp | Viable alternative; Tornado chosen for built-in IOLoop integration matching `confluent_kafka` callback style |
| Separate Kafka consumer process + shared state store (Redis) | Over-engineered for a dashboard with a single user |

---

## Consequences

**Positive**
- Single process handles both Kafka consumption and HTTP serving without threading.
- Tornado's `spawn_callback` allows an arbitrary number of consumers to coexist on one event loop.
- Simple HTML template rendering — no JavaScript framework needed for the status page.

**Negative / Risks**
- State is stored in Python objects (`Weather`, `Lines`) in process memory; any restart loses
  accumulated state until topics are re-consumed from the earliest offset.
- All four consumers share one `group.id`, meaning if a second dashboard instance were started
  it would steal partitions from the first.
- The dashboard blocks entirely during startup if KSQL or Faust topics are not yet ready
  (hard `exit(1)` at `consumers/server.py:49-57`), requiring a manual restart order.
- No authentication or HTTPS on port 8888.
