import React, { useRef, useState } from "react";
import { roles, roleById } from "./roles";
import { connectWS } from "./ws";
import "./styles.css";

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pct(x) {
  return `${Math.round(clamp01(x) * 100)}%`;
}

function ActionBadge({ action }) {
  if (!action) return null;

  const t = action.type;
  let label = t;

  if (t === "PROPOSE" || t === "SUPPORT" || t === "OPPOSE" || t === "DECIDE") {
    label = `${t}(${action.option_id || "?"})`;
  } else if (t === "AMEND") {
    label = `${t}(${action.option_id || "?"}, ${action.amendment_type || "?"})`;
  } else if (t === "OFFER_COMPROMISE") {
    label = `${t}(${action.option_id_a || "?"}, ${action.option_id_b || "?"})`;
  } else if (t === "DEMAND_COMPENSATION") {
    label = `${t}(${action.compensation_level || "?"})`;
  } else if (t === "RAISE_RISK") {
    label = `${t}(${action.risk_type || "?"})`;
  } else if (t === "ASK_QUESTION") {
    label = `${t}(${action.target_role || "?"}, ${action.question_type || "?"})`;
  } else if (t === "REQUEST_METRICS") {
    label = `${t}(${action.kpi || "?"})`;
  }

  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid #2a2f44",
        background: "#0b0c10",
        opacity: 0.95
      }}
      title="Chosen discrete action (strategy)"
    >
      {label}
    </span>
  );
}

