import { useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView.jsx";
import Filters from "./components/Filters.jsx";
import { applyFilters, getPriceBands, getPriceRankings } from "./fuels.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/gasolineras.geojson`;
const META_URL = `${import.meta.env.BASE_URL}data/meta.json`;

export default function App() {
  const [raw, setRaw] = useState(null);
  const [meta, setMeta] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [rankingView, setRankingView] = useState(null);
  const [locating, setLocating] = useState(false);
  const [filters, setFilters] = useState({
    fuel: "gasolina_95",
    maxPrice: null,
    province: "",
    brand: "",
    open24h: false,
    maxDistanceKm: null,
    priceLevel: null,
  });

  useEffect(() => {
    fetch(DATA_URL).then((r) => r.json()).then(setRaw);
    fetch(META_URL).then((r) => r.json()).then(setMeta);
    // Refresca los datos en el navegador cada hora, sin recargar la página
    const id = setInterval(() => {
      fetch(DATA_URL).then((r) => r.json()).then(setRaw);
      fetch(META_URL).then((r) => r.json()).then(setMeta);
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const provinces = useMemo(
    () => (meta?.provincias ?? []).slice().sort((a, b) => a.localeCompare(b, "es")),
    [meta]
  );

  const priceBands = useMemo(() => {
    if (!raw) return [];
    const scope = filters.province
      ? raw.features.filter((f) => f.properties.provincia === filters.province)
      : raw.features;
    return getPriceBands(scope, filters.fuel);
  }, [raw, filters.province, filters.fuel]);

  const rankings = useMemo(() => {
    if (!raw) return { cheapest: [], mostExpensive: [] };
    const scope = filters.province
      ? raw.features.filter((f) => f.properties.provincia === filters.province)
      : raw.features;
    return getPriceRankings(scope, filters.fuel);
  }, [raw, filters.province, filters.fuel]);

  const filtered = useMemo(
    () => applyFilters(raw, { ...filters, priceBands }, userLocation),
    [raw, filters, priceBands, userLocation]
  );

  const displayed = useMemo(() => {
    if (!rankingView) return filtered;
    return {
      type: "FeatureCollection",
      features: rankings[rankingView].map(({ feature }) => feature),
    };
  }, [filtered, rankingView, rankings]);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!raw) {
    return <div className="loading">Cargando precios de gasolineras…</div>;
  }

  return (
    <div className="app">
      <Filters
        filters={filters}
        setFilters={setFilters}
        provinces={provinces}
        visibleCount={displayed.features.length}
        meta={meta}
        onLocate={handleLocate}
        locating={locating}
        priceBands={priceBands}
        rankings={rankings}
        onSelectStation={setSelectedStation}
        rankingView={rankingView}
        onToggleRanking={setRankingView}
      />
      <MapView
        data={displayed}
        activeFuel={filters.fuel}
        priceBands={priceBands}
        userLocation={userLocation}
        onLocationChange={setUserLocation}
        selectedStation={selectedStation}
      />
    </div>
  );
}
