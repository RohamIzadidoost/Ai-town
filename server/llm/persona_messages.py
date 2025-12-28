from typing import Optional

from .prompt_utils import format_offer_json

PERSONAS = {
    "hydrologist": {
        "title": "Hydrologist",
        "focus": "ecosystem sustainability and drought resilience",
    },
    "agriculture": {
        "title": "Agriculture Lead",
        "focus": "crop yield stability and irrigation reliability",
    },
    "infrastructure": {
        "title": "Infrastructure Planner",
        "focus": "reservoir reliability and city service continuity",
    },
}


def build_offer_prompt(agent_id: str, offer: dict, x_star: dict) -> dict:
    persona = PERSONAS[agent_id]
    return {
        "system": (
            f"You are {persona['title']}, speaking as a negotiating LLM persona. "
            "Keep responses concise, professional, and grounded in Nash equilibrium reasoning."
        ),
        "user": (
            "You are proposing a water allocation offer.\n\n"
            f"Nash equilibrium target x*: ({x_star['hydro']:.1f}, "
            f"{x_star['agri']:.1f}, {x_star['infra']:.1f}).\n\n"
            f"Your offer (JSON):\n{format_offer_json(offer)}\n\n"
            f"Focus on {persona['focus']}. Provide a 2-3 sentence message that "
            "references the equilibrium target and explains why this offer is acceptable."
        ),
    }


def build_response_prompt(agent_id: str, accept: bool, offer: dict) -> dict:
    persona = PERSONAS[agent_id]
    decision = "accept" if accept else "reject"
    return {
        "system": (
            f"You are {persona['title']}, speaking as a negotiating LLM persona. "
            "Keep responses concise, professional, and grounded in Nash equilibrium reasoning."
        ),
        "user": (
            "You are responding to an offer.\n\n"
            f"Offer (JSON):\n{format_offer_json(offer)}\n\n"
            f"Decision: {decision.upper()}. Explain in 1-2 sentences how this aligns "
            f"or conflicts with {persona['focus']}."
        ),
    }


def fallback_offer_message(agent_id: str, offer: dict, x_star: dict) -> str:
    focus = {
        "hydrologist": (
            "Keeps ecological flows above the drought threshold while limiting agri overdraw."
        ),
        "agriculture": "Maintains irrigation reliability without compromising environmental caps.",
        "infrastructure": "Protects reservoir reliability and service continuity for the city.",
    }
    return (
        f"Equilibrium guidance: target allocation x* = ({x_star['hydro']:.1f}, "
        f"{x_star['agri']:.1f}, {x_star['infra']:.1f}). {focus[agent_id]} "
        "Proposed allocation balances the basin."
    )


def fallback_response_message(agent_id: str, accept: bool, offer: dict) -> str:
    decision = "Accept" if accept else "Reject"
    focus = {
        "hydrologist": "ecosystem sustainability",
        "agriculture": "crop yield stability",
        "infrastructure": "service reliability",
    }
    return (
        f"{decision} — based on {focus[agent_id]} against the current offer "
        f"({offer['hydro']:.1f}, {offer['agri']:.1f}, {offer['infra']:.1f})."
    )


class PersonaMessenger:
    def __init__(self, llm_client: Optional[object] = None) -> None:
        self.llm_client = llm_client

    def offer_message(self, agent_id: str, offer: dict, x_star: dict) -> str:
        if not self.llm_client:
            return fallback_offer_message(agent_id, offer, x_star)
        prompt = build_offer_prompt(agent_id, offer, x_star)
        return self.llm_client.complete(prompt["system"], prompt["user"])

    def response_message(self, agent_id: str, accept: bool, offer: dict) -> str:
        if not self.llm_client:
            return fallback_response_message(agent_id, accept, offer)
        prompt = build_response_prompt(agent_id, accept, offer)
        return self.llm_client.complete(prompt["system"], prompt["user"])


def create_persona_messenger(llm_client: Optional[object] = None) -> PersonaMessenger:
    return PersonaMessenger(llm_client=llm_client)
