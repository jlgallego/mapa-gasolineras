#!/usr/bin/env python3
"""
Descarga el listado de precios de gasolineras del geoportal del MITECO
y lo transforma en un GeoJSON listo para pintar en el mapa.

Fuente: https://geoportalgasolineras.es/geoportal/resources/files/preciosEESS_es.xls

Uso:
    python scripts/fetch_precios.py

Genera:
    web/public/data/gasolineras.geojson
    web/public/data/meta.json   (fecha de actualización, nº de estaciones, provincias)
"""
import json
import re
import sys
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
from requests.exceptions import SSLError

URL = "https://geoportalgasolineras.es/geoportal/resources/files/preciosEESS_es.xls"

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web" / "public" / "data"
OUT_GEOJSON = OUT_DIR / "gasolineras.geojson"
OUT_META = OUT_DIR / "meta.json"
FNMT_CA = Path(__file__).resolve().parent / "certs" / "fnmt-ac-componentes.pem"

# Combustibles que queremos exponer como filtro -> palabras clave para
# encontrar la columna correspondiente en el Excel (los nombres exactos de
# columna han cambiado alguna vez, así que buscamos por contenido normalizado
# en vez de por nombre exacto).
FUEL_KEYWORDS = {
    "gasolina_95": ["precio gasolina 95 e5"],
    "gasolina_95_premium": ["precio gasolina 95 e5 premium"],
    "gasolina_98": ["precio gasolina 98 e5"],
    "gasoleo_a": ["precio gasoleo a"],
    "gasoleo_b": ["precio gasoleo b"],
    "gasoleo_c": ["precio gasoleo c"],          # ← lo tenías completamente sin mapear
    "gasoleo_premium": ["precio gasoleo premium"],
    "glp": ["precio gases licuados del petroleo"],
    "gnc": ["precio gas natural comprimido"],
    "gnl": ["precio gas natural licuado"],       # ← también existe y no lo cubrías
}

INFO_KEYWORDS = {
    "rotulo": ["rotulo"],
    "direccion": ["direccion"],
    "horario": ["horario"],
    "localidad": ["localidad"],
    "municipio": ["municipio"],
    "provincia": ["provincia"],
    "cp": ["c.p.", "codigo postal"],
    "latitud": ["latitud"],
    "longitud": ["longitud"],
}


def normalize(s: str) -> str:
    s = str(s).strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s)


def find_column(columns_norm: dict, exact_names: list[str]) -> str | None:
    for name in exact_names:
        if name in columns_norm:
            return columns_norm[name]
    return None


def to_float(value) -> float | None:
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", ".")
    if not s or s.lower() == "nan":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Descargando {URL} ...")
    system_ca = Path("/etc/ssl/certs/ca-certificates.crt")
    temporary_ca = None
    verify = str(system_ca) if system_ca.is_file() else True
    if FNMT_CA.is_file():
        base_ca = system_ca if system_ca.is_file() else Path(requests.certs.where())
        temporary_ca = tempfile.NamedTemporaryFile(mode="w", suffix=".pem", delete=False)
        temporary_ca.write(base_ca.read_text(encoding="utf-8").rstrip("\n") + "\n")
        temporary_ca.write(FNMT_CA.read_text(encoding="utf-8"))
        temporary_ca.close()
        verify = temporary_ca.name
    try:
        resp = requests.get(
            URL,
            timeout=60,
            headers={"User-Agent": "Mozilla/5.0"},
            verify=verify,
        )
    except SSLError as exc:
        raise SystemExit(
            "No se pudo validar el certificado TLS del geoportal. "
            "Comprueba que el certificado intermedio FNMT está disponible."
        ) from exc
    finally:
        if temporary_ca is not None:
            Path(temporary_ca.name).unlink(missing_ok=True)
    resp.raise_for_status()
    tmp_xls = ROOT / "scripts" / "_tmp_precios.xls"
    tmp_xls.write_bytes(resp.content)

    # El fichero es .xls (formato antiguo). xlrd>=2.0 solo soporta .xls, no .xlsx.
    # Las tres primeras filas contienen metadatos; la cabecera empieza en la 4.
    df = pd.read_excel(tmp_xls, engine="xlrd", header=3)
    tmp_xls.unlink(missing_ok=True)

    columns_norm = {normalize(c): c for c in df.columns}
    print("Columnas detectadas en el Excel:")
    for c in df.columns:
        print(f"  - {c}")

    info_cols = {k: find_column(columns_norm, v) for k, v in INFO_KEYWORDS.items()}
    fuel_cols = {k: find_column(columns_norm, v) for k, v in FUEL_KEYWORDS.items()}

    missing_info = [k for k, v in info_cols.items() if v is None]
    if missing_info:
        print(f"AVISO: no se han encontrado columnas para: {missing_info}. "
              f"Revisa FUEL_KEYWORDS/INFO_KEYWORDS en este script contra las "
              f"columnas listadas arriba y ajusta las palabras clave.", file=sys.stderr)

    features = []
    provincias = set()
    for _, row in df.iterrows():
        lat = to_float(row.get(info_cols.get("latitud")))
        lon = to_float(row.get(info_cols.get("longitud")))
        if lat is None or lon is None:
            continue

        precios = {}
        for fuel_key, col in fuel_cols.items():
            if col is None:
                continue
            price = to_float(row.get(col))
            if price is not None:
                precios[fuel_key] = round(price, 3)

        if not precios:
            # Estación sin ningún precio publicado: no aporta al mapa
            continue

        provincia = str(row.get(info_cols.get("provincia"), "")).strip()
        if provincia:
            provincias.add(provincia)

        props = {
            "rotulo": str(row.get(info_cols.get("rotulo"), "")).strip(),
            "direccion": str(row.get(info_cols.get("direccion"), "")).strip(),
            "horario": str(row.get(info_cols.get("horario"), "")).strip(),
            "localidad": str(row.get(info_cols.get("localidad"), "")).strip(),
            "municipio": str(row.get(info_cols.get("municipio"), "")).strip(),
            "provincia": provincia,
            "cp": str(row.get(info_cols.get("cp"), "")).strip(),
            "precios": precios,
            "es_24h": "24h" in normalize(row.get(info_cols.get("horario"), "")).replace(" ", ""),
        }

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })

    geojson = {"type": "FeatureCollection", "features": features}
    OUT_GEOJSON.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")

    meta = {
        "actualizado": datetime.now(timezone.utc).isoformat(),
        "num_estaciones": len(features),
        "provincias": sorted(provincias),
        "fuente": URL,
    }
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK: {len(features)} estaciones escritas en {OUT_GEOJSON}")


if __name__ == "__main__":
    main()
