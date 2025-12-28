import random
from typing import List
from .actions import Action, RoleID, allowed_actions

# Baseline mixed strategy. Later you replace this with learned weights.
# This version is "utility-aware" via simple heuristics to make it look like playing.

def choose_action(role: RoleID, option_ids: List[str], round_idx: int, last_decision_locked: bool) -> Action:
    allow = allowed_actions()[role]

    # Minister logic
    if role == "minister":
        if last_decision_locked and "DECIDE" in allow:
            return Action(type="DECIDE", option_id=random.choice(option_ids))
        if round_idx >= 2 and "CALL_VOTE" in allow:
            return Action(type="CALL_VOTE")
        # occasionally force compromise
        if "OFFER_COMPROMISE" in allow and len(option_ids) >= 2 and random.random() < 0.35:
            a, b = random.sample(option_ids, 2)
            return Action(type="OFFER_COMPROMISE", option_id_a=a, option_id_b=b)
        return Action(type="SUMMARIZE")

    # Non-minister roles
    r = random.random()
    if "PROPOSE" in allow and r < 0.25:
        return Action(type="PROPOSE", option_id=random.choice(option_ids))
    if "AMEND" in allow and r < 0.45:
        return Action(type="AMEND", option_id=random.choice(option_ids), amendment_type=random.choice(
            ["subsidy","phasing","monitoring_kpis","enforcement_soft"]
        ))
    if "SUPPORT" in allow and r < 0.70:
        return Action(type="SUPPORT", option_id=random.choice(option_ids))
    if "OPPOSE" in allow and r < 0.85:
        return Action(type="OPPOSE", option_id=random.choice(option_ids))
    if "REQUEST_METRICS" in allow and r < 0.93:
        return Action(type="REQUEST_METRICS", kpi=random.choice(["consumption","groundwater","leak_rate","prices"]))
    if "ASK_QUESTION" in allow:
        return Action(type="ASK_QUESTION", target_role="minister", question_type=random.choice(["feasibility","fairness","metrics"]))
    return Action(type="SUMMARIZE")
