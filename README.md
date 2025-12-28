# Ai-town

## Water Council: Equilibrium Negotiation

This repo includes a deterministic Water Council negotiation episode where three specialist agents negotiate a 100-unit water allocation with a Nash-bargaining target.

### How it works
- **Solver:** `server/game_theory/waterCouncil.js` computes utilities, outside options, and a Nash bargaining solution (x*) using a coarse grid search followed by projected gradient refinement.
- **Negotiation loop:** `scripts/run-water-council.js` alternates offers and evaluates accept/reject using per-agent utility thresholds blended between x*, the best seen offer, and the outside option.
- **Episode storage:** `server/db/waterCouncilEpisodes.js` stores the episode record for replay.
- **UI panel:** `ui/waterCouncil.html` renders the latest episode with stacked bars, utilities, and full turn history.

### Run a local episode
```bash
node scripts/run-water-council.js
```

The command writes `ui/waterCouncil.latest.json`. Open `ui/waterCouncil.html` in a local server (e.g. `python -m http.server`) to view the negotiation overlay.

### LLM persona negotiation
By default the negotiation uses deterministic persona messaging. If you want LLM-driven agent dialogue, set an API key and enable the client:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-4o-mini
node scripts/run-water-council.js
```

Set `LLM_ENABLED=false` to force deterministic messaging, or configure `OPENAI_BASE_URL` / `LLM_TIMEOUT_MS` as needed.

### Configuration
Adjust utility weights, caps, and penalties in `scripts/run-water-council.js` under `sampleParams()`.
