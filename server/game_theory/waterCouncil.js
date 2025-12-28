/**
 * @typedef {Object} Allocation
 * @property {number} hydro
 * @property {number} agri
 * @property {number} infra
 */

/**
 * @typedef {Object} UtilityParams
 * @property {number} a
 * @property {number} p
 */

/**
 * @typedef {Object} HydroParams
 * @property {number} a
 * @property {number} p
 * @property {number} capAgriExcess
 * @property {number} droughtThreshold
 * @property {number} droughtPenalty
 */

/**
 * @typedef {Object} AgriParams
 * @property {number} a
 * @property {number} p
 * @property {number} capEnvExcess
 * @property {number} cropThreshold
 * @property {number} cropPenalty
 */

/**
 * @typedef {Object} InfraParams
 * @property {number} a
 * @property {number} p
 * @property {number} capAgriExcess2
 * @property {number} serviceThreshold
 * @property {number} servicePenalty
 */

/**
 * @typedef {Object} WaterCouncilParams
 * @property {HydroParams} hydro
 * @property {AgriParams} agri
 * @property {InfraParams} infra
 * @property {Allocation} outsideOptionAllocation
 * @property {number} gridStep
 */

/**
 * @typedef {Object} Utilities
 * @property {number} hydro
 * @property {number} agri
 * @property {number} infra
 */

/**
 * @typedef {Object} NegotiationTurn
 * @property {number} turn
 * @property {string} proposerId
 * @property {Allocation} offerX
 * @property {Record<string, boolean>} acceptFlags
 * @property {Utilities} utilities
 * @property {string[]} messages
 */

/**
 * @typedef {Object} NegotiationState
 * @property {WaterCouncilParams} params
 * @property {Allocation} xStar
 * @property {Allocation} outsideOptionAllocation
 * @property {Utilities} outsideUtilities
 * @property {Allocation | null} currentOffer
 * @property {Allocation | null} bestOffer
 * @property {number} turn
 * @property {number} maxTurns
 * @property {number} proposerIndex
 * @property {string[]} agents
 * @property {NegotiationTurn[]} history
 * @property {Allocation | null} finalX
 * @property {boolean | null} success
 * @property {Array<{turn: number, utilities: Utilities}>} utilitiesOverTime
 */

const TOTAL_WATER = 100;

const AGENTS = ["hydrologist", "agriculture", "infrastructure"];

/**
 * @param {Allocation} x
 * @returns {Allocation}
 */
function clampAllocation(x) {
  return {
    hydro: Math.max(0, x.hydro),
    agri: Math.max(0, x.agri),
    infra: Math.max(0, x.infra),
  };
}

/**
 * Projects allocation onto simplex sum=TOTAL_WATER.
 * @param {Allocation} x
 * @returns {Allocation}
 */
function projectToSimplex(x) {
  const values = [x.hydro, x.agri, x.infra];
  const sorted = [...values].sort((a, b) => b - a);
  let cumulative = 0;
  let rho = -1;
  for (let i = 0; i < sorted.length; i += 1) {
    cumulative += sorted[i];
    const t = (cumulative - TOTAL_WATER) / (i + 1);
    if (sorted[i] - t > 0) {
      rho = i;
    }
  }
  if (rho === -1) {
    const equal = TOTAL_WATER / 3;
    return { hydro: equal, agri: equal, infra: equal };
  }
  const theta =
    (sorted.slice(0, rho + 1).reduce((sum, v) => sum + v, 0) - TOTAL_WATER) /
    (rho + 1);
  const projected = values.map((v) => Math.max(0, v - theta));
  return { hydro: projected[0], agri: projected[1], infra: projected[2] };
}

/**
 * @param {WaterCouncilParams} params
 * @param {Allocation} x
 * @returns {Utilities}
 */
function computeUtilities(params, x) {
  const allocation = clampAllocation(x);
  const hydroBase = params.hydro.a * Math.log(1 + allocation.hydro);
  const hydroPenalty =
    params.hydro.p * Math.max(0, allocation.agri - params.hydro.capAgriExcess);
  const hydroDroughtPenalty =
    params.hydro.droughtPenalty *
    Math.max(0, params.hydro.droughtThreshold - allocation.hydro);

  const agriBase = params.agri.a * Math.log(1 + allocation.agri);
  const agriPenalty =
    params.agri.p * Math.max(0, allocation.hydro - params.agri.capEnvExcess);
  const agriCropPenalty =
    params.agri.cropPenalty *
    Math.max(0, params.agri.cropThreshold - allocation.agri);

  const infraBase = params.infra.a * Math.log(1 + allocation.infra);
  const infraPenalty =
    params.infra.p * Math.max(0, allocation.agri - params.infra.capAgriExcess2);
  const infraServicePenalty =
    params.infra.servicePenalty *
    Math.max(0, params.infra.serviceThreshold - allocation.infra);

  return {
    hydro: hydroBase - hydroPenalty - hydroDroughtPenalty,
    agri: agriBase - agriPenalty - agriCropPenalty,
    infra: infraBase - infraPenalty - infraServicePenalty,
  };
}

