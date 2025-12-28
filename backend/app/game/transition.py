from typing import Optional
from .state import GameState
from .actions import Action

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x

def apply_support_delta(s: GameState, role: str, option_id: str, delta: float):
    s.support[role][option_id] = clamp(s.support[role][option_id] + delta)

def option_by_id(s: GameState, option_id: str):
    for o in s.options:
        if o.id == option_id:
            return o
    return None

def transition(s: GameState, role: str, a: Action) -> GameState:
    # Support / debate dynamics
    if a.type == "SUPPORT" and a.option_id:
        apply_support_delta(s, role, a.option_id, 0.15)
        s.public_support = clamp(s.public_support + 0.02)
    elif a.type == "OPPOSE" and a.option_id:
        apply_support_delta(s, role, a.option_id, -0.15)
        s.public_support = clamp(s.public_support - 0.02)
    elif a.type == "PROPOSE" and a.option_id:
        apply_support_delta(s, role, a.option_id, 0.10)
    elif a.type == "AMEND" and a.option_id and a.amendment_type:
        apply_support_delta(s, role, a.option_id, 0.07)
        if a.amendment_type == "subsidy":
            s.fairness_index = clamp(s.fairness_index + 0.06)
            s.budget_remaining -= 0.05
        if a.amendment_type == "phasing":
            s.public_support = clamp(s.public_support + 0.03)
        if a.amendment_type == "monitoring_kpis":
            s.infrastructure_status = clamp(s.infrastructure_status + 0.03)
    elif a.type == "OFFER_COMPROMISE" and a.option_id_a and a.option_id_b:
        apply_support_delta(s, role, a.option_id_a, 0.07)
        apply_support_delta(s, role, a.option_id_b, 0.07)
        s.public_support = clamp(s.public_support + 0.03)

    # Hard impacts when a proposal is pushed often (simple proxy)
    if a.option_id:
        o = option_by_id(s, a.option_id)
        if o:
            # Costs
            s.budget_remaining -= (0.03 * o.capex_cost + 0.02 * o.opex_cost)
            # Benefits
            s.groundwater_risk = clamp(s.groundwater_risk - 0.04 * o.water_saving - 0.03 * o.eco_benefit)
            # Political risk hits public support
            s.public_support = clamp(s.public_support - 0.03 * o.political_risk)

            if o.id == "quotas_enforce":
                s.restriction_level = min(3, s.restriction_level + 1)
                s.fairness_index = clamp(s.fairness_index - 0.05)

    # Budget deficit -> economic stress / feasibility perceptions
    if s.budget_remaining < 0:
        s.economic_stress = clamp(s.economic_stress + 0.08)
        s.public_support = clamp(s.public_support - 0.05)

    return s

def compute_option_score(s: GameState, option_id: str) -> float:
    # Weighted support across non-chair roles
    w = {
        "water_minister": 0.22,
        "farmer": 0.22,
        "environment": 0.22,
        "citizen": 0.22,
        "minister": 0.12,
    }
    sup = sum(w[r] * s.support[r].get(option_id, 0.0) for r in w)
    o = option_by_id(s, option_id)
    if not o:
        return sup
    # feasibility proxy: budget + infra
    feasibility = clamp(0.6 * clamp(s.budget_remaining) + 0.4 * s.infrastructure_status)
    return clamp(0.75 * sup + 0.25 * feasibility)

def call_vote(s: GameState) -> Optional[str]:
    best_id = None
    best = -1.0
    for o in s.options:
        sc = compute_option_score(s, o.id)
        if sc > best:
            best = sc
            best_id = o.id
    # lock if sufficiently strong
    if best_id and best >= 0.65:
        s.decision_locked = True
        s.decision_option = best_id
    return best_id
