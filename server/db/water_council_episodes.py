episodes: dict = {}


def create_episode(episode: dict) -> dict:
    episodes[episode["id"]] = episode
    return episode


def get_episode(episode_id: str) -> dict | None:
    return episodes.get(episode_id)


def list_episodes() -> list[dict]:
    return list(episodes.values())
