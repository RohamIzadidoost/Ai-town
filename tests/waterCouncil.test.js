const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeUtilities,
  createNegotiationState,
  evaluateAcceptance,
  mulberry32,
  proposeOffer,
  solveNashBargaining,
  stepNegotiation,
} = require("../server/game_theory/waterCouncil.js");

function params() {
  return {
    hydro: {
      a: 8.5,
      p: 0.8,
      capAgriExcess: 50,
      droughtThreshold: 24,
      droughtPenalty: 0.6,
    },
    agri: {
      a: 9.2,
      p: 0.7,
      capEnvExcess: 52,
      cropThreshold: 32,
      cropPenalty: 0.5,
    },
    infra: {
      a: 8.2,
      p: 0.65,
      capAgriExcess2: 54,
      serviceThreshold: 28,
      servicePenalty: 0.55,
    },
    outsideOptionAllocation: {
      hydro: 34,
      agri: 33,
      infra: 33,
    },
    gridStep: 5,
  };
}

test("solver returns feasible allocation", () => {
  const solution = solveNashBargaining(params());
  const total = solution.hydro + solution.agri + solution.infra;
  assert.ok(solution.hydro >= 0);
  assert.ok(solution.agri >= 0);
  assert.ok(solution.infra >= 0);
  assert.ok(Math.abs(total - 100) < 1e-6);
});

test("nash product improves versus random allocations", () => {
  const config = params();
  const solution = solveNashBargaining(config);
  const solutionUtilities = computeUtilities(config, solution);
  const outsideUtilities = computeUtilities(
    config,
    config.outsideOptionAllocation
  );
  const solutionProduct =
    (solutionUtilities.hydro - outsideUtilities.hydro) *
    (solutionUtilities.agri - outsideUtilities.agri) *
    (solutionUtilities.infra - outsideUtilities.infra);

  let betterCount = 0;
  const rng = mulberry32(7);
  for (let i = 0; i < 30; i += 1) {
    const hydro = Math.floor(rng() * 100);
    const agri = Math.floor(rng() * (100 - hydro));
    const infra = 100 - hydro - agri;
    const utilities = computeUtilities(config, { hydro, agri, infra });
    const product =
      (utilities.hydro - outsideUtilities.hydro) *
      (utilities.agri - outsideUtilities.agri) *
      (utilities.infra - outsideUtilities.infra);
    if (solutionProduct >= product) {
      betterCount += 1;
    }
  }
  assert.ok(betterCount >= 20);
});

test("negotiation converges within turn limit", () => {
  const config = params();
  const rng = mulberry32(99);
  let state = createNegotiationState(config, 9);
  while (!state.finalX) {
    const proposerId = state.agents[state.proposerIndex];
    const offer = proposeOffer(state, rng);
    state = stepNegotiation(state, {
      type: "offer",
      proposerId,
      offerX: offer,
      message: "offer",
    });
    for (const agentId of state.agents) {
      if (agentId === proposerId) {
        continue;
      }
      const accept = evaluateAcceptance(state, agentId, offer);
      state = stepNegotiation(state, {
        type: "respond",
        agentId,
        accept,
        message: "response",
      });
      if (state.finalX) {
        break;
      }
    }
  }
  assert.ok(state.turn <= state.maxTurns);
});
