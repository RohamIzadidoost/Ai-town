export function connectWS(sessionId, onEvent) {
  const ws = new WebSocket(`ws://localhost:8000/ws/sim/${sessionId}`);
  ws.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data)); } catch (_) {}
  };
  return ws;
}
