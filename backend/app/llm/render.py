from typing import Dict, List
from ..roles import ROLE_BY_ID
from ..game.actions import Action, RoleID
from ..game.state import GameState

def action_to_instruction(a: Action) -> str:
    if a.type == "PROPOSE":
        return f"Propose option '{a.option_id}' with clear reasoning and concrete steps."
    if a.type == "SUPPORT":
        return f"Support option '{a.option_id}' and justify why it helps your interests."
    if a.type == "OPPOSE":
        return f"Oppose option '{a.option_id}' and explain risks and downsides."
    if a.type == "AMEND":
        return f"Amend option '{a.option_id}' by adding '{a.amendment_type}'. Explain impact."
    if a.type == "OFFER_COMPROMISE":
        return f"Offer a compromise combining '{a.option_id_a}' and '{a.option_id_b}'."
    if a.type == "DEMAND_COMPENSATION":
        return f"Demand compensation level '{a.compensation_level}' and state conditions."
    if a.type == "RAISE_RISK":
        return f"Raise '{a.risk_type}' risk and propose mitigation."
    if a.type == "ASK_QUESTION":
        return f"Ask {a.target_role} a '{a.question_type}' question."
    if a.type == "REQUEST_METRICS":
        return f"Request KPI '{a.kpi}' and explain why it matters."
    if a.type == "CALL_VOTE":
        return "Call for a vote. Summarize options briefly and ask for alignment."
    if a.type == "DECIDE":
        return f"Make the final decision selecting '{a.option_id}'. Provide action plan + tradeoffs + metrics."
    return "Summarize progress and set next agenda."

def build_render_messages(role_id: RoleID, s: GameState, a: Action, transcript_tail: List[Dict]) -> List[Dict[str, str]]:
    role = ROLE_BY_ID[role_id]
    state_summary = {
        "budget_remaining": round(s.budget_remaining, 3),
        "restriction_level": s.restriction_level,
        "groundwater_risk": round(s.groundwater_risk, 3),
        "public_support": round(s.public_support, 3),
        "fairness_index": round(s.fairness_index, 3),
        "decision_locked": s.decision_locked,
        "decision_option": s.decision_option,
    }
    opt_summary = [{ "id": o.id, "name": o.name } for o in s.options]

    msgs = [
        {"role": "system", "content": role["system"]},
        {"role": "system", "content": f"Topic: {s.topic}"},
        {"role": "system", "content": f"State summary: {state_summary}"},
        {"role": "system", "content": f"Options: {opt_summary}"},
    ]

    for m in transcript_tail:
        msgs.append({"role": "user", "content": f'{m["role_name"]}: {m["content"]}'})

    instr = action_to_instruction(a)
    msgs.append({"role": "user", "content": f"Chosen action: {a.model_dump()}\nInstruction: {instr}\nWrite 4-8 sentences. Be specific. Do not invent numeric facts."})
    return msgs
