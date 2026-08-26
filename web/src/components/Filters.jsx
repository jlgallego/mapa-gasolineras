import { FUELS } from "../fuels.js";

export default function Filters({
  filters,
  setFilters,
  provinces,
  visibleCount,
  meta,
  onLocate,
  locating,
}) {
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <aside className="panel">
      <h1>Gasolineras en España</h1>
      <p className="subtitle">
        {visibleCount.toLocaleString("es-ES")} estaciones con los filtros actuales
        {meta && (
          <> · datos de {new Date(meta.actualizado).toLocaleString("es-ES")}</>
        )}
      </p>

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

      <p className="legend">
        <span className="dot green" /> barato &nbsp;
        <span className="dot yellow" /> medio &nbsp;
        <span className="dot red" /> caro
      </p>
    </aside>
  );
}
