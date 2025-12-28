import asyncio
from typing import Dict, Any, List
from .roles import ROLE_BY_ID
from .scenario.defaults import default_options
from .game.state import init_state, GameState
from .game.transition import transition, call_vote
from .game.policy import choose_action
from .game.utilities import utilities
from .llm.render import build_render_messages
from .llm.ollama_client import stream_chat
from .llm.judge import judge_round

ROLE_ORDER = ["water_minister", "farmer", "environment", "citizen", "minister"]

def fuse_soft_into_state(s: GameState, judge: Dict):
    # hybrid fusion
    s.public_support = min(1.0, max(0.0, 0.60 * s.public_support + 0.40 * float(judge.get("public_acceptance", 0.5))))
    s.fairness_index = min(1.0, max(0.0, 0.70 * s.fairness_index + 0.30 * float(judge.get("fairness_perception", 0.5))))

async def run_simulation(session_id: str, state: Dict[str, Any], ws_send):
    # Init structured state
    opts = default_options()
    gs = init_state(topic=state["topic"], options=opts)

    transcript: List[Dict] = []
    state["transcript"] = transcript
    state["game_state"] = gs

    await ws_send({"type": "session_start", "state": gs.model_dump()})

    for r in range(1, state["rounds"] + 1):
        gs.round_idx = r
        round_msgs = []

        for role_id in ROLE_ORDER:
            if state.get("stop"):
                await ws_send({"type": "stopped"})
                return

            gs.t += 1
            gs.speaker = role_id
            await ws_send({"type": "turn_start", "role": role_id, "state": gs.model_dump()})

            option_ids = [o.id for o in gs.options]
            a = choose_action(role_id, option_ids, round_idx=r, last_decision_locked=gs.decision_locked)

            await ws_send({"type": "action_selected", "role": role_id, "action": a.model_dump()})

            # Render message using LLM based on action
            tail = transcript[-6:]  # small context window
            msgs = build_render_messages(role_id, gs, a, tail)

            acc = []
            async for delta in stream_chat(model=state["model"], messages=msgs, temperature=state["temperature"]):
                acc.append(delta)
                await ws_send({"type": "delta", "role": role_id, "text": delta})

            final = "".join(acc).strip()
            await ws_send({"type": "turn_end", "role": role_id, "message": final})

            turn = {
                "role_id": role_id,
                "role_name": ROLE_BY_ID[role_id]["name"],
                "action": a.model_dump(),
                "content": final,
                "round_idx": r,
                "t": gs.t,
            }
            transcript.append(turn)
            round_msgs.append(turn)

            # Apply deterministic transition
            gs = transition(gs, role_id, a)
            await ws_send({"type": "state_update", "state": gs.model_dump()})

            # If Minister decides, end early
            if role_id == "minister" and a.type == "DECIDE":
                gs.decision_locked = True
                gs.decision_option = a.option_id or gs.decision_option
                await ws_send({"type": "decision", "data": {"decision_option": gs.decision_option}, "state": gs.model_dump()})
                pay = utilities(gs)
                await ws_send({"type": "payoffs", "data": {"utilities": pay}, "state": gs.model_dump()})
                await ws_send({"type": "done"})
                return

        # End of round: judge + fuse
        judge = await judge_round(model=state["model"], s=gs, round_transcript=round_msgs)
        fuse_soft_into_state(gs, judge)
        await ws_send({"type": "judge_scores", "data": judge, "state": gs.model_dump()})

        # Minister vote-lock heuristic
        best = call_vote(gs)
        await ws_send({"type": "round_end", "data": {"best_option": best}, "state": gs.model_dump()})

        # If decision locked, next minister likely decides
        if gs.decision_locked and r < state["rounds"]:
            continue

    # If no DECIDE triggered, finalize with best option
    if not gs.decision_option:
        best = call_vote(gs)
        gs.decision_option = best

    await ws_send({"type": "decision", "data": {"decision_option": gs.decision_option}, "state": gs.model_dump()})
    pay = utilities(gs)
    await ws_send({"type": "payoffs", "data": {"utilities": pay}, "state": gs.model_dump()})
    await ws_send({"type": "done"})
