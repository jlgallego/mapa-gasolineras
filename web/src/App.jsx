import { useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView.jsx";
import Filters from "./components/Filters.jsx";
import { applyFilters } from "./fuels.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/gasolineras.geojson`;
const META_URL = `${import.meta.env.BASE_URL}data/meta.json`;

export default function App() {
  const [raw, setRaw] = useState(null);
  const [meta, setMeta] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [filters, setFilters] = useState({
    fuel: "gasolina_95",
    maxPrice: null,
    province: "",
    brand: "",
    open24h: false,
    maxDistanceKm: null,
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

  const filtered = useMemo(
    () => applyFilters(raw, filters, userLocation),
    [raw, filters, userLocation]
  );

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
        visibleCount={filtered.features.length}
        meta={meta}
        onLocate={handleLocate}
        locating={locating}
      />
      <MapView data={filtered} activeFuel={filters.fuel} userLocation={userLocation} />
    </div>
  );
}
