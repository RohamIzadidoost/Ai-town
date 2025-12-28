import json
from typing import Dict, List, Optional
from .ollama_client import chat_json
from ..game.state import GameState
from ..game.actions import RoleID

def judge_prompt(s: GameState, round_transcript: List[Dict]) -> List[Dict[str, str]]:
    rubric = (
        "You are an evaluator for a policy deliberation.\n"
        "Score ONLY based on given transcript and state summary.\n"
        "Return STRICT JSON with keys:\n"
        "realism, public_acceptance, fairness_perception, conflict_level,\n"
        "persuasion (object role->0..1), coherence (object role->0..1), notes.\n"
        "All numeric scores must be in [0,1]. No extra text."
    )
    state_summary = {
        "budget_remaining": s.budget_remaining,
        "restriction_level": s.restriction_level,
        "groundwater_risk": s.groundwater_risk,
        "public_support": s.public_support,
        "fairness_index": s.fairness_index,
        "decision_locked": s.decision_locked,
        "decision_option": s.decision_option,
    }
    text = "\n".join([f'{m["role_name"]}: {m["content"]}' for m in round_transcript])

    return [
        {"role": "system", "content": rubric},
        {"role": "user", "content": f"State summary: {state_summary}\nTranscript:\n{text}"},
    ]

def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def safe_parse_json(s: str) -> Optional[Dict]:
    try:
        return json.loads(s)
    except Exception:
        return None

async def judge_round(model: str, s: GameState, round_transcript: List[Dict]) -> Dict:
    msgs = judge_prompt(s, round_transcript)
    j = await chat_json(model=model, messages=msgs, temperature=0.2)
    content = (j.get("message") or {}).get("content") or ""
    obj = safe_parse_json(content)
    if not isinstance(obj, dict):
        # fallback conservative scores
        return {
            "realism": 0.5, "public_acceptance": 0.5, "fairness_perception": 0.5, "conflict_level": 0.5,
            "persuasion": {}, "coherence": {}, "notes": "Judge JSON parse failed."
        }

    # sanitize
    for k in ["realism","public_acceptance","fairness_perception","conflict_level"]:
        obj[k] = clamp01(float(obj.get(k, 0.5)))
    obj["persuasion"] = obj.get("persuasion", {}) if isinstance(obj.get("persuasion", {}), dict) else {}
    obj["coherence"] = obj.get("coherence", {}) if isinstance(obj.get("coherence", {}), dict) else {}
    obj["notes"] = str(obj.get("notes", ""))[:400]
    return obj
