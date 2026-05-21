# Architecture Document — CTA Public Transport Optimisation System

<!-- truncate -->

**Version:** 1.0
**Date:** 2026-03-12
**Status:** Baselined
**Standard:** 4+1 Architectural View Model (Kruchten, 1995)
**Notation:** ArchiMate 3.1 concepts rendered as Mermaid diagrams

---

## Table of Contents

1. [Document Purpose and Scope](#1-document-purpose-and-scope)
2. [Architectural Drivers](#2-architectural-drivers)
3. [Use Case View (+1)](#3-use-case-view-1)
4. [Logical View](#4-logical-view)
5. [Process View](#5-process-view)
6. [Development View](#6-development-view)
7. [Physical View](#7-physical-view)
8. [Architectural Decisions Summary](#8-architectural-decisions-summary)
9. [Risks and Technical Debt](#9-risks-and-technical-debt)

---

## 1. Document Purpose and Scope

### 1.1 Purpose

This document describes the software architecture of the **Chicago Transit Authority (CTA)
Public Transport Optimisation System**.  It is structured according to the **4+1 Architectural
View Model** (Kruchten, IEEE Software 1995), which organises the architecture into five
complementary views, each addressing the concerns of a different stakeholder group:

| View | Primary Audience | Central Concern |
|------|-----------------|-----------------|
| Use Case (+1) | All stakeholders | Scenarios that drive architectural decisions |
| Logical | Architects, developers | Functional decomposition and key abstractions |
| Process | Architects, integrators | Concurrency, data flows, runtime behaviour |
| Development | Developers, build engineers | Module structure, package organisation |
| Physical | Operations, DevOps | Deployment topology, infrastructure mapping |

Diagrams use **Mermaid** syntax and follow **ArchiMate 3.1** layering conventions:
- **Technology Layer** — infrastructure elements (brokers, databases, containers)
- **Application Layer** — software components and their interfaces
- **Business Layer** — business processes and actors that the system serves

### 1.2 System Overview

The system is a real-time streaming pipeline that ingests simulated operational data from the
CTA elevated rail network ("L"), processes it through multiple transformation stages, and presents
a live transit status dashboard.  It demonstrates a full **Event-Driven Architecture (EDA)** on
the Confluent Kafka platform.

### 1.3 Scope

- Three train lines: **Blue**, **Red**, **Green** (each with 10 trains, bidirectional)
- Station arrival events, turnstile ridership counts, and weather telemetry
- Static station reference data from PostgreSQL
- A browser-accessible real-time status dashboard

---

## 2. Architectural Drivers

### 2.1 Quality Attribute Requirements

| ID | Quality Attribute | Scenario | Architectural Response |
|----|-------------------|----------|----------------------|
| QA-01 | **Throughput** | 3 lines × stations × 10 trains produce arrival events every 5 s | 10-partition Kafka topic; AvroProducer batching |
| QA-02 | **Decoupling** | New consumers must not require producer changes | All communication via Kafka topics (no direct calls) |
| QA-03 | **Schema Evolution** | Fields may be added to events over time | Avro + Schema Registry with compatibility enforcement |
| QA-04 | **Replayability** | Dashboard must recover state on restart | Consumers start from `offset_earliest`; Faust rebuilds table from log |
| QA-05 | **Responsiveness** | Dashboard must serve HTTP requests without stalling Kafka polling | Tornado async IO loop; consumers as coroutines |
| QA-06 | **Extensibility** | Station reference data changes without code deployment | Kafka Connect JDBC connector; consumers subscribe to topic |

### 2.2 Constraints

- Python-only application code (no JVM services authored in-house)
- Single-host Docker Compose deployment (development / demonstration environment)
- Confluent Platform 5.2.2 (fixed version)

---

## 3. Use Case View (+1)

The Use Case View captures the key scenarios that motivated and validate the architectural
decisions.  In the 4+1 model this view acts as the glue — each scenario exercises a slice
through every other view.

### 3.1 Actor Diagram

```mermaid
graph LR
    subgraph Actors
        A1(["👤 Transit Operator\n(Dashboard User)"])
        A2(["🤖 Train Simulator"])
        A3(["🤖 Turnstile Simulator"])
        A4(["🤖 Weather Simulator"])
        A5(["🗄️ PostgreSQL\n(Station Registry)"])
    end

    subgraph System Boundary
        S1[/"UC-01\nView Live\nTransit Status"/]
        S2[/"UC-02\nPublish Train\nArrival Event"/]
        S3[/"UC-03\nPublish Turnstile\nEntry"/]
        S4[/"UC-04\nPublish Weather\nReading"/]
        S5[/"UC-05\nStream Station\nReference Data"/]
        S6[/"UC-06\nAggregate Rider\nCounts"/]
        S7[/"UC-07\nTransform Station\nSchema"/]
    end

    A1 --> S1
    A2 --> S2
    A3 --> S3
    A4 --> S4
    A5 --> S5
    S5 -.includes.-> S7
    S3 -.includes.-> S6
```

### 3.2 Key Scenarios

#### UC-01 — View Live Transit Status
**Trigger:** Transit operator opens `http://localhost:8888`
**Flow:** Tornado serves `status.html` populated from in-memory `Lines` and `Weather` state
that is continuously updated by four Kafka consumers running as async coroutines.
**Architectural relevance:** Drives the Tornado async server choice (ADR-006) and the
requirement for in-process Kafka consumer coroutines.

#### UC-02 — Publish Train Arrival Event
**Trigger:** Simulation time step advances; a train moves to the next station.
**Flow:** `Station.run()` → `AvroProducer.produce()` → Schema Registry validates Avro →
Kafka topic `org.chicago.cta.station.arrivals.t001` → `KafkaConsumer` in server →
`Lines.process_message()` → UI state updated.
**Architectural relevance:** Establishes the end-to-end Kafka + Avro pipeline (ADR-001, ADR-002).

#### UC-04 — Publish Weather Reading
**Trigger:** Simulation hour boundary.
**Flow:** `Weather.run()` → HTTP POST to Kafka REST Proxy → Kafka topic
`org.chicago.cta.weather.v1` → `KafkaConsumer` in server → `Weather.process_message()`.
**Architectural relevance:** Demonstrates the REST Proxy integration path (ADR-005).

#### UC-06 — Aggregate Rider Counts
**Trigger:** Continuous turnstile events on `com.cta.stations.turnstile.entry`.
**Flow:** KSQL `turnstile` table materialises from topic → KSQL `TURNSTILE_SUMMARY` GROUP BY
aggregation → new Kafka topic → `KafkaConsumer (is_avro=False)` in server → UI ridership count.
**Architectural relevance:** Drives the KSQL aggregation decision (ADR-004).

#### UC-07 — Transform Station Schema
**Trigger:** Kafka Connect pushes a raw station row to `com.cta.stations.data.rawt001.stations`.
**Flow:** Faust `transform_stations` agent reads record → resolves `red/blue/green` booleans
to `line` string → writes `TransformedStation` to `org.chicago.cta.stations.table.v1t001`
and updates Faust in-memory table.
**Architectural relevance:** Drives the Faust stream processor choice (ADR-004).

---

## 4. Logical View

The Logical View describes the system's functional decomposition into key abstractions,
their responsibilities, and their relationships.  This view follows ArchiMate's
**Application Layer** notation.

### 4.1 Component Overview

```mermaid
graph TB
    subgraph "Business Layer"
        BL1["CTA Train Operations\n(Simulated)"]
        BL2["Transit Operator\n(Dashboard Consumer)"]
    end

    subgraph "Application Layer — Producers"
        AP1["TimeSimulation\n(Orchestrator)"]
        AP2["Line\n(Blue | Red | Green)"]
        AP3["Station\n(Producer)"]
        AP4["Turnstile\n(Producer)"]
        AP5["Weather\n(Producer)"]
        AP6["KafkaConnectConfig\n(connector.py)"]
    end

    subgraph "Application Layer — Stream Processing"
        SP1["FaustApp\n(stations-stream)"]
        SP2["KSQL Engine\n(turnstile aggregation)"]
    end

    subgraph "Application Layer — Consumers"
        CP1["Tornado Web Server\n(server.py)"]
        CP2["KafkaConsumer × 4"]
        CP3["Lines Model"]
        CP4["Weather Model"]
        CP5["Status Template\n(status.html)"]
    end

    subgraph "Technology Layer"
        TL1[("Apache Kafka\n(Event Broker)")]
        TL2[("Schema Registry")]
        TL3[("PostgreSQL\n(Station DB)")]
        TL4["Kafka Connect\n(JDBC Source)"]
        TL5["Kafka REST Proxy"]
    end

    BL1 --> AP1
    BL2 --> CP1

    AP1 --> AP2
    AP2 --> AP3
    AP2 --> AP4
    AP1 --> AP5
    AP1 --> AP6

    AP3 -->|"AvroProducer"| TL1
    AP4 -->|"AvroProducer"| TL1
    AP5 -->|"HTTP POST"| TL5
    TL5 --> TL1
    AP6 --> TL4
    TL4 -->|"JDBC poll"| TL3
    TL4 --> TL1

    TL1 --> SP1
    TL1 --> SP2
    SP1 --> TL1
    SP2 --> TL1

    TL1 --> CP2
    CP2 --> CP3
    CP2 --> CP4
    CP1 --> CP3
    CP1 --> CP4
    CP1 --> CP5

    AP3 <-->|"schema lookup"| TL2
    AP4 <-->|"schema lookup"| TL2
    CP2 <-->|"schema lookup"| TL2
```

### 4.2 Key Abstractions

#### Producer Hierarchy

```mermaid
classDiagram
    class Producer {
        +topic_name: str
        +key_schema: Schema
        +value_schema: Schema
        +num_partitions: int
        +num_replicas: int
        +avroProducer: AvroProducer
        +existing_topics: Set
        +create_topic()
        +produce(topic, key, value)
        +close()
        +time_millis() int
    }

    class Station {
        +station_id: int
        +name: str
        +color: str
        +dir_a: Station
        +dir_b: Station
        +a_train: Train
        +b_train: Train
        +turnstile: Turnstile
        +arrive_a(train, prev_station_id, prev_direction)
        +arrive_b(train, prev_station_id, prev_direction)
        +run(train, direction, prev_station_id, prev_direction)
    }

    class Turnstile {
        +station: Station
        +turnstile_hardware: TurnstileHardware
        +run(timestamp, time_step)
    }

    class Weather {
        +status: IntEnum
        +temp: float
        +winter_months: Set
        +summer_months: Set
        +run(month)
        -_set_weather(month)
    }

    Producer <|-- Station
    Producer <|-- Turnstile
    Producer <|-- Weather
    Station "1" *-- "1" Turnstile : owns
```

#### Consumer / Model Hierarchy

```mermaid
classDiagram
    class KafkaConsumer {
        +topic_name_pattern: str
        +message_handler: Callable
        +is_avro: bool
        +offset_earliest: bool
        +consumer: AvroConsumer | Consumer
        +consume() async
        -_consume() int
        +on_assign(consumer, partitions)
        +close()
    }

    class Lines {
        +process_message(message)
    }

    class Weather_Model {
        +process_message(message)
    }

    class Line_Model {
        +stations: List~Station~
    }

    class Station_Model {
        +station_id: int
        +station_name: str
        +order: int
        +line: str
        +num_riders: int
    }

    KafkaConsumer --> Lines : message_handler
    KafkaConsumer --> Weather_Model : message_handler
    Lines "1" *-- "many" Line_Model
    Line_Model "1" *-- "many" Station_Model
```

### 4.3 Kafka Topic Catalogue

| Topic | Producer | Consumer(s) | Format | Partitions |
|-------|----------|-------------|--------|------------|
| `org.chicago.cta.station.arrivals.t001` | Station (AvroProducer) | Tornado server | Avro | 10 |
| `com.cta.stations.turnstile.entry` | Turnstile (AvroProducer) | KSQL | Avro | 10 |
| `org.chicago.cta.weather.v1` | Weather (REST Proxy) | Tornado server | Avro | 10 |
| `com.cta.stations.data.rawt001.stations` | Kafka Connect JDBC | Faust | JSON (Connect) | 1 |
| `org.chicago.cta.stations.table.v1t001` | Faust | Tornado server | JSON | 1 |
| `TURNSTILE_SUMMARY` | KSQL | Tornado server | JSON | — |

---

## 5. Process View

The Process View describes the system's dynamic behaviour — how processes start, how data
flows between them at runtime, and how concurrency is managed.

### 5.1 System Startup Sequence

The diagram below shows the mandatory startup order.  Components further right depend on
components to their left being fully initialised.

```mermaid
sequenceDiagram
    autonumber
    participant PG as PostgreSQL
    participant KC as Kafka Connect
    participant KF as Kafka Broker
    participant SR as Schema Registry
    participant FS as Faust App
    participant KQ as KSQL Server
    participant SIM as simulation.py
    participant SRV as server.py (Tornado)

    Note over PG,SR: Docker Compose brings up infrastructure

    SIM->>KC: POST /connectors (configure JDBC source)
    KC->>PG: JDBC poll SELECT * FROM stations
    KC->>KF: Publish to com.cta.stations.data.rawt001.stations

    Note over FS: faust_stream.py started separately
    FS->>KF: Subscribe to stations topic
    FS->>KF: Produce to org.chicago.cta.stations.table.v1t001

    Note over KQ: ksql.py run separately
    KQ->>KF: POST /ksql (CREATE TABLE turnstile + TURNSTILE_SUMMARY)
    KF-->>KQ: Tables materialised → TURNSTILE_SUMMARY topic exists

    Note over SRV: server.py checks topic existence before starting
    SRV->>KF: AdminClient.list_topics()
    KF-->>SRV: TURNSTILE_SUMMARY ✓, stations.table ✓
    SRV->>SRV: spawn_callback(consumer.consume) × 4
    SRV->>SRV: IOLoop.start() → listen :8888

    loop Every 5 s (simulation step)
        SIM->>SR: Schema lookup / register
        SIM->>KF: Arrival events (AvroProducer)
        SIM->>KF: Turnstile events (AvroProducer)
        SIM->>KF: Weather events (REST Proxy, hourly)
    end
```

### 5.2 End-to-End Data Flow — Train Arrival

```mermaid
flowchart LR
    subgraph Producers
        SIM["simulation.py\nTimeSimulation.run()"]
        LINE["Line.run()\n_advance_trains()"]
        STN["Station.arrive_a/b()\nStation.run()"]
        AVP["AvroProducer\n.produce()"]
    end

    subgraph Kafka
        SR[("Schema\nRegistry\n:8081")]
        T1[["org.chicago.cta\n.station.arrivals\n.t001"]]
    end

    subgraph Consumers
        KC["KafkaConsumer\n(arrivals pattern)"]
        LM["Lines\n.process_message()"]
        WS["Tornado\nWeb Server\n:8888"]
        UI["status.html"]
    end

    SIM --> LINE --> STN --> AVP
    AVP <-->|"schema validate"| SR
    AVP -->|"Avro binary"| T1
    T1 -->|"poll()"| KC
    KC <-->|"schema fetch"| SR
    KC --> LM --> WS --> UI
```

### 5.3 End-to-End Data Flow — Turnstile Aggregation

```mermaid
flowchart LR
    subgraph Producers
        TS["Turnstile.run()\nfor each entry"]
        AVP2["AvroProducer\n.produce()"]
    end

    subgraph Kafka + KSQL
        T2[["com.cta.stations\n.turnstile.entry\n(Avro)"]]
        KT["KSQL: turnstile\nTABLE (Avro)"]
        KS[["TURNSTILE_SUMMARY\n(JSON)"]]
    end

    subgraph Consumers
        KC2["KafkaConsumer\nis_avro=False"]
        LM2["Lines\n.process_message()\n→ num_riders"]
        WS2["Tornado :8888"]
    end

    TS --> AVP2 --> T2 --> KT
    KT -->|"GROUP BY station_id\nCOUNT(*)"| KS
    KS --> KC2 --> LM2 --> WS2
```

### 5.4 Concurrency Model

```mermaid
graph TD
    subgraph "Tornado IOLoop (single thread)"
        IL["IOLoop.start()"]
        CB1["spawn_callback\nWeatherConsumer.consume()"]
        CB2["spawn_callback\nStationsConsumer.consume()"]
        CB3["spawn_callback\nArrivalsConsumer.consume()"]
        CB4["spawn_callback\nTurnstileConsumer.consume()"]
        HTTP["HTTP GET /\nMainHandler.get()"]
    end

    IL --> CB1 & CB2 & CB3 & CB4 & HTTP

    subgraph "async consume() loop"
        direction LR
        POLL["_consume()\npoll(timeout=0.1)"] -->|"num_results > 0"| POLL
        POLL -->|"num_results == 0"| SLEEP["await gen.sleep(1.0)"]
        SLEEP --> POLL
    end

    CB1 --> POLL
```

The entire consumer application runs in a **single OS thread** using cooperative multitasking.
Kafka polling is non-blocking (0.1 s timeout).  The HTTP handler is synchronous but executes
between coroutine yield points, keeping UI latency low.

---

## 6. Development View

The Development View describes the organisation of the software in the development environment —
module structure, package dependencies, and build artefacts.

### 6.1 Module Structure

```mermaid
graph TD
    subgraph "producers/"
        P_SIM["simulation.py\n(entry point)"]
        P_CONN["connector.py"]
        P_CONST["constants.py"]
        subgraph "producers/models/"
            PM_PROD["producer.py\n(base class)"]
            PM_LINE["line.py"]
            PM_STN["station.py"]
            PM_TURN["turnstile.py"]
            PM_WX["weather.py"]
            PM_TRAIN["train.py"]
            PM_THARD["turnstile_hardware.py"]
            subgraph "producers/models/schemas/"
                SCH["arrival_key.json\narrival_value.json\nturnstile_key.json\nturnstile_value.json\nweather_key.json\nweather_value.json"]
            end
        end
        subgraph "producers/data/"
            DATA["cta_stations.csv\nridership_curve.csv\nridership_seed.csv"]
        end
    end

    subgraph "consumers/"
        C_SRV["server.py\n(entry point)"]
        C_FAUST["faust_stream.py\n(entry point)"]
        C_KSQL["ksql.py\n(entry point)"]
        C_CONS["consumer.py\n(base class)"]
        C_CONST["constants.py"]
        C_TC["topic_check.py"]
        subgraph "consumers/models/"
            CM_LINE["line.py"]
            CM_LINES["lines.py"]
            CM_STN["station.py"]
            CM_WX["weather.py"]
        end
        subgraph "consumers/templates/"
            TMPL["status.html"]
        end
    end

    P_SIM --> P_CONN & P_CONST & PM_LINE & PM_WX
    PM_LINE --> PM_STN & PM_TRAIN
    PM_STN --> PM_PROD & PM_TURN & P_CONST
    PM_TURN --> PM_PROD & PM_THARD
    PM_WX --> PM_PROD & P_CONST

    C_SRV --> C_CONS & CM_LINES & CM_WX & C_TC & C_CONST
    C_FAUST --> C_CONST
    C_KSQL --> C_CONST & C_TC
    CM_LINES --> CM_LINE
    CM_LINE --> CM_STN
```

### 6.2 Package Dependencies

```mermaid
graph LR
    subgraph "producers/requirements.txt"
        confluent_kafka["confluent-kafka[avro]"]
        pandas["pandas"]
        requests_p["requests"]
    end

    subgraph "consumers/requirements.txt"
        faust_lib["faust"]
        tornado["tornado"]
        confluent_kafka_c["confluent-kafka[avro]"]
        requests_c["requests"]
    end

    PM_PROD2["producers/models/producer.py"] --> confluent_kafka
    PM_WX2["producers/models/weather.py"] --> requests_p
    P_SIM2["producers/simulation.py"] --> pandas

    C_SRV2["consumers/server.py"] --> tornado & confluent_kafka_c
    C_FAUST2["consumers/faust_stream.py"] --> faust_lib
    C_KSQL2["consumers/ksql.py"] --> requests_c
```

### 6.3 Entry Points and Startup Commands

| Process | Entry Point | Command |
|---------|------------|---------|
| Data producer + simulation | `producers/simulation.py` | `python simulation.py` |
| Station stream transformer | `consumers/faust_stream.py` | `faust -A faust_stream worker -l info` |
| Turnstile KSQL setup | `consumers/ksql.py` | `python ksql.py` |
| Dashboard web server | `consumers/server.py` | `python server.py` |

> **Note:** Processes 2, 3, and 4 have an implicit startup ordering dependency.
> The Kafka Connect JDBC connector (configured by the simulation) must produce station data
> before the Faust app can transform it; the KSQL tables must exist before the dashboard starts.
> There is no orchestration script enforcing this order.

---

## 7. Physical View

The Physical View maps software components onto physical (or virtualised) infrastructure.
This view follows ArchiMate's **Technology Layer**.

### 7.1 Container Deployment Diagram

```mermaid
graph TB
    subgraph "Docker Host (localhost)"
        subgraph "docker-compose.yaml"
            subgraph "Kafka Cluster"
                ZK["zookeeper\nconfluentinc/cp-zookeeper:5.2.2\n:2181"]
                KB["kafka0\nconfluentinc/cp-kafka:5.2.2\n:9092 (external)\n:19092 (internal)"]
                ZK --> KB
            end

            subgraph "Confluent Platform Services"
                SREG["schema-registry\nconfluentinc/cp-schema-registry:5.2.2\n:8081"]
                RPRXY["rest-proxy\nconfluentinc/cp-kafka-rest:5.2.2\n:8082"]
                KCONN["connect\nconfluentinc/cp-kafka-connect:5.2.2\n:8083"]
                KSQL_C["ksql\nconfluentinc/cp-ksql-server:5.2.2\n:8088"]
                KB --> SREG & RPRXY & KCONN & KSQL_C
            end

            subgraph "UI Tools"
                CUI["connect-ui\nlandoop/kafka-connect-ui:0.9.7\n:8084"]
                TUI["topics-ui\nlandoop/kafka-topics-ui:0.9.4\n:8085"]
                SRUI["schema-registry-ui\nlandoop/schema-registry-ui:0.9.5\n:8086"]
            end

            subgraph "Data Store"
                PG["postgres:11\n:5432\nDB: cta"]
            end

            KCONN --> CUI
            RPRXY --> TUI
            SREG --> SRUI
        end

        subgraph "Host Processes (Python, not containerised)"
            SIM_P["simulation.py\n(producers)"]
            FAUST_P["faust_stream.py\n(consumers)"]
            KSQL_P["ksql.py\n(consumers)"]
            SRV_P["server.py / Tornado\n:8888"]
        end

        BROWSER["🌐 Browser\nlocalhost:8888"]
    end

    SIM_P -->|":9092"| KB
    SIM_P -->|":8082"| RPRXY
    SIM_P -->|":8083"| KCONN
    KCONN -->|"JDBC :5432"| PG

    FAUST_P -->|":9092"| KB
    KSQL_P -->|":8088"| KSQL_C

    SRV_P -->|":9092"| KB
    SRV_P -->|":8081"| SREG

    BROWSER -->|"HTTP GET"| SRV_P
```

### 7.2 Network Port Map

| Port | Service | Protocol | Consumer(s) |
|------|---------|----------|-------------|
| 2181 | Zookeeper | TCP | Kafka broker (internal) |
| 9092 | Kafka broker | PLAINTEXT | Python producers, Python consumers, Faust |
| 8081 | Schema Registry | HTTP | AvroProducer, AvroConsumer, Kafka Connect |
| 8082 | Kafka REST Proxy | HTTP | Weather producer |
| 8083 | Kafka Connect REST API | HTTP | `connector.py` setup |
| 8084 | Connect UI | HTTP | Operator browser |
| 8085 | Topics UI | HTTP | Operator browser |
| 8086 | Schema Registry UI | HTTP | Operator browser |
| 8088 | KSQL Server | HTTP | `ksql.py` setup |
| 5432 | PostgreSQL | TCP | Kafka Connect JDBC |
| 8888 | Tornado Dashboard | HTTP | Transit Operator browser |

### 7.3 Data Persistence Boundary

```mermaid
graph LR
    subgraph "Persistent (survives container restart)"
        PG_VOL[("PostgreSQL Volume\ncta_stations data")]
        KF_LOG[("Kafka Topic Logs\n/var/lib/kafka")]
    end

    subgraph "Ephemeral (lost on restart)"
        FAUST_MEM[("Faust Table\nmemory://")]
        SRV_MEM[("Tornado In-Process\nLines + Weather state")]
    end

    PG_VOL -->|"JDBC poll"| KF_LOG
    KF_LOG -->|"offset_earliest replay"| FAUST_MEM
    KF_LOG -->|"offset_earliest replay"| SRV_MEM
```

All in-process state is rebuilt from Kafka on restart.  Durable state exists only in PostgreSQL
(station reference data) and the Kafka topic logs.

---

## 8. Architectural Decisions Summary

Cross-reference to the detailed ADR documents in `docs/adr/`.

| ID | Decision | Rationale | ADR |
|----|---------|-----------|-----|
| AD-01 | Apache Kafka as the central event bus | Decoupling, replayability, fan-out | [ADR-001](adr/ADR-001-kafka-as-central-event-bus.md) |
| AD-02 | Avro + Schema Registry for all first-party topics | Schema evolution, contract enforcement | [ADR-002](adr/ADR-002-avro-schema-registry.md) |
| AD-03 | Kafka Connect JDBC Source for PostgreSQL | Zero custom ingestion code; handles offset/retry | [ADR-003](adr/ADR-003-kafka-connect-jdbc-postgres.md) |
| AD-04 | Faust for station transformation | Python-native; record-level transform | [ADR-004](adr/ADR-004-dual-stream-processing-faust-ksql.md) |
| AD-05 | KSQL for turnstile aggregation | Declarative SQL GROUP BY; no Python state management | [ADR-004](adr/ADR-004-dual-stream-processing-faust-ksql.md) |
| AD-06 | Kafka REST Proxy for weather | Demonstrates HTTP-based produce path | [ADR-005](adr/ADR-005-rest-proxy-for-weather-producer.md) |
| AD-07 | Tornado async web server | Single-thread concurrency for Kafka + HTTP | [ADR-006](adr/ADR-006-tornado-async-dashboard.md) |

---

## 9. Risks and Technical Debt

### 9.1 Risks

| ID | Risk | Severity | Affected View | Mitigation |
|----|------|----------|---------------|------------|
| R-01 | Single Kafka broker — SPOF | High | Physical | Add 2 additional brokers; set `replication_factor=3` |
| R-02 | Replication factor 1 on all topics | High | Physical | Increase to 3 in production |
| R-03 | Hard-coded `localhost` addresses in both `constants.py` files | Medium | Development | Externalise via environment variables or a config file |
| R-04 | Hard-coded DB credentials in `connector.py` | High | Physical | Use Kafka Connect secrets management or environment injection |
| R-05 | Manual startup ordering with no orchestration | Medium | Process | Add a readiness-check script or use `depends_on` with health checks |
| R-06 | `AvroProducer` is a deprecated Confluent API | Medium | Development | Migrate to `SerializingProducer` + `AvroSerializer` |

### 9.2 Technical Debt

| ID | Description | Location | Effort |
|----|-------------|----------|--------|
| TD-01 | `TURNSTILE_SUMMARY` uses JSON while all other topics use Avro — inconsistency in serialisation convention | `consumers/ksql.py`, `consumers/server.py:87` | Low |
| TD-02 | Faust Table uses `store="memory://"` — state lost on restart, rebuild time increases with topic size | `consumers/faust_stream.py:38` | Medium |
| TD-03 | Both `producers/constants.py` and `consumers/constants.py` duplicate identical constant values | Both files | Low |
| TD-04 | No unit or integration tests present in the repository | Entire codebase | High |
| TD-05 | Weather schema JSON loaded on every `Weather.__init__` call via file I/O (class variables mitigate partially) | `producers/models/weather.py:49-55` | Low |
| TD-06 | `connector.py` exits the process on connector creation failure, preventing graceful recovery | `producers/connector.py:51-53` | Low |

---

*Document generated by reverse-engineering the source code on 2026-03-12.
All diagrams use [Mermaid](https://mermaid.js.org/) and render natively on GitHub.*
