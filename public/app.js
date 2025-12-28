const agents = [
  {
    id: "minister",
    name: "Minister",
    prompt:
      "Minister (chair/policy). Goal: converge to an implementable policy; time-box debate; request numbers; decide. Must produce FINAL DECISION within MAX_TURNS.",
  },
  {
    id: "hydrologist",
    name: "Hydrologist",
    prompt:
      "Hydrologist. Goal: environmental flow + aquifer sustainability; thresholds; monitoring.",
  },
  {
    id: "farmer",
    name: "Farmer",
    prompt:
      "Farmer (agriculture). Goal: protect crop yield; quantify irrigation needs; efficiency + compensation options.",
  },
  {
    id: "infra",
    name: "Infrastructure Expert",
    prompt:
      "Infrastructure Expert. Goal: reliable city/industry supply; reservoir ops; leakage reduction; reuse; costs/timelines.",
  },
];

const feedEl = document.getElementById("feed");
const decisionEl = document.getElementById("decision");
const turnInfoEl = document.getElementById("turnInfo");
const statusEl = document.getElementById("status");
const issueEl = document.getElementById("issue");
const maxTurnsEl = document.getElementById("maxTurns");
const maxTurnsValueEl = document.getElementById("maxTurnsValue");
const runBtn = document.getElementById("runBtn");
const sampleBtn = document.getElementById("sampleIssue");

renderAgents();

maxTurnsEl.addEventListener("input", () => {
  maxTurnsValueEl.textContent = maxTurnsEl.value;
});

sampleBtn.addEventListener("click", () => {
  issueEl.value =
    "Reservoirs sit at 30% and a heat wave is forecast. Farmers need water for tomatoes and wheat; city demand is up 10% as industry restarts. Decide on allocations, drought rules, compensation, and monitoring in the next 4 weeks.";
});

document.getElementById("issueForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const issue = issueEl.value.trim();
  const maxTurns = Number(maxTurnsEl.value);

  if (!issue) {
    statusEl.textContent = "Please describe the issue.";
    return;
  }

  runBtn.disabled = true;
  statusEl.textContent = "Running agents via Ollama llama3...";
  decisionEl.classList.add("hidden");
  feedEl.classList.remove("empty");
  feedEl.innerHTML = "";

  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issue, maxTurns }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Request failed");
    }

    const data = await response.json();
    renderFeed(data);
    statusEl.textContent = "Complete";
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || "Failed to run council (is Ollama running?)";
    feedEl.innerHTML = "<p>Could not reach the agents. Check Ollama and try again.</p>";
  } finally {
    runBtn.disabled = false;
  }
});

function renderFeed(data) {
  const { conversation = [], finalDecision, turnsUsed, maxTurns } = data;

  turnInfoEl.textContent = `${turnsUsed || 0} / ${maxTurns || "?"} turns used`;

  if (conversation.length === 0) {
    feedEl.innerHTML = "<p>No messages yet.</p>";
    return;
  }

  feedEl.innerHTML = conversation
    .map((entry) => {
      const agentId = agentIdFromName(entry.speaker);
      return `
        <div class="bubble ${agentId || ""}">
          <header>
            <span class="speaker">${entry.speaker}</span>
            <span class="tag">${tagFor(agentId)}</span>
          </header>
          <p>${escapeHtml(entry.content)}</p>
        </div>
      `;
    })
    .join("");

  if (finalDecision) {
    decisionEl.classList.remove("hidden");
    decisionEl.textContent = finalDecision;
  } else {
    decisionEl.classList.add("hidden");
  }
}

function renderAgents() {
  const container = document.getElementById("agents");
  container.innerHTML = agents
    .map(
      (agent) => `
      <div class="agent-card">
        <h3>${agent.name}</h3>
        <p>${agent.prompt}</p>
      </div>
    `
    )
    .join("");
}

function agentIdFromName(name) {
  const match = agents.find((a) => name.toLowerCase().includes(a.name.toLowerCase()));
  return match ? match.id : "";
}

function tagFor(id) {
  switch (id) {
    case "minister":
      return "Chair";
    case "hydrologist":
      return "Hydrology";
    case "farmer":
      return "Agriculture";
    case "infra":
      return "Infrastructure";
    default:
      return "Agent";
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
