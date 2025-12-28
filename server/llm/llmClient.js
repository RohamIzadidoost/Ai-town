const DEFAULT_MODEL = "gpt-4o-mini";

function createOpenAiClient({ apiKey, baseUrl = "https://api.openai.com", model = DEFAULT_MODEL, timeoutMs = 12000 } = {}) {
  if (!apiKey) {
    return null;
  }

  return {
    model,
    async complete({ system, user }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.4,
            max_tokens: 160,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`LLM request failed: ${response.status} ${text}`);
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== "string") {
          throw new Error("LLM response missing content");
        }
        return content.trim();
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function createLlmClientFromEnv() {
  if (process.env.LLM_ENABLED === "false") {
    return null;
  }
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    return null;
  }
  return createOpenAiClient({
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 12000),
  });
}

module.exports = {
  createOpenAiClient,
  createLlmClientFromEnv,
};
