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

module.exports = { formatOfferJson };
