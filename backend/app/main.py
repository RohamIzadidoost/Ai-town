import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .schemas import StartSimRequest
from .store import STORE
from .orchestrator import run_simulation

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/sim/start")
async def start_sim(req: StartSimRequest):
    session_id = str(uuid.uuid4())

    state = {
        "topic": req.topic,
        "rounds": req.rounds,
        "model": req.model,
        "temperature": req.temperature,
        "scenario": req.scenario or {},
        "transcript": [],
        "stop": False,
        "round_idx": 0,
        "ws_clients": set(),
        "task": None,
    }
    STORE.create(session_id, state)
    return {"session_id": session_id}

@app.post("/api/sim/stop/{session_id}")
async def stop_sim(session_id: str):
    state = STORE.get(session_id)
    if not state:
        return {"ok": False, "error": "session_not_found"}
    state["stop"] = True
    return {"ok": True}

@app.websocket("/ws/sim/{session_id}")
async def ws_sim(websocket: WebSocket, session_id: str):
    await websocket.accept()
    state = STORE.get(session_id)
    if not state:
        await websocket.send_json({"type": "error", "message": "session_not_found"})
        await websocket.close()
        return

    state["ws_clients"].add(websocket)

    async def ws_send(evt):
        # fan-out to all clients in this session
        dead = []
        for ws in list(state["ws_clients"]):
            try:
                await ws.send_json(evt)
            except Exception:
                dead.append(ws)
        for ws in dead:
            state["ws_clients"].discard(ws)

    try:
        # Start orchestration once per session when first client connects
        if state["task"] is None:
            state["task"] = asyncio.create_task(run_simulation(session_id, state, ws_send))

        while True:
            # keep connection alive; ignore any inbound messages for now
            await websocket.receive_text()

    except WebSocketDisconnect:
        state["ws_clients"].discard(websocket)
    except Exception:
        state["ws_clients"].discard(websocket)
        try:
            await websocket.close()
        except Exception:
            pass
