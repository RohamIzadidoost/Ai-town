const app = document.getElementById("app");

function formatAllocation(x) {
  return `H ${x.hydro.toFixed(1)} | A ${x.agri.toFixed(1)} | I ${x.infra.toFixed(1)}`;
}

function stackedBar(x) {
  const total = x.hydro + x.agri + x.infra;
  const hydroPct = (x.hydro / total) * 100;
  const agriPct = (x.agri / total) * 100;
  const infraPct = (x.infra / total) * 100;
  return `
    <div class="stacked">
      <div class="segment hydro" style="width:${hydroPct}%"></div>
      <div class="segment agri" style="width:${agriPct}%"></div>
      <div class="segment infra" style="width:${infraPct}%"></div>
    </div>
  `;
}

function utilityCard(label, utilities, outside) {
  const surplus = utilities - outside;
  return `
    <div class="panel">
      <strong>${label}</strong>
      <div>u = ${utilities.toFixed(2)}</div>
      <div>u - d = ${surplus.toFixed(2)}</div>
    </div>
  `;
}

function render(episode) {
  const lastTurn = episode.turns[episode.turns.length - 1];
  const currentOffer = lastTurn?.offerX || episode.xStar;
  const outside = episode.turns[0]?.utilities || episode.finalUtilities;

  app.innerHTML = `
    <div class="panel">
      <h2>Current Offer</h2>
      <div>${formatAllocation(currentOffer)}</div>
      ${stackedBar(currentOffer)}
    </div>
    <div class="panel">
      <h2>Target Equilibrium (x*)</h2>
      <div>${formatAllocation(episode.xStar)}</div>
      ${stackedBar(episode.xStar)}
    </div>
    <div class="grid">
      ${utilityCard(
        "Hydrologist",
        episode.finalUtilities.hydro,
        outside.hydro
      )}
      ${utilityCard(
        "Agriculture",
        episode.finalUtilities.agri,
        outside.agri
      )}
      ${utilityCard(
        "Infrastructure",
        episode.finalUtilities.infra,
        outside.infra
      )}
    </div>
    <div class="panel">
      <h2>Outcome</h2>
      <div class="pill">${episode.success ? "Agreement" : "Fallback"}</div>
      <p><strong>Final allocation:</strong> ${formatAllocation(episode.finalX)}</p>
    </div>
    <div class="panel">
      <h2>Turn History</h2>
      <ol>
        ${episode.turns
          .map(
            (turn) => `
            <li>
              <strong>Turn ${turn.turn + 1} — ${turn.proposerId}</strong><br/>
              Offer: ${formatAllocation(turn.offerX)}
              ${stackedBar(turn.offerX)}
              <details>
                <summary>Messages</summary>
                ${turn.messages.map((msg) => `<pre>${msg}</pre>`).join("\n")}
              </details>
            </li>
          `
          )
          .join("\n")}
      </ol>
    </div>
  `;
}

fetch("./waterCouncil.latest.json")
  .then((res) => res.json())
  .then(render)
  .catch((err) => {
    app.innerHTML = `<div class="panel">Failed to load episode: ${err}</div>`;
  });
