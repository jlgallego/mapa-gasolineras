import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtPrice } from "../fuels.js";

// Estilo vectorial gratuito, sin API key (alternativa a Stadia Maps).
// Si tienes una clave de Stadia Maps, cambia esta URL por:
// `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=TU_CLAVE`
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const SOURCE_ID = "gasolineras";

export default function MapView({ data, activeFuel, userLocation, onCountChange }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const popupRef = useRef(null);

  // Inicializa el mapa una sola vez
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-3.7, 40.2],
      zoom: 5.3,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), "top-right");
    mapRef.current = map;
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" });

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 45,
        clusterMaxZoom: 13,
        clusterProperties: {
          // precio mínimo del combustible activo dentro de cada cluster
          minPrice: ["min", ["get", "activePrice"]],
        },
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "minPrice"],
            "#1a9850", 1.5,
            "#fee08b", 1.7,
            "#d73027",
          ],
          "circle-radius": ["step", ["get", "point_count"], 14, 25, 18, 100, 24, 750, 30],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#1c1c1c" },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "step",
            ["get", "activePrice"],
            "#1a9850", 1.5,
            "#fee08b", 1.7,
            "#d73027",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties.cluster_id;
        map.getSource(SOURCE_ID).getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: features[0].geometry.coordinates, zoom });
        });
      });

      map.on("click", "unclustered-point", (e) => {
        const f = e.features[0];
        const p = JSON.parse(f.properties.precios);
        const rows = Object.entries(p)
          .map(([k, v]) => `<tr><td>${k}</td><td>${fmtPrice(v)}</td></tr>`)
          .join("");
        const html = `
          <strong>${f.properties.rotulo || "Estación"}</strong><br/>
          <span style="color:#555">${f.properties.direccion}, ${f.properties.localidad}</span>
          <table style="margin-top:6px;font-size:13px;width:100%">${rows}</table>
          <div style="margin-top:4px;font-size:12px;color:#777">${f.properties.horario}</div>
        `;
        popupRef.current
          .setLngLat(f.geometry.coordinates)
          .setHTML(html)
          .addTo(map);
      });

      ["clusters", "unclustered-point"].forEach((id) => {
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      });
    });

    return () => map.remove();
  }, []);

  // Actualiza los datos del mapa cuando cambian los filtros o el combustible activo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;

    const setData = () => {
      const src = map.getSource(SOURCE_ID);
      if (!src) return;

      const enriched = {
        type: "FeatureCollection",
        features: data.features.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            activePrice: f.properties.precios[activeFuel] ?? null,
            precios: JSON.stringify(f.properties.precios),
          },
        })),
      };
      src.setData(enriched);
      onCountChange?.(data.features.length);
    };

    if (map.isStyleLoaded()) setData();
    else map.once("load", setData);
  }, [data, activeFuel]);

  // Centra el mapa en la ubicación del usuario cuando esté disponible
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo({ center: userLocation, zoom: 12 });
    }
  }, [userLocation]);

  return <div ref={containerRef} className="map-container" />;
}
