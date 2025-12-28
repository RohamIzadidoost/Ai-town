import asyncio
from typing import Dict, List, Any, Optional

class SessionStore:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.locks: Dict[str, asyncio.Lock] = {}

    def create(self, session_id: str, state: Dict[str, Any]):
        self.sessions[session_id] = state
        self.locks[session_id] = asyncio.Lock()

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.sessions.get(session_id)

    def delete(self, session_id: str):
        self.sessions.pop(session_id, None)
        self.locks.pop(session_id, None)

    def lock(self, session_id: str) -> asyncio.Lock:
        return self.locks[session_id]

STORE = SessionStore()
