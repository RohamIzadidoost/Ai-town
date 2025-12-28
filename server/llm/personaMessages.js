const { formatOfferJson } = require("./promptUtils.js");

const PERSONAS = {
  hydrologist: {
    title: "Hydrologist",
    focus: "ecosystem sustainability and drought resilience",
  },
  agriculture: {
    title: "Agriculture Lead",
    focus: "crop yield stability and irrigation reliability",
  },
  infrastructure: {
    title: "Infrastructure Planner",
    focus: "reservoir reliability and city service continuity",
  },
};

function buildOfferPrompt(agentId, offer, xStar) {
  const persona = PERSONAS[agentId];
  return {
    system: `You are ${persona.title}, speaking as a negotiating LLM persona. Keep responses concise, professional, and grounded in Nash equilibrium reasoning.`,
    user: `You are proposing a water allocation offer.\n\nNash equilibrium target x*: (${xStar.hydro.toFixed(
      1
    )}, ${xStar.agri.toFixed(1)}, ${xStar.infra.toFixed(
      1
    )}).\n\nYour offer (JSON):\n${formatOfferJson(offer)}\n\nFocus on ${persona.focus}. Provide a 2-3 sentence message that references the equilibrium target and explains why this offer is acceptable.`,
  };
}

function buildResponsePrompt(agentId, accept, offer) {
  const persona = PERSONAS[agentId];
  const decision = accept ? "accept" : "reject";
  return {
    system: `You are ${persona.title}, speaking as a negotiating LLM persona. Keep responses concise, professional, and grounded in Nash equilibrium reasoning.`,
    user: `You are responding to an offer.\n\nOffer (JSON):\n${formatOfferJson(
      offer
    )}\n\nDecision: ${decision.toUpperCase()}. Explain in 1-2 sentences how this aligns or conflicts with ${persona.focus}.`,
  };
}

function fallbackOfferMessage(agentId, offer, xStar) {
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
  )}, ${xStar.agri.toFixed(1)}, ${xStar.infra.toFixed(1)}). ${
    focus[agentId]
  } Proposed allocation balances the basin.`;
}

function fallbackResponseMessage(agentId, accept, offer) {
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

function createPersonaMessenger({ llmClient } = {}) {
  return {
    async offerMessage(agentId, offer, xStar) {
      if (!llmClient) {
        return fallbackOfferMessage(agentId, offer, xStar);
      }
      const prompt = buildOfferPrompt(agentId, offer, xStar);
      return llmClient.complete(prompt);
    },
    async responseMessage(agentId, accept, offer) {
      if (!llmClient) {
        return fallbackResponseMessage(agentId, accept, offer);
      }
      const prompt = buildResponsePrompt(agentId, accept, offer);
      return llmClient.complete(prompt);
    },
  };
}

module.exports = {
  PERSONAS,
  buildOfferPrompt,
  buildResponsePrompt,
  createPersonaMessenger,
};
