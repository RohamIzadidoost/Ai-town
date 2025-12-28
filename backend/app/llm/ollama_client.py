import httpx
import json
from typing import AsyncGenerator, Dict, List

OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"

async def stream_chat(model: str, messages: List[Dict[str, str]], temperature: float = 0.4) -> AsyncGenerator[str, None]:
    payload = {"model": model, "messages": messages, "stream": True, "options": {"temperature": temperature}}
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
        async with client.stream("POST", OLLAMA_CHAT_URL, json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                msg = obj.get("message") or {}
                delta = msg.get("content") or ""
                if delta:
                    yield delta
                if obj.get("done") is True:
                    break

async def chat_json(model: str, messages: List[Dict[str, str]], temperature: float = 0.2) -> Dict:
    payload = {"model": model, "messages": messages, "stream": False, "options": {"temperature": temperature}}
    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
        r = await client.post(OLLAMA_CHAT_URL, json=payload)
        r.raise_for_status()
        return r.json()
