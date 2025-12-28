# LlamaTown  
## Hybrid Multi-Agent Policy Game with LLMs (LLMs Playing, Not Just Talking)

LlamaTown is a **multi-agent policy deliberation simulator** where Large Language Models (LLMs) behave as **strategic players** rather than free-form conversational agents.

Instead of “just talking”, each agent:
- selects **discrete actions**,
- operates under **explicit incentives and constraints**,
- interacts in a **rule-based environment**,
- is evaluated by a **hybrid judge** (rules + LLM),
- and contributes to a **final decision with measurable payoffs**.

This project implements a practical hybrid interpretation of **game-theoretic dialogue**, inspired by recent research on treating language as strategy.

---

## Core Idea

Traditional multi-agent LLM systems are prompt-driven and conversational.  
LlamaTown reframes interaction as a **sequential game**.

Each turn:
1. An agent **chooses a discrete action** (strategy).
2. The LLM **renders** that action into natural language.
3. A deterministic environment **updates the world state**.
4. An LLM judge **scores soft factors** (fairness, realism, acceptance).
5. Scores are **fused back into the state**.
6. After several rounds, a decision is made and **utilities are computed**.

Language is not the strategy.  
**Language is the actuator.**

---

## What “LLMs Playing” Means

| Aspect | Talking | Playing |
|------|--------|--------|
| Control | Prompt text | Discrete actions |
| Behavior | Heuristic | Incentive-driven |
| State | Transcript | Structured variables |
| Evaluation | Subjective | Payoffs + metrics |
| Stability | None | Strategic consistency |

---

## Roles

The system currently includes five roles:

- **Water Minister**
- **Farmer Representative**
- **Environmental Advocate**
- **Citizen**
- **Minister (Chair)** – final decision authority

Each role has:
- a **restricted action set**,
- a **distinct utility function**,
- different incentives and trade-offs.

---

## Discrete Action Space

Agents select actions from a finite, interpretable set:

- `PROPOSE(option)`
- `SUPPORT(option)`
- `OPPOSE(option)`
- `AMEND(option, amendment_type)`
- `OFFER_COMPROMISE(option_a, option_b)`
- `DEMAND_COMPENSATION(level)`
- `RAISE_RISK(type)`
- `ASK_QUESTION(role, type)`
- `REQUEST_METRICS(kpi)`
- `SUMMARIZE`
- `CALL_VOTE`
- `DECIDE(option)` *(Chair only)*

This finite action space is what makes learning, evaluation, and equilibrium reasoning possible.

---

## Game State (Structured)

The environment maintains a compact, computable state:

- `budget_remaining`
- `infrastructure_status`
- `groundwater_risk`
- `restriction_level`
- `public_support`
- `fairness_index`
- `economic_stress`
- `support[role][option]`
- `decision_locked`
- `decision_option`

The conversation transcript is **observation**, not state.

---

## Hybrid Evaluation Model

### Rule-Based (Hard Constraints)
Handled deterministically:
- budget feasibility
- infrastructure limits
- restriction effects
- environmental impact

### LLM Judge (Soft Factors)
Evaluates the round and returns **strict JSON**:
- realism
- public_acceptance
- fairness_perception
- conflict_level
- persuasion per role
- coherence per role

### Fusion
Soft scores are weighted into the state.  
The LLM never overrides hard constraints.

---

## Utilities (Payoffs)

Utilities are computed at the terminal state.

Examples:
- **Farmer**: stability, low restriction, compensation
- **Environment**: long-term sustainability
- **Citizen**: affordability, fairness
- **Water Minister**: feasibility, measurability
- **Chair**: overall welfare and acceptance

Agents act to maximize **their own utility**, not consensus.

---

## Decision Mechanism

1. Chair may `CALL_VOTE`
2. Options scored via weighted support + feasibility
3. If threshold is met → decision is locked
4. Chair issues `DECIDE`
5. Episode ends → utilities are shown

---

## Project Structure

llamatown/
├─ backend/
│ └─ app/
│ ├─ main.py # FastAPI entry
│ ├─ orchestrator.py # Game loop
│ ├─ schemas.py # API & WebSocket schemas
│ ├─ roles.py # Role metadata
│ ├─ game/
│ │ ├─ actions.py
│ │ ├─ state.py
│ │ ├─ transition.py
│ │ ├─ utilities.py
│ │ └─ policy.py
│ ├─ llm/
│ │ ├─ ollama_client.py
│ │ ├─ render.py
│ │ └─ judge.py
│ └─ scenario/
│ └─ defaults.py
└─ frontend/
└─ src/
├─ App.jsx
├─ ws.js
├─ roles.js
├─ styles.css
└─ main.jsx


---

## Requirements

### System
- Python 3.10+
- Node.js 18+
- Ollama

### Model
- `llama3` (local via Ollama)

---

## Installation & Running

### 1. Start Ollama
```bash
ollama serve
ollama pull llama3
ollama list

cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000


cd frontend
npm install
npm run dev
