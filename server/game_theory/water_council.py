import math
from typing import Callable

TOTAL_WATER = 100
AGENTS = ["hydrologist", "agriculture", "infrastructure"]


def clamp_allocation(x: dict) -> dict:
    return {
        "hydro": max(0, x["hydro"]),
        "agri": max(0, x["agri"]),
        "infra": max(0, x["infra"]),
    }


def project_to_simplex(x: dict) -> dict:
    values = [x["hydro"], x["agri"], x["infra"]]
    sorted_vals = sorted(values, reverse=True)
    cumulative = 0
    rho = -1
    for i, value in enumerate(sorted_vals):
        cumulative += value
        theta = (cumulative - TOTAL_WATER) / (i + 1)
        if value - theta > 0:
            rho = i
    if rho == -1:
        equal = TOTAL_WATER / 3
        return {"hydro": equal, "agri": equal, "infra": equal}
    theta = (sum(sorted_vals[: rho + 1]) - TOTAL_WATER) / (rho + 1)
    projected = [max(0, v - theta) for v in values]
    return {"hydro": projected[0], "agri": projected[1], "infra": projected[2]}


def compute_utilities(params: dict, x: dict) -> dict:
    allocation = clamp_allocation(x)
    hydro_base = params["hydro"]["a"] * math.log(1 + allocation["hydro"])
    hydro_penalty = params["hydro"]["p"] * max(
        0, allocation["agri"] - params["hydro"]["capAgriExcess"]
    )
    hydro_drought_penalty = params["hydro"]["droughtPenalty"] * max(
        0, params["hydro"]["droughtThreshold"] - allocation["hydro"]
    )

    agri_base = params["agri"]["a"] * math.log(1 + allocation["agri"])
    agri_penalty = params["agri"]["p"] * max(
        0, allocation["hydro"] - params["agri"]["capEnvExcess"]
    )
    agri_crop_penalty = params["agri"]["cropPenalty"] * max(
        0, params["agri"]["cropThreshold"] - allocation["agri"]
    )

    infra_base = params["infra"]["a"] * math.log(1 + allocation["infra"])
    infra_penalty = params["infra"]["p"] * max(
        0, allocation["agri"] - params["infra"]["capAgriExcess2"]
    )
    infra_service_penalty = params["infra"]["servicePenalty"] * max(
        0, params["infra"]["serviceThreshold"] - allocation["infra"]
    )

    return {
        "hydro": hydro_base - hydro_penalty - hydro_drought_penalty,
        "agri": agri_base - agri_penalty - agri_crop_penalty,
        "infra": infra_base - infra_penalty - infra_service_penalty,
    }


def compute_outside_options(params: dict) -> dict:
    return compute_utilities(params, params["outsideOptionAllocation"])


def nash_objective(utilities: dict, outside: dict) -> float:
    surplus = {
        "hydro": utilities["hydro"] - outside["hydro"],
        "agri": utilities["agri"] - outside["agri"],
        "infra": utilities["infra"] - outside["infra"],
    }
    if surplus["hydro"] <= 0 or surplus["agri"] <= 0 or surplus["infra"] <= 0:
        return float("-inf")
    return (
        math.log(surplus["hydro"])
        + math.log(surplus["agri"])
        + math.log(surplus["infra"])
    )


def solve_nash_bargaining(params: dict) -> dict:
    outside = compute_outside_options(params)
    step = params.get("gridStep") or 5
    best = {"hydro": 33.34, "agri": 33.33, "infra": 33.33}
    best_score = float("-inf")

    h = 0
    while h <= TOTAL_WATER:
        a = 0
        while a <= TOTAL_WATER - h:
            i = TOTAL_WATER - h - a
            candidate = {"hydro": h, "agri": a, "infra": i}
            utilities = compute_utilities(params, candidate)
            score = nash_objective(utilities, outside)
            if score > best_score:
                best_score = score
                best = candidate
            a += step
        h += step

    current = best
    for iteration in range(40):
        base_utilities = compute_utilities(params, current)
        base_score = nash_objective(base_utilities, outside)
        if not math.isfinite(base_score):
            break
        gradient = [0.0, 0.0, 0.0]
        eps = 0.05
        for idx, key in enumerate(["hydro", "agri", "infra"]):
            plus = {**current, key: current[key] + eps}
            minus = {**current, key: max(0, current[key] - eps)}
            plus_proj = project_to_simplex(plus)
            minus_proj = project_to_simplex(minus)
            plus_score = nash_objective(
                compute_utilities(params, plus_proj), outside
            )
            minus_score = nash_objective(
                compute_utilities(params, minus_proj), outside
            )
            gradient[idx] = (plus_score - minus_score) / (2 * eps)
        step_size = 0.8 / (1 + iteration / 10)
        updated = {
            "hydro": current["hydro"] + step_size * gradient[0],
            "agri": current["agri"] + step_size * gradient[1],
            "infra": current["infra"] + step_size * gradient[2],
        }
        current = project_to_simplex(updated)

    return current


def compute_acceptance_threshold(state: dict, offer: dict) -> dict:
    mix = {"xStar": 0.6, "best": 0.3, "outside": 0.1}
    best = state["bestOffer"] or state["xStar"]
    threshold = {
        "hydro": mix["xStar"] * state["xStar"]["hydro"]
        + mix["best"] * best["hydro"]
        + mix["outside"] * state["outsideOptionAllocation"]["hydro"],
        "agri": mix["xStar"] * state["xStar"]["agri"]
        + mix["best"] * best["agri"]
        + mix["outside"] * state["outsideOptionAllocation"]["agri"],
        "infra": mix["xStar"] * state["xStar"]["infra"]
        + mix["best"] * best["infra"]
        + mix["outside"] * state["outsideOptionAllocation"]["infra"],
    }
    return project_to_simplex(threshold)


