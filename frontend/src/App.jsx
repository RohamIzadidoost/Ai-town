import React, { useMemo, useRef, useState } from "react";
import { roles, roleById } from "./roles";
import { connectWS } from "./ws";
import "./styles.css";

export default function App() {
  const [topic, setTopic] = useState("Water crisis policy");
  const [rounds, setRounds] = useState(2);
  const [model, setModel] = useState("llama3");
  const [temperature, setTemperature] = useState(0.4);

  const [sessionId, setSessionId] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [messages, setMessages] = useState([]); // {id, role, content, status}
  const [status, setStatus] = useState("idle");

  const wsRef = useRef(null);
  const msgRef = useRef({}); // role -> current message id

  const canStart = status === "idle" || status === "done" || status === "stopped";

  async function start() {
    setMessages([]);
    setActiveRole(null);
    setStatus("starting");

    const r = await fetch("http://localhost:8000/api/sim/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        rounds: Number(rounds),
        model,
        temperature: Number(temperature),
        scenario: {
          facts: [
            "Water availability is constrained.",
            "Public acceptance and economic impact matter."
          ],
          constraints: ["Budget limited", "Need measurable outcomes"],
          policy_options: [
            "Tiered pricing + subsidies",
            "Irrigation efficiency investment",
            "Usage quotas + enforcement",
            "Leak reduction + infrastructure repair"
          ]
        }
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

  function onEvent(evt) {
    if (evt.type === "turn_start") {
      setActiveRole(evt.role);
      const id = crypto.randomUUID();
      msgRef.current[evt.role] = id;
      setMessages(prev => [
        ...prev,
        { id, role: evt.role, content: "", status: "streaming" }
      ]);
    }

    if (evt.type === "delta") {
      const role = evt.role;
      const id = msgRef.current[role];
      if (!id) return;
      setMessages(prev => prev.map(m => {
        if (m.id !== id) return m;
        return { ...m, content: m.content + evt.text };
      }));
    }

    if (evt.type === "turn_end") {
      const role = evt.role;
      const id = msgRef.current[role];
      setMessages(prev => prev.map(m => {
        if (m.id !== id) return m;
        return { ...m, content: evt.message || m.content, status: "final" };
      }));
      msgRef.current[role] = null;
      setActiveRole(null);
    }

    if (evt.type === "done") {
      setStatus("done");
      setActiveRole(null);
    }

    if (evt.type === "stopped") {
      setStatus("stopped");
      setActiveRole(null);
    }

    if (evt.type === "error") {
      setStatus("error");
      setActiveRole(null);
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
          <input type="number" step="0.1" value={temperature} onChange={e => setTemperature(e.target.value)} min={0} max={1.5} />
          <button onClick={start} disabled={!canStart}>Start</button>
          <button onClick={stop} disabled={status !== "running"}>Stop</button>
        </div>

        <div className="chat">
          {messages.map(m => {
            const r = roleById[m.role] || { name: m.role, icon: "👤" };
            return (
              <div key={m.id} className={`msg ${m.status === "streaming" ? "streaming" : ""}`}>
                <div className="msgHeader">
                  <div className="badge">{r.icon}</div>
                  <div className="name">{r.name}</div>
                  {m.status === "streaming" ? <div className="small">speaking…</div> : null}
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
