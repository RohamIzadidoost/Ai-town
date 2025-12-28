import json
import os
from pathlib import Path

from server.db.water_council_episodes import create_episode
from server.game_theory.water_council import (
    AGENTS,
    compute_utilities,
    create_negotiation_state,
    evaluate_acceptance,
    mulberry32,
    propose_offer,
    step_negotiation,
)
from server.llm.llm_client import create_llm_client_from_env
from server.llm.persona_messages import create_persona_messenger
from server.llm.prompt_utils import format_offer_json


def sample_params(rng):
    def between(min_value, max_value):
        return min_value + (max_value - min_value) * rng()

    return {
        "hydro": {
            "a": between(7.5, 9.5),
            "p": between(0.6, 1.1),
            "capAgriExcess": between(40, 55),
            "droughtThreshold": between(18, 28),
            "droughtPenalty": between(0.4, 0.8),
        },
        "agri": {
            "a": between(8.0, 10.5),
            "p": between(0.4, 0.9),
            "capEnvExcess": between(45, 60),
            "cropThreshold": between(28, 38),
            "cropPenalty": between(0.35, 0.7),
        },
        "infra": {
            "a": between(7.0, 9.0),
            "p": between(0.45, 0.85),
            "capAgriExcess2": between(42, 58),
            "serviceThreshold": between(22, 32),
            "servicePenalty": between(0.45, 0.75),
        },
        "outsideOptionAllocation": {
            "hydro": between(30, 36),
            "agri": between(30, 36),
            "infra": between(28, 34),
        },
        "gridStep": 4,
    }


def normalize_outside(allocation):
    total = allocation["hydro"] + allocation["agri"] + allocation["infra"]
    scale = 100 / total
    return {
        "hydro": allocation["hydro"] * scale,
        "agri": allocation["agri"] * scale,
        "infra": allocation["infra"] * scale,
    }


def run_episode(seed: int = 42, max_turns: int = 9, llm_enabled: bool = True):
    rng = mulberry32(seed)
    params = sample_params(rng)
    params["outsideOptionAllocation"] = normalize_outside(
        params["outsideOptionAllocation"]
    )

    state = create_negotiation_state(params, max_turns)
    llm_client = create_llm_client_from_env() if llm_enabled else None
    messenger = create_persona_messenger(llm_client)

    while not state["finalX"]:
        proposer_id = state["agents"][state["proposerIndex"]]
        offer = propose_offer(state, rng)
        offer_rationale = messenger.offer_message(proposer_id, offer, state["xStar"])
        offer_message = (
            f"{proposer_id} proposes:\n\n"
            f"```json\n{format_offer_json(offer)}\n```\n\n{offer_rationale}"
        )
        state = step_negotiation(
            state,
            {
                "type": "offer",
                "proposerId": proposer_id,
                "offerX": offer,
                "message": offer_message,
            },
        )

        for agent_id in AGENTS:
            if agent_id == proposer_id:
                continue
            accept = evaluate_acceptance(state, agent_id, offer)
            response_rationale = messenger.response_message(agent_id, accept, offer)
            response_message = f"{agent_id}: {response_rationale}"
            state = step_negotiation(
                state,
                {
                    "type": "respond",
                    "agentId": agent_id,
                    "accept": accept,
                    "message": response_message,
                },
            )
            if state["finalX"]:
                break

    episode = {
        "id": f"water-council-{seed}",
        "seed": seed,
        "params": params,
        "xStar": state["xStar"],
        "turns": state["history"],
        "finalX": state["finalX"],
        "success": state["success"],
        "utilitiesOverTime": state["utilitiesOverTime"],
        "finalUtilities": compute_utilities(state["params"], state["finalX"]),
    }

    create_episode(episode)
    return episode


def write_episode(episode):
    output_path = Path(__file__).resolve().parents[1] / "ui" / "waterCouncil.latest.json"
    output_path.write_text(json.dumps(episode, indent=2))
    return output_path


if __name__ == "__main__":
    seed = int(os.getenv("SEED", "42"))
    try:
        episode = run_episode(seed=seed)
        output = write_episode(episode)
        print(f"Water Council episode saved to {output}")
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to run Water Council episode: {exc}")
        raise
