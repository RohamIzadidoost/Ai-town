import httpx
import json
from typing import AsyncGenerator, Dict, List, Any, Optional

OLLAMA_URL = "http://localhost:11434/api/chat"

async def stream_chat(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.4,
) -> AsyncGenerator[str, None]:
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
        },
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        async with client.stream("POST", OLLAMA_URL, json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue

                # Ollama chat streaming typically uses: {"message":{"role":"assistant","content":"..."}, "done":false}
                msg = obj.get("message") or {}
                delta = msg.get("content") or ""
                if delta:
                    yield delta

                if obj.get("done") is True:
                    break
