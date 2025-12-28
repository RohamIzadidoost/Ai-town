const episodes = new Map();

/**
 * @param {object} episode
 * @returns {object}
 */
function createEpisode(episode) {
  episodes.set(episode.id, episode);
  return episode;
}

/**
 * @param {string} id
 * @returns {object | undefined}
 */
function getEpisode(id) {
  return episodes.get(id);
}

/**
 * @returns {object[]}
 */
function listEpisodes() {
  return Array.from(episodes.values());
}

module.exports = {
  createEpisode,
  getEpisode,
  listEpisodes,
};
