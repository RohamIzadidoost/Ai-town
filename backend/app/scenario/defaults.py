from ..game.state import PolicyOption

def default_options():
    return [
        PolicyOption(
            id="tiered_pricing",
            name="Tiered pricing + targeted subsidies",
            description="Increase marginal price for high use; protect vulnerable households.",
            capex_cost=0.10, opex_cost=0.15, water_saving=0.35, political_risk=0.35, eco_benefit=0.25
        ),
        PolicyOption(
            id="irr_invest",
            name="Irrigation efficiency investment",
            description="Incentivize efficient irrigation systems to reduce agricultural waste.",
            capex_cost=0.35, opex_cost=0.10, water_saving=0.40, political_risk=0.25, eco_benefit=0.35
        ),
        PolicyOption(
            id="quotas_enforce",
            name="Usage quotas + enforcement",
            description="Set strict limits and enforce; reduces demand but may raise fairness concerns.",
            capex_cost=0.10, opex_cost=0.25, water_saving=0.50, political_risk=0.55, eco_benefit=0.30
        ),
        PolicyOption(
            id="leak_repair",
            name="Leak reduction + infrastructure repair",
            description="Reduce system losses by repairing pipes and monitoring leaks.",
            capex_cost=0.30, opex_cost=0.15, water_saving=0.30, political_risk=0.20, eco_benefit=0.30
        ),
    ]
