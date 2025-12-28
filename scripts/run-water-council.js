const fs = require("fs");
const path = require("path");
const {
  AGENTS,
  createNegotiationState,
  computeUtilities,
  evaluateAcceptance,
  mulberry32,
  proposeOffer,
  stepNegotiation,
} = require("../server/game_theory/waterCouncil.js");
const { createEpisode } = require("../server/db/waterCouncilEpisodes.js");

function sampleParams(rng) {
  const between = (min, max) => min + (max - min) * rng();
  return {
    hydro: {
      a: between(7.5, 9.5),
      p: between(0.6, 1.1),
      capAgriExcess: between(40, 55),
      droughtThreshold: between(18, 28),
      droughtPenalty: between(0.4, 0.8),
    },
    agri: {
      a: between(8.0, 10.5),
      p: between(0.4, 0.9),
      capEnvExcess: between(45, 60),
      cropThreshold: between(28, 38),
      cropPenalty: between(0.35, 0.7),
    },
    infra: {
      a: between(7.0, 9.0),
      p: between(0.45, 0.85),
      capAgriExcess2: between(42, 58),
      serviceThreshold: between(22, 32),
      servicePenalty: between(0.45, 0.75),
    },
    outsideOptionAllocation: {
      hydro: between(30, 36),
      agri: between(30, 36),
      infra: between(28, 34),
    },
    gridStep: 4,
  };
}

function normalizeOutside(allocation) {
  const total = allocation.hydro + allocation.agri + allocation.infra;
  const scale = 100 / total;
  return {
    hydro: allocation.hydro * scale,
    agri: allocation.agri * scale,
    infra: allocation.infra * scale,
  };
}

function formatOfferJson(offer) {
  return JSON.stringify(
    {
      x_hydro: Number(offer.hydro.toFixed(2)),
      x_agri: Number(offer.agri.toFixed(2)),
      x_infra: Number(offer.infra.toFixed(2)),
    },
    null,
    2
  );
}

function offerRationale(agentId, offer, xStar) {
  const focus = {
    hydrologist:
      "Keeps ecological flows above the drought threshold while limiting agri overdraw.",
    agriculture:
      "Maintains irrigation reliability without compromising environmental caps.",
    infrastructure:
      "Protects reservoir reliability and service continuity for the city.",
  };
  return `Equilibrium guidance: target allocation x* = (${xStar.hydro.toFixed(
    1
  )}, ${xStar.agri.toFixed(1)}, ${xStar.infra.toFixed(
    1
  )}). ${focus[agentId]} Proposed allocation balances the basin.`;
}

function responseRationale(agentId, accept, offer) {
  const decision = accept ? "Accept" : "Reject";
  const focus = {
    hydrologist: "ecosystem sustainability",
    agriculture: "crop yield stability",
    infrastructure: "service reliability",
  };
  return `${decision} — based on ${focus[agentId]} against the current offer (${offer.hydro.toFixed(
    1
  )}, ${offer.agri.toFixed(1)}, ${offer.infra.toFixed(1)}).`;
}

function runEpisode({ seed = 42, maxTurns = 9 } = {}) {
  const rng = mulberry32(seed);
  const params = sampleParams(rng);
  params.outsideOptionAllocation = normalizeOutside(
    params.outsideOptionAllocation
  );

  let state = createNegotiationState(params, maxTurns);

  while (!state.finalX) {
    const proposerId = state.agents[state.proposerIndex];
    const offer = proposeOffer(state, rng);
    const offerMessage = `${proposerId} proposes:\n\n\
\`\`\`json\n${formatOfferJson(offer)}\n\`\`\`\n\n${offerRationale(
      proposerId,
      offer,
      state.xStar
    )}`;
    state = stepNegotiation(state, {
      type: "offer",
      proposerId,
      offerX: offer,
      message: offerMessage,
    });

    for (const agentId of AGENTS) {
      if (agentId === proposerId) {
        continue;
      }
      const accept = evaluateAcceptance(state, agentId, offer);
      const responseMessage = `${agentId}: ${responseRationale(
        agentId,
        accept,
        offer
      )}`;
      state = stepNegotiation(state, {
        type: "respond",
        agentId,
        accept,
        message: responseMessage,
      });
      if (state.finalX) {
        break;
      }
    }
  }

  const episode = {
    id: `water-council-${seed}`,
    seed,
    params,
    xStar: state.xStar,
    turns: state.history,
    finalX: state.finalX,
    success: state.success,
    utilitiesOverTime: state.utilitiesOverTime,
    finalUtilities: computeUtilities(state.params, state.finalX),
  };

  createEpisode(episode);

  return episode;
}

function writeEpisode(episode) {
  const outputPath = path.join(
    __dirname,
    "..",
    "ui",
    "waterCouncil.latest.json"
  );
  fs.writeFileSync(outputPath, JSON.stringify(episode, null, 2));
  return outputPath;
}

if (require.main === module) {
  const seed = Number(process.env.SEED || 42);
  const episode = runEpisode({ seed });
  const output = writeEpisode(episode);
  console.log(`Water Council episode saved to ${output}`);
}

module.exports = { runEpisode, writeEpisode };
