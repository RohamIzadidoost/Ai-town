from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from .actions import RoleID

class PolicyOption(BaseModel):
    id: str
    name: str
    description: str
    capex_cost: float = Field(ge=0.0, le=1.0)
    opex_cost: float = Field(ge=0.0, le=1.0)
    water_saving: float = Field(ge=0.0, le=1.0)
    political_risk: float = Field(ge=0.0, le=1.0)
    eco_benefit: float = Field(ge=0.0, le=1.0)

class GameState(BaseModel):
    t: int = 0
    round_idx: int = 1
    speaker: RoleID = "water_minister"

    topic: str
    options: List[PolicyOption]

    support: Dict[RoleID, Dict[str, float]] = Field(default_factory=dict)

    budget_remaining: float = 1.0
    infrastructure_status: float = 0.5
    restriction_level: int = 0
    groundwater_risk: float = 0.6
    economic_stress: float = 0.4

    public_support: float = 0.55
    fairness_index: float = 0.55

    decision_locked: bool = False
    decision_option: Optional[str] = None

def init_support(options: List[PolicyOption]) -> Dict[RoleID, Dict[str, float]]:
    base = {o.id: 0.25 for o in options}
    return {
        "water_minister": dict(base),
        "farmer": dict(base),
        "environment": dict(base),
        "citizen": dict(base),
        "minister": dict(base),
    }

def init_state(topic: str, options: List[PolicyOption]) -> GameState:
    s = GameState(topic=topic, options=options)
    s.support = init_support(options)
    return s
