const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_TURNS = 8;
const MODEL = process.env.OLLAMA_MODEL || "llama3";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

const agents = [
  {
    id: "minister",
    name: "Minister",
    system:
      "Minister (chair/policy). Goal: converge to an implementable policy; time-box debate; request numbers; decide. Must produce FINAL DECISION within MAX_TURNS.",
  },
  {
    id: "hydrologist",
    name: "Hydrologist",
    system:
      "Hydrologist. Goal: environmental flow + aquifer sustainability; thresholds; monitoring.",
  },
  {
    id: "farmer",
    name: "Farmer",
    system:
      "Farmer (agriculture). Goal: protect crop yield; quantify irrigation needs; efficiency + compensation options.",
  },
  {
    id: "infra",
    name: "Infrastructure Expert",
    system:
      "Infrastructure Expert. Goal: reliable city/industry supply; reservoir ops; leakage reduction; reuse; costs/timelines.",
  },
];

const staticRoot = path.join(__dirname, "public");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/solve") {
    return handleSolve(req, res);
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`AI Town running at http://${HOST}:${PORT}`);
});

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(staticRoot, safePath);

  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const contentType =
      ext === ".html"
        ? "text/html"
        : ext === ".css"
        ? "text/css"
        : ext === ".js"
        ? "application/javascript"
        : "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

async function handleSolve(req, res) {
  try {
    const body = await readBody(req);
    const { issue, maxTurns } = JSON.parse(body || "{}");
    const turnsCap = Number(maxTurns) > 0 ? Math.min(Number(maxTurns), 16) : MAX_TURNS;

    if (!issue || typeof issue !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Issue is required" }));
      return;
    }

    const result = await runDebate(issue.trim(), turnsCap);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error("Solve error", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Failed to run agents. Is Ollama running with the llama3 model?",
        detail: err.message,
      })
    );
  }
}

async function runDebate(issue, maxTurns) {
  const conversation = [];
  let turnCount = 0;
  let finalDecision = null;

  while (turnCount < maxTurns && !finalDecision) {
    for (const agent of agents) {
      if (turnCount >= maxTurns || finalDecision) break;
      const prompt = buildPrompt(agent, issue, conversation, turnCount, maxTurns);
      const response = await callOllama(agent, prompt, maxTurns);
      const content = response.trim();

      conversation.push({ speaker: agent.name, content });
      turnCount += 1;

      if (agent.id === "minister" && content.toUpperCase().includes("FINAL DECISION")) {
        finalDecision = content;
      }
    }
  }

  return {
    issue,
    maxTurns,
    turnsUsed: turnCount,
    finalDecision,
    conversation,
  };
}

function buildPrompt(agent, issue, conversation, turnCount, maxTurns) {
  const log =
    conversation.length === 0
      ? "No prior discussion."
      : conversation.map((m, idx) => `${idx + 1}. ${m.speaker}: ${m.content}`).join("\n");

  const urgency =
    agent.id === "minister" && turnCount >= maxTurns - 2
      ? "You are out of time. Deliver FINAL DECISION now with 3-5 bullet actions, owners, dates, and key numbers."
      : `Keep it brief (<120 words). Keep debate moving; total turn limit: ${maxTurns}; current turn: ${
          turnCount + 1
        }.`;

  return [
    `Role: ${agent.system}`,
    `Issue to solve: ${issue}`,
    `Conversation so far:\n${log}`,
    urgency,
    agent.id === "minister"
      ? "If others have given numbers or options, pick one, set commitments, and respond as 'FINAL DECISION: ...'."
      : "Offer 1-2 concrete moves with numbers, costs, timelines. Hand off to the Minister for decision.",
    `Reply as ${agent.name}: <message>.`,
  ].join("\n\n");
}

async function callOllama(agent, prompt, turnLimit) {
  const body = {
    model: MODEL,
    stream: false,
    messages: [
      {
        role: "system",
        content: agent.system.replace("MAX_TURNS", String(turnLimit)),
      },
      { role: "user", content: prompt },
    ],
  };

  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (!data.message || !data.message.content) {
    throw new Error("Unexpected Ollama response");
  }

  return data.message.content;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
