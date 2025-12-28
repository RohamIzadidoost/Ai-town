from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, List

RoleID = Literal["water_minister", "farmer", "environment", "citizen", "minister"]

AmendmentType = Literal["subsidy", "phasing", "enforcement_soft", "enforcement_hard", "monitoring_kpis"]
RiskType = Literal["ecological", "economic", "political", "implementation"]
QuestionType = Literal["feasibility", "fairness", "cost", "timeline", "metrics"]
KPI = Literal["leak_rate", "consumption", "groundwater", "prices", "farm_output"]
CompLevel = Literal["low", "mid", "high"]

ActionType = Literal[
    "PROPOSE","SUPPORT","OPPOSE","AMEND","OFFER_COMPROMISE","DEMAND_COMPENSATION",
    "RAISE_RISK","ASK_QUESTION","REQUEST_METRICS","SUMMARIZE","CALL_VOTE","DECIDE"
]

class Action(BaseModel):
    type: ActionType
    option_id: Optional[str] = None
    option_id_a: Optional[str] = None
    option_id_b: Optional[str] = None
    amendment_type: Optional[AmendmentType] = None
    risk_type: Optional[RiskType] = None
    target_role: Optional[RoleID] = None
    question_type: Optional[QuestionType] = None
    kpi: Optional[KPI] = None
    compensation_level: Optional[CompLevel] = None

def allowed_actions() -> Dict[RoleID, List[ActionType]]:
    return {
        "water_minister": ["PROPOSE","SUPPORT","OPPOSE","AMEND","RAISE_RISK","ASK_QUESTION","REQUEST_METRICS","SUMMARIZE"],
        "farmer": ["PROPOSE","SUPPORT","OPPOSE","AMEND","DEMAND_COMPENSATION","RAISE_RISK","ASK_QUESTION","SUMMARIZE"],
        "environment": ["PROPOSE","SUPPORT","OPPOSE","AMEND","RAISE_RISK","ASK_QUESTION","REQUEST_METRICS","SUMMARIZE"],
        "citizen": ["SUPPORT","OPPOSE","RAISE_RISK","ASK_QUESTION","REQUEST_METRICS","SUMMARIZE"],
        "minister": ["SUMMARIZE","CALL_VOTE","OFFER_COMPROMISE","REQUEST_METRICS","DECIDE"],
    }