def should_accept(params: dict, offer: dict, threshold: dict, agent_id: str) -> bool:
    offer_utilities = compute_utilities(params, offer)
    threshold_utilities = compute_utilities(params, threshold)
    if agent_id == "hydrologist":
        return offer_utilities["hydro"] >= threshold_utilities["hydro"]
    if agent_id == "agriculture":
        return offer_utilities["agri"] >= threshold_utilities["agri"]
    return offer_utilities["infra"] >= threshold_utilities["infra"]


def update_best_offer(state: dict, offer: dict) -> dict:
    outside = state["outsideUtilities"]
    candidate_score = nash_objective(compute_utilities(state["params"], offer), outside)
    if not state["bestOffer"]:
        return {**state, "bestOffer": offer}
    best_score = nash_objective(
        compute_utilities(state["params"], state["bestOffer"]), outside
    )
    if candidate_score > best_score:
        return {**state, "bestOffer": offer}
    return state


def step_negotiation(state: dict, action: dict) -> dict:
    if state["finalX"]:
        return state

    if action["type"] == "offer":
        offer = project_to_simplex(action["offerX"])
        next_state = update_best_offer({**state, "currentOffer": offer}, offer)
        accept_flags = {
            "hydrologist": action["proposerId"] == "hydrologist",
            "agriculture": action["proposerId"] == "agriculture",
            "infrastructure": action["proposerId"] == "infrastructure",
        }
        utilities = compute_utilities(state["params"], offer)
        turn = {
            "turn": state["turn"],
            "proposerId": action["proposerId"],
            "offerX": offer,
            "acceptFlags": accept_flags,
            "utilities": utilities,
            "messages": [action["message"]],
        }
        return {
            **next_state,
            "history": [*state["history"], turn],
            "utilitiesOverTime": [
                *state["utilitiesOverTime"],
                {"turn": state["turn"], "utilities": utilities},
            ],
        }

    if not state["currentOffer"]:
        return state

    history = [*state["history"]]
    last_turn = history[-1]
    last_turn["acceptFlags"][action["agentId"]] = action["accept"]
    last_turn["messages"] = [*last_turn["messages"], action["message"]]

    all_responded = all(agent in last_turn["acceptFlags"] for agent in AGENTS)
    all_accepted = (
        last_turn["acceptFlags"]["hydrologist"]
        and last_turn["acceptFlags"]["agriculture"]
        and last_turn["acceptFlags"]["infrastructure"]
    )

    if all_responded and all_accepted:
        return {
            **state,
            "history": history,
            "finalX": state["currentOffer"],
            "success": True,
        }

    if all_responded and not all_accepted:
        next_turn = state["turn"] + 1
        if next_turn >= state["maxTurns"]:
            return {
                **state,
                "history": history,
                "finalX": state["outsideOptionAllocation"],
                "success": False,
            }
        return {
            **state,
            "history": history,
            "turn": next_turn,
            "proposerIndex": (state["proposerIndex"] + 1) % len(state["agents"]),
            "currentOffer": None,
        }

    return {**state, "history": history}


def mulberry32(seed: int) -> Callable[[], float]:
    t = seed & 0xFFFFFFFF

    def rng() -> float:
        nonlocal t
        t = (t + 0x6D2B79F5) & 0xFFFFFFFF
        r = (t ^ (t >> 15)) * (1 | t)
        r &= 0xFFFFFFFF
        r ^= r + ((r ^ (r >> 7)) * (61 | r) & 0xFFFFFFFF)
        return ((r ^ (r >> 14)) & 0xFFFFFFFF) / 4294967296

    return rng


def interpolate(from_x: dict, to_x: dict, alpha: float) -> dict:
    return {
        "hydro": from_x["hydro"] + (to_x["hydro"] - from_x["hydro"]) * alpha,
        "agri": from_x["agri"] + (to_x["agri"] - from_x["agri"]) * alpha,
        "infra": from_x["infra"] + (to_x["infra"] - from_x["infra"]) * alpha,
    }


def propose_offer(state: dict, rng: Callable[[], float]) -> dict:
    base = state["currentOffer"] or state["outsideOptionAllocation"]
    drift = interpolate(base, state["xStar"], 0.6)
    jitter = lambda: (rng() - 0.5) * 6
    candidate = {
        "hydro": drift["hydro"] + jitter(),
        "agri": drift["agri"] + jitter(),
        "infra": drift["infra"] + jitter(),
    }
    return project_to_simplex(candidate)


def create_negotiation_state(params: dict, max_turns: int = 9) -> dict:
    x_star = solve_nash_bargaining(params)
    outside_utilities = compute_outside_options(params)
    return {
        "params": params,
        "xStar": x_star,
        "outsideOptionAllocation": params["outsideOptionAllocation"],
        "outsideUtilities": outside_utilities,
        "currentOffer": None,
        "bestOffer": None,
        "turn": 0,
        "maxTurns": max_turns,
        "proposerIndex": 0,
        "agents": [*AGENTS],
        "history": [],
        "finalX": None,
        "success": None,
        "utilitiesOverTime": [],
    }


def evaluate_acceptance(state: dict, agent_id: str, offer: dict) -> bool:
    threshold = compute_acceptance_threshold(state, offer)
    return should_accept(state["params"], offer, threshold, agent_id)
