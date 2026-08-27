import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtPrice } from "../fuels.js";

// Estilo vectorial gratuito, sin API key (alternativa a Stadia Maps).
// Si tienes una clave de Stadia Maps, cambia esta URL por:
// `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=TU_CLAVE`
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const SOURCE_ID = "gasolineras";

export default function MapView({ data, activeFuel, priceBands, userLocation, selectedStation, onLocationChange, onCountChange }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const originMarkerRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

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

    const originMarker = new maplibregl.Marker({
      color: "#ff7a00",
      draggable: true,
    })
      .setLngLat([-3.7, 40.2])
      .addTo(map);
    originMarker.getElement().title = "Arrastra para elegir el origen";
    originMarker.on("dragend", () => {
      const { lng, lat } = originMarker.getLngLat();
      onLocationChangeRef.current?.([lng, lat]);
    });
    originMarkerRef.current = originMarker;

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: false,
        clusterRadius: 45,
        clusterMaxZoom: 13,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["match", ["get", "activeLevel"], "cheap", "#1a9850", "medium", "#fee08b", "#d73027"],
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
          "circle-color": ["match", ["get", "activeLevel"], "cheap", "#1a9850", "medium", "#fee08b", "#d73027"],
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
        showStation(map, f, JSON.parse(f.properties.precios));
      });

      ["clusters", "unclustered-point"].forEach((id) => {
        map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", id, () => (map.getCanvas().style.cursor = ""));
      });
    });

    return () => {
      originMarker.remove();
      map.remove();
    };
  }, []);

  const showStation = (map, feature, prices = feature.properties.precios) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const rows = Object.entries(prices)
      .map(([key, value]) => `<tr><td>${key}</td><td>${fmtPrice(value)}</td></tr>`)
      .join("");
    const properties = feature.properties;
    const html = `
      <strong>${properties.rotulo || "Estación"}</strong><br/>
      <span style="color:#555">${properties.direccion}, ${properties.localidad}</span>
      <table style="margin-top:6px;font-size:13px;width:100%">${rows}</table>
      <div style="margin-top:4px;font-size:12px;color:#777">${properties.horario}</div>
      <div class="station-navigation">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}" target="_blank" rel="noopener noreferrer">Ruta en Google Maps</a>
        <a href="https://www.waze.com/ul?ll=${latitude}%2C${longitude}&navigate=yes" target="_blank" rel="noopener noreferrer">Navegar con Waze</a>
      </div>
    `;
    popupRef.current.setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStation) return;
    const focus = () => {
      map.flyTo({ center: selectedStation.geometry.coordinates, zoom: 13 });
      showStation(map, selectedStation);
    };
    if (map.isStyleLoaded()) focus();
    else map.once("load", focus);
  }, [selectedStation]);

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
            activeLevel: priceBands.find((band) => f.properties.precios[activeFuel] <= band.max)?.key ?? null,
            precios: JSON.stringify(f.properties.precios),
          },
        })),
      };
      src.setData(enriched);
      onCountChange?.(data.features.length);
    };

    if (map.isStyleLoaded()) setData();
    else map.once("load", setData);
  }, [data, activeFuel, priceBands]);

  // Centra el mapa en la ubicación del usuario cuando esté disponible
  useEffect(() => {
    if (userLocation && mapRef.current) {
      originMarkerRef.current?.setLngLat(userLocation);
      mapRef.current.flyTo({ center: userLocation, zoom: 12 });
    }
  }, [userLocation]);

  return <div ref={containerRef} className="map-container" />;
}
