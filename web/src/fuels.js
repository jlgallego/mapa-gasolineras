export const FUELS = [
  { key: "gasolina_95", label: "Gasolina 95" },
  { key: "gasolina_95_premium", label: "Gasolina 95 Premium" },
  { key: "gasolina_98", label: "Gasolina 98" },
  { key: "gasoleo_a", label: "Gasóleo A" },
  { key: "gasoleo_premium", label: "Gasóleo Premium" },
  { key: "gasoleo_b", label: "Gasóleo B" },
  { key: "gasoleo_c", label: "Gasóleo C" },
  { key: "glp", label: "GLP" },
  { key: "gnc", label: "GNC" },
  { key: "gnl", label: "GNL" },
];

export function fmtPrice(v) {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(3)} €/L`;
}

export const PRICE_LEVELS = [
  { key: "cheap", label: "Barato", color: "green" },
  { key: "medium", label: "Medio", color: "yellow" },
  { key: "expensive", label: "Caro", color: "red" },
];

export function getPriceBands(features, fuel) {
  const prices = features
    .map((f) => f.properties.precios[fuel])
    .filter((price) => price !== undefined && price !== null)
    .sort((a, b) => a - b);
  if (!prices.length) return [];

  const min = prices[0];
  const max = prices[prices.length - 1];
  const step = (max - min) / 3;
  const firstLimit = min + step;
  const secondLimit = min + step * 2;
  return [
    { ...PRICE_LEVELS[0], min, max: firstLimit, label: `Barato: hasta ${fmtPrice(firstLimit)}` },
    { ...PRICE_LEVELS[1], min: firstLimit, max: secondLimit, label: `Medio: ${fmtPrice(firstLimit)}–${fmtPrice(secondLimit)}` },
    { ...PRICE_LEVELS[2], min: secondLimit, max, label: `Caro: más de ${fmtPrice(secondLimit)}` },
  ];
}

export function getPriceLevel(price, bands) {
  if (price === undefined || price === null || !bands.length) return null;
  if (price <= bands[0].max) return bands[0].key;
  if (price <= bands[1].max) return bands[1].key;
  return bands[2].key;
}

// Distancia Haversine en km entre dos puntos [lon, lat]
export function distKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function applyFilters(geojson, filters, userLocation) {
  if (!geojson) return geojson;
  const { fuel, maxPrice, province, brand, open24h, maxDistanceKm, priceLevel, priceBands } = filters;

  const features = geojson.features.filter((f) => {
    const p = f.properties;
    const price = p.precios[fuel];
    if (price === undefined) return false;
    if (priceLevel && getPriceLevel(price, priceBands) !== priceLevel) return false;
    if (maxPrice !== null && price > maxPrice) return false;
    if (province && p.provincia !== province) return false;
    if (brand && !p.rotulo.toLowerCase().includes(brand.toLowerCase())) return false;
    if (open24h && !p.es_24h) return false;
    if (maxDistanceKm !== null && userLocation) {
      const d = distKm(userLocation, f.geometry.coordinates);
      if (d > maxDistanceKm) return false;
    }
    return true;
  });

  return { type: "FeatureCollection", features };
}