/**
 * @param {WaterCouncilParams} params
 * @returns {Utilities}
 */
function computeOutsideOptions(params) {
  return computeUtilities(params, params.outsideOptionAllocation);
}

/**
 * @param {Utilities} utilities
 * @param {Utilities} outside
 * @returns {number}
 */
function nashObjective(utilities, outside) {
  const surplus = {
    hydro: utilities.hydro - outside.hydro,
    agri: utilities.agri - outside.agri,
    infra: utilities.infra - outside.infra,
  };
  if (surplus.hydro <= 0 || surplus.agri <= 0 || surplus.infra <= 0) {
    return -Infinity;
  }
  return (
    Math.log(surplus.hydro) +
    Math.log(surplus.agri) +
    Math.log(surplus.infra)
  );
}

/**
 * @param {WaterCouncilParams} params
 * @returns {Allocation}
 */
function solveNashBargaining(params) {
  const outside = computeOutsideOptions(params);
  const step = params.gridStep || 5;
  let best = { hydro: 33.34, agri: 33.33, infra: 33.33 };
  let bestScore = -Infinity;

  for (let h = 0; h <= TOTAL_WATER; h += step) {
    for (let a = 0; a <= TOTAL_WATER - h; a += step) {
      const i = TOTAL_WATER - h - a;
      const candidate = { hydro: h, agri: a, infra: i };
      const utilities = computeUtilities(params, candidate);
      const score = nashObjective(utilities, outside);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  let current = best;
  for (let iter = 0; iter < 40; iter += 1) {
    const baseUtilities = computeUtilities(params, current);
    const baseScore = nashObjective(baseUtilities, outside);
    if (!Number.isFinite(baseScore)) {
      break;
    }
    const gradient = [0, 0, 0];
    const eps = 0.05;

    const coords = ["hydro", "agri", "infra"];
    coords.forEach((key, idx) => {
      const plus = { ...current, [key]: current[key] + eps };
      const minus = { ...current, [key]: Math.max(0, current[key] - eps) };
      const plusProj = projectToSimplex(plus);
      const minusProj = projectToSimplex(minus);
      const plusScore = nashObjective(
        computeUtilities(params, plusProj),
        outside
      );
      const minusScore = nashObjective(
        computeUtilities(params, minusProj),
        outside
      );
      gradient[idx] = (plusScore - minusScore) / (2 * eps);
    });

    const stepSize = 0.8 / (1 + iter / 10);
    const updated = {
      hydro: current.hydro + stepSize * gradient[0],
      agri: current.agri + stepSize * gradient[1],
      infra: current.infra + stepSize * gradient[2],
    };
    current = projectToSimplex(updated);
  }

  return current;
}

/**
 * @param {NegotiationState} state
 * @param {Allocation} offer
 * @returns {Allocation}
 */
function computeAcceptanceThreshold(state, offer) {
  const mix = {
    xStar: 0.6,
    best: 0.3,
    outside: 0.1,
  };
  const best = state.bestOffer || state.xStar;
  const threshold = {
    hydro:
      mix.xStar * state.xStar.hydro +
      mix.best * best.hydro +
      mix.outside * state.outsideOptionAllocation.hydro,
    agri:
      mix.xStar * state.xStar.agri +
      mix.best * best.agri +
      mix.outside * state.outsideOptionAllocation.agri,
    infra:
      mix.xStar * state.xStar.infra +
      mix.best * best.infra +
      mix.outside * state.outsideOptionAllocation.infra,
  };
  return projectToSimplex(threshold);
}

/**
 * @param {WaterCouncilParams} params
 * @param {Allocation} offer
 * @param {Allocation} threshold
 * @param {string} agentId
 * @returns {boolean}
 */
function shouldAccept(params, offer, threshold, agentId) {
  const offerUtilities = computeUtilities(params, offer);
  const thresholdUtilities = computeUtilities(params, threshold);
  if (agentId === "hydrologist") {
    return offerUtilities.hydro >= thresholdUtilities.hydro;
  }
  if (agentId === "agriculture") {
    return offerUtilities.agri >= thresholdUtilities.agri;
  }
  return offerUtilities.infra >= thresholdUtilities.infra;
}

/**
 * @param {NegotiationState} state
 * @param {Allocation} offer
 * @returns {NegotiationState}
 */
function updateBestOffer(state, offer) {
  const outside = state.outsideUtilities;
  const candidateScore = nashObjective(
    computeUtilities(state.params, offer),
    outside
  );
  if (!state.bestOffer) {
    return { ...state, bestOffer: offer };
  }
  const bestScore = nashObjective(
    computeUtilities(state.params, state.bestOffer),
    outside
  );
  if (candidateScore > bestScore) {
    return { ...state, bestOffer: offer };
  }
  return state;
}

/**
 * @param {NegotiationState} state
 * @param {{type: "offer", proposerId: string, offerX: Allocation, message: string} | {type: "respond", agentId: string, accept: boolean, message: string}} action
 * @returns {NegotiationState}
 */
function stepNegotiation(state, action) {
  if (state.finalX) {
    return state;
  }

  if (action.type === "offer") {
    const offer = projectToSimplex(action.offerX);
    const next = updateBestOffer({ ...state, currentOffer: offer }, offer);
    const acceptFlags = {
      hydrologist: action.proposerId === "hydrologist",
      agriculture: action.proposerId === "agriculture",
      infrastructure: action.proposerId === "infrastructure",
    };
    const utilities = computeUtilities(state.params, offer);
    const turn = {
      turn: state.turn,
      proposerId: action.proposerId,
      offerX: offer,
      acceptFlags,
      utilities,
      messages: [action.message],
    };
    return {
      ...next,
      history: [...state.history, turn],
      utilitiesOverTime: [...state.utilitiesOverTime, { turn: state.turn, utilities }],
    };
  }

  if (!state.currentOffer) {
    return state;
  }

  const history = [...state.history];
  const lastTurn = history[history.length - 1];
  lastTurn.acceptFlags[action.agentId] = action.accept;
  lastTurn.messages = [...lastTurn.messages, action.message];

  const allResponded = AGENTS.every((agent) =>
    Object.prototype.hasOwnProperty.call(lastTurn.acceptFlags, agent)
  );
  const allAccepted =
    lastTurn.acceptFlags.hydrologist &&
    lastTurn.acceptFlags.agriculture &&
    lastTurn.acceptFlags.infrastructure;

  if (allResponded && allAccepted) {
    return {
      ...state,
      history,
      finalX: state.currentOffer,
      success: true,
    };
  }

  if (allResponded && !allAccepted) {
    const nextTurn = state.turn + 1;
    if (nextTurn >= state.maxTurns) {
      return {
        ...state,
        history,
        finalX: state.outsideOptionAllocation,
        success: false,
      };
    }
    return {
      ...state,
      history,
      turn: nextTurn,
      proposerIndex: (state.proposerIndex + 1) % state.agents.length,
      currentOffer: null,
    };
  }

  return { ...state, history };
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Allocation} from
 * @param {Allocation} to
 * @param {number} alpha
 * @returns {Allocation}
 */
function interpolate(from, to, alpha) {
  return {
    hydro: from.hydro + (to.hydro - from.hydro) * alpha,
    agri: from.agri + (to.agri - from.agri) * alpha,
    infra: from.infra + (to.infra - from.infra) * alpha,
  };
}

/**
 * @param {NegotiationState} state
 * @param {() => number} rng
 * @returns {Allocation}
 */
function proposeOffer(state, rng) {
  const base = state.currentOffer || state.outsideOptionAllocation;
  const drift = interpolate(base, state.xStar, 0.6);
  const jitter = () => (rng() - 0.5) * 6;
  const candidate = {
    hydro: drift.hydro + jitter(),
    agri: drift.agri + jitter(),
    infra: drift.infra + jitter(),
  };
  return projectToSimplex(candidate);
}

/**
 * @param {WaterCouncilParams} params
 * @param {number} maxTurns
 * @returns {NegotiationState}
 */
function createNegotiationState(params, maxTurns = 9) {
  const xStar = solveNashBargaining(params);
  const outsideUtilities = computeOutsideOptions(params);
  return {
    params,
    xStar,
    outsideOptionAllocation: params.outsideOptionAllocation,
    outsideUtilities,
    currentOffer: null,
    bestOffer: null,
    turn: 0,
    maxTurns,
    proposerIndex: 0,
    agents: [...AGENTS],
    history: [],
    finalX: null,
    success: null,
    utilitiesOverTime: [],
  };
}

/**
 * @param {NegotiationState} state
 * @param {string} agentId
 * @param {Allocation} offer
 * @returns {boolean}
 */
function evaluateAcceptance(state, agentId, offer) {
  const threshold = computeAcceptanceThreshold(state, offer);
  return shouldAccept(state.params, offer, threshold, agentId);
}

module.exports = {
  AGENTS,
  TOTAL_WATER,
  clampAllocation,
  projectToSimplex,
  computeUtilities,
  computeOutsideOptions,
  solveNashBargaining,
  stepNegotiation,
  createNegotiationState,
  proposeOffer,
  evaluateAcceptance,
  computeAcceptanceThreshold,
  mulberry32,
};