function KPI({ state }) {
  if (!state) return null;
  return (
    <div
      style={{
        border: "1px solid #1f2230",
        background: "#0f1117",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Game State (KPIs)</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <div>
          <div className="small">Budget remaining</div>
          <div style={{ fontWeight: 600 }}>{Number(state.budget_remaining).toFixed(2)}</div>
        </div>
        <div>
          <div className="small">Groundwater risk</div>
          <div style={{ fontWeight: 600 }}>{pct(state.groundwater_risk)}</div>
        </div>
        <div>
          <div className="small">Infrastructure status</div>
          <div style={{ fontWeight: 600 }}>{pct(state.infrastructure_status)}</div>
        </div>

        <div>
          <div className="small">Public support</div>
          <div style={{ fontWeight: 600 }}>{pct(state.public_support)}</div>
        </div>
        <div>
          <div className="small">Fairness index</div>
          <div style={{ fontWeight: 600 }}>{pct(state.fairness_index)}</div>
        </div>
        <div>
          <div className="small">Restriction level</div>
          <div style={{ fontWeight: 600 }}>{state.restriction_level}/3</div>
        </div>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        Decision locked: {String(state.decision_locked)}{" "}
        {state.decision_option ? `| option: ${state.decision_option}` : ""}
      </div>
    </div>
  );
}

function JudgePanel({ judge, roundIdx }) {
  if (!judge) return null;
  return (
    <div
      style={{
        border: "1px solid #1f2230",
        background: "#0f1117",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Judge (Round {roundIdx || "?"})
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div>
          <div className="small">Realism</div>
          <div style={{ fontWeight: 600 }}>{pct(judge.realism)}</div>
        </div>
        <div>
          <div className="small">Public acceptance</div>
          <div style={{ fontWeight: 600 }}>{pct(judge.public_acceptance)}</div>
        </div>
        <div>
          <div className="small">Fairness perception</div>
          <div style={{ fontWeight: 600 }}>{pct(judge.fairness_perception)}</div>
        </div>
        <div>
          <div className="small">Conflict level</div>
          <div style={{ fontWeight: 600 }}>{pct(judge.conflict_level)}</div>
        </div>
      </div>

      {judge.notes ? <div className="small" style={{ marginTop: 10 }}>{judge.notes}</div> : null}
    </div>
  );
}

function PayoffPanel({ payoffs }) {
  if (!payoffs) return null;
  const u = payoffs.utilities || payoffs;
  const entries = Object.entries(u || {});
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid #1f2230",
        background: "#0f1117",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Payoffs</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {entries.map(([rid, val]) => {
          const r = roleById[rid] || { name: rid, icon: "👤" };
          return (
            <div key={rid} style={{ border: "1px solid #1f2230", borderRadius: 12, padding: 10 }}>
              <div className="small">{r.icon} {r.name}</div>
              <div style={{ fontWeight: 700 }}>{pct(val)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [topic, setTopic] = useState("Water crisis policy");
  const [rounds, setRounds] = useState(2);
  const [model, setModel] = useState("llama3");
  const [temperature, setTemperature] = useState(0.4);

  const [sessionId, setSessionId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [status, setStatus] = useState("idle");

  const [messages, setMessages] = useState([]); // {id, role, content, status, action}
  const [gameState, setGameState] = useState(null);
  const [judge, setJudge] = useState(null);
  const [judgeRound, setJudgeRound] = useState(null);
  const [decision, setDecision] = useState(null);
  const [payoffs, setPayoffs] = useState(null);

  const wsRef = useRef(null);
  const inflightByRole = useRef({}); // role -> msg id

  const canStart = status === "idle" || status === "done" || status === "stopped" || status === "error";

  async function start() {
    setMessages([]);
    setActiveRole(null);
    setGameState(null);
    setJudge(null);
    setJudgeRound(null);
    setDecision(null);
    setPayoffs(null);
    setStatus("starting");

    const r = await fetch("http://localhost:8000/api/sim/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        rounds: Number(rounds),
        model,
        temperature: Number(temperature),
        scenario: {}
      })
    });

    const j = await r.json();
    setSessionId(j.session_id);

    if (wsRef.current) wsRef.current.close();
    wsRef.current = connectWS(j.session_id, onEvent);

    setStatus("running");
  }

  async function stop() {
    if (!sessionId) return;
    await fetch(`http://localhost:8000/api/sim/stop/${sessionId}`, { method: "POST" });
  }

  function ensureInflight(role) {
    const id = inflightByRole.current[role];
    if (id) return id;

    const newId = crypto.randomUUID();
    inflightByRole.current[role] = newId;

    setMessages(prev => [
      ...prev,
      { id: newId, role, content: "", status: "streaming", action: null }
    ]);

    return newId;
  }

  function onEvent(evt) {
    if (evt.state) setGameState(evt.state);

    if (evt.type === "session_start") {
      setGameState(evt.state || null);
      return;
    }

    if (evt.type === "turn_start") {
      setActiveRole(evt.role);
      ensureInflight(evt.role);
      return;
    }

    if (evt.type === "action_selected") {
      const role = evt.role;
      const id = ensureInflight(role);
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, action: evt.action } : m)));
      return;
    }

    if (evt.type === "delta") {
      const role = evt.role;
      const id = ensureInflight(role);
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, content: m.content + (evt.text || "") } : m)));
      return;
    }

    if (evt.type === "turn_end") {
      const role = evt.role;
      const id = inflightByRole.current[role];
      if (!id) return;
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, content: evt.message ?? m.content, status: "final" } : m)));
      inflightByRole.current[role] = null;
      setActiveRole(null);
      return;
    }

    if (evt.type === "judge_scores") {
      setJudge(evt.data || null);
      setJudgeRound((evt.state && evt.state.round_idx) || null);
      return;
    }

    if (evt.type === "decision") {
      setDecision(evt.data || null);
      return;
    }

    if (evt.type === "payoffs") {
      setPayoffs(evt.data || null);
      return;
    }

    if (evt.type === "done") {
      setStatus("done");
      setActiveRole(null);
      return;
    }

    if (evt.type === "stopped") {
      setStatus("stopped");
      setActiveRole(null);
      return;
    }

    if (evt.type === "error") {
      setStatus("error");
      setActiveRole(null);
      return;
    }
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <div style={{ marginBottom: 12, fontWeight: 700 }}>Roles</div>
        {roles.map(r => (
          <div key={r.id} className={`role ${activeRole === r.id ? "active" : ""}`}>
            <div className="icon">{r.icon}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{r.name}</div>
              <div className="small">{r.id}</div>
            </div>
          </div>
        ))}
        <div className="small" style={{ marginTop: 16 }}>
          Status: {status}
          {sessionId ? <div>Session: {sessionId.slice(0, 8)}...</div> : null}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic" style={{ minWidth: 260 }} />
          <input type="number" value={rounds} onChange={e => setRounds(e.target.value)} min={1} max={10} />
          <input value={model} onChange={e => setModel(e.target.value)} placeholder="llama3" />
          <input type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} min={0} max={2} />
          <button onClick={start} disabled={!canStart}>Start</button>
          <button onClick={stop} disabled={status !== "running"}>Stop</button>
        </div>

        <KPI state={gameState} />
        <JudgePanel judge={judge} roundIdx={judgeRound} />

        {decision?.decision_option ? (
          <div style={{ border: "1px solid #1f2230", background: "#0f1117", borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Decision</div>
            <div style={{ marginTop: 6 }}>Selected option: <b>{decision.decision_option}</b></div>
          </div>
        ) : null}

        <PayoffPanel payoffs={payoffs} />

        <div className="chat">
          {messages.map(m => {
            const r = roleById[m.role] || { name: m.role, icon: "👤" };
            return (
              <div key={m.id} className={`msg ${m.status === "streaming" ? "streaming" : ""}`}>
                <div className="msgHeader" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="badge">{r.icon}</div>
                    <div className="name">{r.name}</div>
                    {m.status === "streaming" ? <div className="small">speaking…</div> : null}
                  </div>
                  <ActionBadge action={m.action} />
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35 }}>
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
