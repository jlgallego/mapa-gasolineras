import { useState } from "react";
import { FUELS } from "../fuels.js";

export default function Filters({
  filters,
  setFilters,
  provinces,
  visibleCount,
  meta,
  onLocate,
  locating,
  priceBands,
  rankings,
  onSelectStation,
  rankingView,
  onToggleRanking,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <aside className={`panel ${panelOpen ? "panel-open" : "panel-closed"}`}>
      <div className="panel-header">
        <div>
          <h1>Gasolineras en España</h1>
          <p className="subtitle">
            {visibleCount.toLocaleString("es-ES")} estaciones con los filtros actuales
            {meta && (
              <> · datos de {new Date(meta.actualizado).toLocaleString("es-ES")}</>
            )}
          </p>
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={panelOpen}
          aria-controls="map-filters"
          onClick={() => setPanelOpen((open) => !open)}
        >
          {panelOpen ? "Ocultar" : "Filtros"}
        </button>
      </div>

      <div id="map-filters" className="panel-content">

      <div className="fuel-tabs">
        {FUELS.map((f) => (
          <button
            key={f.key}
            className={filters.fuel === f.key ? "active" : ""}
            onClick={() => update({ fuel: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="field">
        Precio máximo (€/L)
        <input
          type="number"
          step="0.01"
          placeholder="Sin límite"
          value={filters.maxPrice ?? ""}
          onChange={(e) =>
            update({ maxPrice: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </label>

      <label className="field">
        Provincia
        <select
          value={filters.province}
          onChange={(e) => update({ province: e.target.value })}
        >
          <option value="">Todas</option>
          {provinces.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <label className="field">
        Marca / rótulo
        <input
          type="text"
          placeholder="Ej: Repsol, Cepsa..."
          value={filters.brand}
          onChange={(e) => update({ brand: e.target.value })}
        />
      </label>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={filters.open24h}
          onChange={(e) => update({ open24h: e.target.checked })}
        />
        Abiertas 24 horas
      </label>

      <label className="field">
        Cerca de mí (km)
        <div className="row">
          <input
            type="number"
            placeholder="Sin límite"
            value={filters.maxDistanceKm ?? ""}
            onChange={(e) =>
              update({ maxDistanceKm: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
          <button type="button" onClick={onLocate} disabled={locating}>
            {locating ? "Localizando…" : "Usar mi ubicación"}
          </button>
        </div>
      </label>

      <div className="legend" aria-label="Niveles de precio">
        <p className="legend-title">Precio en este ámbito</p>
        {priceBands.map((band) => (
          <button
            key={band.key}
            type="button"
            className={`legend-item ${filters.priceLevel === band.key ? "active" : ""}`}
            onClick={() => update({ priceLevel: filters.priceLevel === band.key ? null : band.key })}
            aria-pressed={filters.priceLevel === band.key}
          >
            <span className={`dot ${band.color}`} />
            <span>{band.label}</span>
          </button>
        ))}
      </div>

      <section className="rankings" aria-label="Ranking de precios">
        <h2 className="rankings-title">Ranking de precios</h2>
        <p className="rankings-scope">
          {filters.province || "Toda España"} · {FUELS.find((f) => f.key === filters.fuel)?.label}
        </p>
        <RankingList
          title="10 más baratas"
          entries={rankings.cheapest}
          viewKey="cheapest"
          activeView={rankingView}
          onSelectStation={onSelectStation}
          onToggleRanking={onToggleRanking}
        />
        <RankingList
          title="10 más caras"
          entries={rankings.mostExpensive}
          viewKey="mostExpensive"
          activeView={rankingView}
          onSelectStation={onSelectStation}
          onToggleRanking={onToggleRanking}
        />
      </section>
      </div>
    </aside>
  );
}

function RankingList({ title, entries, viewKey, activeView, onSelectStation, onToggleRanking }) {
  const isActive = activeView === viewKey;
  return (
    <details className="ranking-list" open>
      <summary>
        <span>{title}</span>
        <button
          type="button"
          className="ranking-toggle"
          onClick={(event) => {
            event.preventDefault();
            onToggleRanking(isActive ? null : viewKey);
          }}
        >
          {isActive ? "Mostrar todas" : "Mostrar solo estas"}
        </button>
      </summary>
      <ol>
        {entries.map(({ feature, price }) => {
          const { rotulo, localidad, municipio } = feature.properties;
          return (
            <li key={`${feature.properties.cp}-${feature.geometry.coordinates.join(",")}`}>
              <button type="button" className="ranking-button" onClick={() => onSelectStation(feature)}>
                <span className="ranking-name" title={rotulo || "Estación"}>
                  {rotulo || "Estación"}
                  <small>{localidad || municipio || ""}</small>
                </span>
                <strong>{price.toFixed(3)} €</strong>
              </button>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
