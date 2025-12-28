# Ai-town

## Water Council: Equilibrium Negotiation

This repo includes a deterministic Water Council negotiation episode where three specialist agents negotiate a 100-unit water allocation with a Nash-bargaining target.

### How it works
- **Solver:** `server/game_theory/water_council.py` computes utilities, outside options, and a Nash bargaining solution (x*) using a coarse grid search followed by projected gradient refinement.
- **Negotiation loop:** `scripts/run_water_council.py` alternates offers and evaluates accept/reject using per-agent utility thresholds blended between x*, the best seen offer, and the outside option.
- **Episode storage:** `server/db/water_council_episodes.py` stores the episode record for replay.
- **UI panel:** `ui/waterCouncil.html` renders the latest episode with stacked bars, utilities, and full turn history.

### Method overview (LLM personas + Nash target)
1. **Utility modeling:** Each agent has a concave utility function with penalties for thresholds and overdraws. This captures preferences for hydro/ecosystem protection, agriculture reliability, and infrastructure service continuity (`compute_utilities` in `server/game_theory/water_council.py`).
2. **Outside options:** A fixed fallback allocation defines each agent’s baseline utility if bargaining fails.
3. **Nash bargaining target (x\*):** The solver maximizes the Nash product of surpluses (utility over the outside option) across agents, i.e., the sum of log surpluses. A coarse grid search finds a good seed, then projected gradient steps refine it while staying on the 100-unit simplex (`solve_nash_bargaining`).
4. **Negotiation dynamics:** Each round, one agent proposes an offer that drifts toward x\* with small randomness. Other agents accept if their utility meets or exceeds a blended threshold based on x\*, the best offer seen, and the outside option (`compute_acceptance_threshold`, `evaluate_acceptance`). The outcome is either unanimous acceptance or fallback to the outside option after the turn limit.
5. **LLM personas (optional):** If configured, each agent uses an LLM to generate short persona-consistent messages that reference the Nash equilibrium target. Messaging does not change the math; it makes the negotiation dialogue readable.

### Run a local episode
```bash
python scripts/run_water_council.py
```

The command writes `ui/waterCouncil.latest.json`. Open `ui/waterCouncil.html` in a local server (e.g. `python -m http.server`) to view the negotiation overlay.

### LLM persona negotiation
By default the negotiation uses deterministic persona messaging. If you want LLM-driven agent dialogue, set an API key and enable the client:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-4o-mini
python scripts/run_water_council.py
```

Set `LLM_ENABLED=false` to force deterministic messaging, or configure `OPENAI_BASE_URL` / `LLM_TIMEOUT_MS` as needed.

### Configuration
Adjust utility weights, caps, and penalties in `scripts/run_water_council.py` under `sample_params()`.
