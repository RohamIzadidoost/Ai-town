from typing import Dict
from .state import GameState
from .actions import RoleID

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x

def utilities(s: GameState) -> Dict[RoleID, float]:
    # normalize a few proxies
    budget = clamp(s.budget_remaining)
    water_safety = clamp(1.0 - s.groundwater_risk)
    fairness = clamp(s.fairness_index)
    public = clamp(s.public_support)
    econ = clamp(1.0 - s.economic_stress)
    infra = clamp(s.infrastructure_status)
    restrict = clamp(1.0 - (s.restriction_level / 3.0))

    u_farmer = clamp(0.40 * restrict + 0.30 * econ + 0.15 * fairness + 0.15 * public)
    u_env = clamp(0.60 * water_safety + 0.20 * infra + 0.20 * (1.0 - restrict))
    u_cit = clamp(0.35 * fairness + 0.35 * public + 0.30 * econ)
    u_water = clamp(0.35 * water_safety + 0.25 * infra + 0.20 * budget + 0.20 * public)
    u_min = clamp(0.35 * public + 0.25 * fairness + 0.25 * water_safety + 0.15 * budget)

    return {
        "farmer": u_farmer,
        "environment": u_env,
        "citizen": u_cit,
        "water_minister": u_water,
        "minister": u_min,
    }
