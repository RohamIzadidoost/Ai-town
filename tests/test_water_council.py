from server.game_theory.water_council import (
    compute_utilities,
    create_negotiation_state,
    evaluate_acceptance,
    mulberry32,
    propose_offer,
    solve_nash_bargaining,
    step_negotiation,
)


def params():
    return {
        "hydro": {
            "a": 8.5,
            "p": 0.8,
            "capAgriExcess": 50,
            "droughtThreshold": 24,
            "droughtPenalty": 0.6,
        },
        "agri": {
            "a": 9.2,
            "p": 0.7,
            "capEnvExcess": 52,
            "cropThreshold": 32,
            "cropPenalty": 0.5,
        },
        "infra": {
            "a": 8.2,
            "p": 0.65,
            "capAgriExcess2": 54,
            "serviceThreshold": 28,
            "servicePenalty": 0.55,
        },
        "outsideOptionAllocation": {"hydro": 34, "agri": 33, "infra": 33},
        "gridStep": 5,
    }


def test_solver_returns_feasible_allocation():
    solution = solve_nash_bargaining(params())
    total = solution["hydro"] + solution["agri"] + solution["infra"]
    assert solution["hydro"] >= 0
    assert solution["agri"] >= 0
    assert solution["infra"] >= 0
    assert abs(total - 100) < 1e-6


def test_nash_product_improves_vs_random_allocations():
    config = params()
    solution = solve_nash_bargaining(config)
    solution_utilities = compute_utilities(config, solution)
    outside_utilities = compute_utilities(config, config["outsideOptionAllocation"])
    solution_product = (
        (solution_utilities["hydro"] - outside_utilities["hydro"])
        * (solution_utilities["agri"] - outside_utilities["agri"])
        * (solution_utilities["infra"] - outside_utilities["infra"])
    )

    better_count = 0
    rng = mulberry32(7)
    for _ in range(30):
        hydro = int(rng() * 100)
        agri = int(rng() * (100 - hydro))
        infra = 100 - hydro - agri
        utilities = compute_utilities(config, {"hydro": hydro, "agri": agri, "infra": infra})
        product = (
            (utilities["hydro"] - outside_utilities["hydro"])
            * (utilities["agri"] - outside_utilities["agri"])
            * (utilities["infra"] - outside_utilities["infra"])
        )
        if solution_product >= product:
            better_count += 1
    assert better_count >= 20


def test_negotiation_converges_within_turn_limit():
    config = params()
    rng = mulberry32(99)
    state = create_negotiation_state(config, 9)
    while not state["finalX"]:
        proposer_id = state["agents"][state["proposerIndex"]]
        offer = propose_offer(state, rng)
        state = step_negotiation(
            state,
            {"type": "offer", "proposerId": proposer_id, "offerX": offer, "message": "offer"},
        )
        for agent_id in state["agents"]:
            if agent_id == proposer_id:
                continue
            accept = evaluate_acceptance(state, agent_id, offer)
            state = step_negotiation(
                state,
                {
                    "type": "respond",
                    "agentId": agent_id,
                    "accept": accept,
                    "message": "response",
                },
            )
            if state["finalX"]:
                break
    assert state["turn"] <= state["maxTurns"]
