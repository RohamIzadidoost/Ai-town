import json
import os
from dataclasses import dataclass
from typing import Optional
from urllib import request, error

DEFAULT_MODEL = "gpt-4o-mini"


@dataclass
class OpenAiClient:
    api_key: str
    base_url: str = "https://api.openai.com"
    model: str = DEFAULT_MODEL
    timeout_ms: int = 12000

    def complete(self, system: str, user: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.4,
            "max_tokens": 160,
        }
        url = f"{self.base_url.rstrip('/')}/v1/chat/completions"
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout_ms / 1000) as resp:
                body = resp.read().decode("utf-8")
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8")
            raise RuntimeError(f"LLM request failed: {exc.code} {body}") from exc

        payload = json.loads(body)
        content = (
            payload.get("choices", [{}])[0].get("message", {}).get("content")
        )
        if not isinstance(content, str):
            raise RuntimeError("LLM response missing content")
        return content.strip()


def create_openai_client(
    *,
    api_key: str,
    base_url: str = "https://api.openai.com",
    model: str = DEFAULT_MODEL,
    timeout_ms: int = 12000,
) -> Optional[OpenAiClient]:
    if not api_key:
        return None
    return OpenAiClient(
        api_key=api_key, base_url=base_url, model=model, timeout_ms=timeout_ms
    )


def create_llm_client_from_env() -> Optional[OpenAiClient]:
    if os.getenv("LLM_ENABLED") == "false":
        return None
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("LLM_API_KEY")
    if not api_key:
        return None
    return create_openai_client(
        api_key=api_key,
        base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com"),
        model=os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
        timeout_ms=int(os.getenv("LLM_TIMEOUT_MS", "12000")),
    )
