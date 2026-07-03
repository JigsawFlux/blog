# Coding for Crisis: Architecting Agentic AI for Emergency Response

**The Challenge:** Current emergency response infrastructure relies on legacy systems that struggle to manage data bursts during critical incidents. We are moving beyond simple LLM chatbots to build stateful, agentic workflows that act as force multipliers for emergency dispatchers.  
**The Invitation:** We are open-sourcing our core patterns at [JigsawFlux/agentic-patterns](https://github.com/JigsawFlux/agentic-patterns). We need engineers, system architects, and safety researchers to help refine these workflows so they can be reliably deployed by emergency services.  
---

## 1\. The Scenario: 14 Kingsbourne Terrace

To build resilient software, we need a rigorous environment. We are testing our agents against a high-stakes, 3-storey building fire simulation in London.

* **Constraint:** The Incident Commander must manage incoming crews, traffic flow on High Holborn, and medical triage simultaneously.  
* **The Technical Bottleneck:** Information asymmetry. The Commander cannot effectively process radio audio, dispatch logs, and sensor data manually in real-time.

## 2\. Technical Architecture: Statefulness over Stochasticity

We chose **LangGraph** because emergency response requires determinism and state persistence that simple chain-of-thought prompting cannot provide. Our architecture focuses on three pillars:

1. **State Management:** Defining the "Incident Object" that persists across nodes.  
2. **Human-in-the-Loop (HITL):** Forcing breakpoints before high-impact actions.  
3. **Cyclic Execution:** Allowing agents to re-evaluate after receiving new information (e.g., updated traffic flow from Roads Policing).

### Implementation Snippet: Defining the State

```py
# We use Pydantic to enforce schema validation for all agent inputs
from typing import TypedDict, List, Annotated
import operator

class IncidentState(TypedDict):
    incident_id: str
    location: str
    units_dispatched: List[str]
    messages: Annotated[List[str], operator.add] 
    requires_human_approval: bool 
```

### Implementation Snippet: The Workflow Graph

```py
# Building the Workflow Graph
from langgraph.graph import StateGraph, END

workflow = StateGraph(IncidentState)

# Nodes
workflow.add_node("parse_radio_input", agent_parse_radio)
workflow.add_node("safety_check", agent_safety_protocol)
workflow.add_node("dispatch_update", agent_update_dispatch)

# Edges
workflow.add_edge("parse_radio_input", "safety_check")
workflow.add_conditional_edge("safety_check", should_continue) 
```

## 3\. The Human-in-the-Loop (HITL) Mechanism

In emergency response, we do not automate the *decision*; we automate the *synthesis*. We pause execution to ensure the Incident Commander reviews the output before it hits the dispatch wire.

```py
# Implementing a breakpoint for Human Approval
app = workflow.compile(interrupt_before=["dispatch_update"]) 
```

## 4\. Why Contribute?

We are building infrastructure that requires:

* **Low Latency:** Optimized graph traversals.  
* **Security:** Auditable trails for every decision the AI suggests.  
* **Integrability:** APIs that talk to existing emergency services hardware.

## 5\. Get Involved

* **View the Code:** [GitHub \- JigsawFlux/agentic-patterns](https://github.com/JigsawFlux/agentic-patterns)  
* **Open an Issue:** If you see a vulnerability in our state management or have a pattern to optimize our graph efficiency, please contribute.  
* **Roadmap:** We are currently prioritizing the "Medical Triage" agent workflow. Your PRs are welcome.

---

## References

* [LangGraph Documentation](https://python.langchain.com/docs/langgraph/)  
* [London Fire Brigade Incident Management Guidelines](https://www.london-fire.gov.uk/about-us/grenfell-tower-investigation-and-review-team-gtirt/)  
* [UK Emergency Planning Framework](https://www.communications.gov.uk/publications/emergency-planning-framework/)

# Coding for Crisis: Architecting Agentic AI for Emergency Response

**The Challenge:** Current emergency response infrastructure relies on legacy systems that struggle to manage data bursts during critical incidents. We are moving beyond simple LLM chatbots to build stateful, agentic workflows that act as force multipliers for emergency dispatchers.  
**The Invitation:** We are open-sourcing our core patterns at [JigsawFlux/agentic-patterns](https://github.com/JigsawFlux/agentic-patterns). We need engineers, system architects, and safety researchers to help refine these workflows so they can be reliably deployed by emergency services.  
---

## 1\. The Scenario: 14 Kingsbourne Terrace

To build resilient software, we need a rigorous environment. We are testing our agents against a high-stakes, 3-storey building fire simulation in London.

* **Constraint:** The Incident Commander must manage incoming crews, traffic flow on High Holborn, and medical triage simultaneously.  
* **The Technical Bottleneck:** Information asymmetry. The Commander cannot effectively process radio audio, dispatch logs, and sensor data manually in real-time.

## 2\. Technical Architecture: Statefulness over Stochasticity

We chose **LangGraph** because emergency response requires determinism and state persistence that simple chain-of-thought prompting cannot provide. Our architecture focuses on three pillars:

1. **State Management:** Defining the "Incident Object" that persists across nodes.  
2. **Human-in-the-Loop (HITL):** Forcing breakpoints before high-impact actions.  
3. **Cyclic Execution:** Allowing agents to re-evaluate after receiving new information (e.g., updated traffic flow from Roads Policing).

**Implementation Snippet: Defining the State**

```py
# We use Pydantic to enforce schema validation for all agent inputs
from typing import TypedDict, List, Annotated
import operator

class IncidentState(TypedDict):
    incident_id: str
    location: str
    units_dispatched: List[str]
    messages: Annotated[List[str], operator.add] 
    requires_human_approval: bool 
```

**Implementation Snippet: The Workflow Graph**

```py
# Building the Workflow Graph
from langgraph.graph import StateGraph, END

workflow = StateGraph(IncidentState)

# Nodes
workflow.add_node("parse_radio_input", agent_parse_radio)
workflow.add_node("safety_check", agent_safety_protocol)
workflow.add_node("dispatch_update", agent_update_dispatch)

# Edges
workflow.add_edge("parse_radio_input", "safety_check")
workflow.add_conditional_edge("safety_check", should_continue) 
```

## 3\. The Human-in-the-Loop (HITL) Mechanism

In emergency response, we do not automate the *decision*; we automate the *synthesis*. We pause execution to ensure the Incident Commander reviews the output before it hits the dispatch wire.

```py
# Implementing a breakpoint for Human Approval
app = workflow.compile(interrupt_before=["dispatch_update"]) 
```

## 4\. Why Contribute?

We are building infrastructure that requires:

* **Low Latency:** Optimized graph traversals.  
* **Security:** Auditable trails for every decision the AI suggests.  
* **Integrability:** APIs that talk to existing emergency services hardware.

## 5\. Get Involved

* **View the Code:** [GitHub \- JigsawFlux/agentic-patterns](https://github.com/JigsawFlux/agentic-patterns)  
* **Open an Issue:** If you see a vulnerability in our state management or have a pattern to optimize our graph efficiency, please contribute.  
* **Roadmap:** We are currently prioritizing the "Medical Triage" agent workflow. Your PRs are welcome.

---

## References

* [LangGraph Documentation](https://python.langchain.com/docs/langgraph/)  
* [London Fire Brigade Incident Management Guidelines](https://www.london-fire.gov.uk/about-us/grenfell-tower-investigation-and-review-team-gtirt/)  
* [UK Emergency Planning Framework](https://www.communications.gov.uk/publications/emergency-planning-framework/)

