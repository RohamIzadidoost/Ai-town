import asyncio
from typing import Dict, List, Any
from .roles import ROLE_ORDER, ROLE_BY_ID
from .ollama_client import stream_chat

def format_turn_instruction(role_id: str, round_idx: int, total_rounds: int, topic: str) -> str:
    if role_id != "minister":
        return (
            f"Round {round_idx}/{total_rounds}. Topic: {topic}.\n"
            "Respond in this structure:\n"
            "1) Position\n"
            "2) Evidence/Reasoning\n"
            "3) Proposal\n"
            "4) Critique (of one other proposal)\n"
            "5) Question (ask one question)\n"
            "Keep it concise but specific."
        )
    return (
        f"Round {round_idx}/{total_rounds}. Topic: {topic}.\n"
        "If this is NOT the final round: briefly summarize points of agreement/disagreement and set agenda for next round.\n"
        "If this IS the final round: produce FINAL DECISION in JSON-like structure:\n"
        "{\n"
        '  "decision_option": "...",\n'
        '  "action_plan": ["...","..."],\n'
        '  "tradeoffs": "...",\n'
        '  "risks": ["...","..."],\n'
        '  "metrics": ["...","..."]\n'
        "}\n"
        "Then provide a short plain-language explanation after the structure."
    )

def build_messages(role_id: str, state: Dict[str, Any]) -> List[Dict[str, str]]:
    role = ROLE_BY_ID[role_id]
    topic = state["topic"]
    scenario = state.get("scenario") or {}

    system = role["system"]
    world = {
        "topic": topic,
        "scenario": scenario,
    }

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": system},
        {"role": "system", "content": f"World state (do not invent facts): {world}"},
    ]

    # Transcript
    for m in state["transcript"]:
        messages.append({"role": "user", "content": f'{m["role_name"]}: {m["content"]}'})

    # Current instruction
    instr = format_turn_instruction(
        role_id=role_id,
        round_idx=state["round_idx"],
        total_rounds=state["rounds"],
        topic=topic,
    )
    messages.append({"role": "user", "content": instr})
    return messages

async def run_simulation(session_id: str, state: Dict[str, Any], ws_send):
    # state fields: topic, rounds, model, temperature, transcript(list), stop(bool), round_idx(int)
    for r in range(1, state["rounds"] + 1):
        state["round_idx"] = r

        for role_id in ROLE_ORDER:
            if state.get("stop"):
                await ws_send({"type": "stopped"})
                return

            role = ROLE_BY_ID[role_id]
            await ws_send({"type": "turn_start", "role": role_id})

            messages = build_messages(role_id, state)

            acc = []
            async for delta in stream_chat(
                model=state["model"],
                messages=messages,
                temperature=state["temperature"],
            ):
                acc.append(delta)
                await ws_send({"type": "delta", "role": role_id, "text": delta})

            final = "".join(acc).strip()
            await ws_send({"type": "turn_end", "role": role_id, "message": final})

            state["transcript"].append(
                {"role_id": role_id, "role_name": role["name"], "content": final}
            )

    await ws_send({"type": "done"})
