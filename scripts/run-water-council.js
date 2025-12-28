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
const { createLlmClientFromEnv } = require("../server/llm/llmClient.js");
const { createPersonaMessenger } = require("../server/llm/personaMessages.js");
const { formatOfferJson } = require("../server/llm/promptUtils.js");

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

async function runEpisode({ seed = 42, maxTurns = 9, llmEnabled = true } = {}) {
  const rng = mulberry32(seed);
  const params = sampleParams(rng);
  params.outsideOptionAllocation = normalizeOutside(
    params.outsideOptionAllocation
  );

  let state = createNegotiationState(params, maxTurns);
  const llmClient = llmEnabled ? createLlmClientFromEnv() : null;
  const messenger = createPersonaMessenger({ llmClient });

  while (!state.finalX) {
    const proposerId = state.agents[state.proposerIndex];
    const offer = proposeOffer(state, rng);
    const offerRationale = await messenger.offerMessage(
      proposerId,
      offer,
      state.xStar
    );
    const offerMessage = `${proposerId} proposes:\n\n\
\`\`\`json\n${formatOfferJson(offer)}\n\`\`\`\n\n${offerRationale}`;
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
      const responseRationale = await messenger.responseMessage(
        agentId,
        accept,
        offer
      );
      const responseMessage = `${agentId}: ${responseRationale}`;
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
  runEpisode({ seed })
    .then((episode) => {
      const output = writeEpisode(episode);
      console.log(`Water Council episode saved to ${output}`);
    })
    .catch((error) => {
      console.error("Failed to run Water Council episode:", error);
      process.exitCode = 1;
    });
}

module.exports = { runEpisode, writeEpisode };
