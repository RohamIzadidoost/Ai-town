import json


def format_offer_json(offer: dict) -> str:
    return json.dumps(
        {
            "x_hydro": round(float(offer["hydro"]), 2),
            "x_agri": round(float(offer["agri"]), 2),
            "x_infra": round(float(offer["infra"]), 2),
        },
        indent=2,
    )
