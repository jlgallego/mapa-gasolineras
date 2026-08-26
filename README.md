# Mapa de gasolineras en España — precios en tiempo real

Clon funcional del mapa de Datadista, con datos del geoportal del MITECO
y filtros ampliados.

## Cómo está montado

```
scripts/fetch_precios.py   → descarga el XLS del MITECO y lo convierte en GeoJSON
.github/workflows/         → Action que ejecuta ese script cada hora y publica los datos
web/                        → app React + MapLibre GL que pinta el mapa y los filtros
```

**Por qué así:**

- **Nunca se descarga el XLS desde el navegador del usuario.** El geoportal del
  MITECO no manda cabeceras CORS, así que un `fetch()` desde el cliente
  fallaría. Por eso el XLS se procesa en un job periódico (GitHub Actions) y
  el resultado (un `.geojson` estático) es lo único que sirve el frontend.
- **MapLibre GL en vez de Leaflet.** Con >12.000 puntos, un mapa vectorial con
  *clustering* nativo (WebGL) rinde muchísimo mejor que Leaflet con
  marcadores DOM. Es lo mismo que hacen Datadista con Stadia Maps: tiles
  vectoriales + un motor GL. Aquí uso [OpenFreeMap](https://openfreemap.org)
  como base gratuita y sin API key; si luego quieres el estilo de Stadia
  Maps, es un cambio de una línea (ver `MapView.jsx`).
- **Filtrado en el cliente.** Con un único GeoJSON de unos pocos MB, filtrar
  en JavaScript es instantáneo y evita montar un backend con base de datos.

## Sobre cómo lo ha hecho Datadista (lo que se puede confirmar desde fuera)

No tengo acceso a su código fuente ni a las herramientas de desarrollador del
navegador, así que esto es lo que se puede verificar por otras vías, no una
lectura de su repositorio:

- Usan **Stadia Maps + OpenMapTiles + OpenStreetMap** para la cartografía
  (confirmado en prensa especializada en el lanzamiento del mapa).
- El patrón habitual en los interactivos de Datadista es HTML/JS servido como
  "especial" independiente embebido en un `<iframe>` del artículo, con un
  pipeline de datos separado (Python/Node) que republica el XLS del MITECO
  como JSON optimizado; la página en sí dice explícitamente "Datos
  actualizados cada hora desde el Ministerio para la Transición Ecológica".
- No puedo confirmar si usan React concretamente sin inspeccionar el bundle
  servido (no tengo esa capacidad aquí). Es una suposición razonable —lo usan
  en otros interactivos suyos— pero no la des por verificada sin mirar tú
  mismo el código fuente/Network tab del navegador.

## Puesta en marcha

### 1. Datos

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/requirements.txt
python scripts/fetch_precios.py
```

En Windows PowerShell, activa el entorno con:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r scripts\requirements.txt
python scripts\fetch_precios.py
```

Si vuelves a abrir la terminal, activa de nuevo `.venv` antes de ejecutar el
script. Así `pip` instala las dependencias en el proyecto y no en el Python
del sistema (PEP 668).

El servidor del geoportal omite el certificado intermedio de FNMT. El script
incluye ese certificado en `scripts/certs/` y lo combina temporalmente con el
almacén de confianza del sistema, manteniendo la verificación TLS activa.

Esto genera `web/public/data/gasolineras.geojson` y `meta.json`. **La primera
vez, revisa la lista de columnas que imprime el script por consola**: los
nombres de columna exactos del Excel del MITECO pueden variar ligeramente
respecto a las palabras clave que he puesto en `FUEL_KEYWORDS` /
`INFO_KEYWORDS`; si algo no cuadra, ajusta esas listas (no hace falta tocar
el resto del script).

### 2. Frontend

```bash
cd web
npm install
npm run dev
```

### 3. Actualización automática cada hora

Para publicar en GitHub Pages, activa primero **Settings → Pages → Build and
deployment → Source → GitHub Actions**. GitHub no permite crear este sitio
automáticamente usando el `GITHUB_TOKEN` del workflow.

Después, el workflow `.github/workflows/update-data.yml` se ejecuta al subir
el proyecto y cada hora (`cron: "5 * * * *"`), regenera el GeoJSON, lo commitea
y reconstruye el sitio.
Si prefieres Vercel/Netlify, borra el segundo job (`desplegar-pages`); el
`git push` del primer job ya dispara su redeploy automático. También puedes
lanzarlo a mano desde la pestaña "Actions" de GitHub (`workflow_dispatch`).

Aparte, el frontend también vuelve a pedir el GeoJSON cada hora por si acaso
(`setInterval` en `App.jsx`), sin recargar la página.

## Filtros incluidos (más que el original)

- Tipo de combustible (95, 98, Gasóleo A/Premium/B, GLP, GNC)
- Precio máximo
- Provincia
- Marca / rótulo (texto libre: "Repsol", "Cepsa"...)
- Abiertas 24 h (deducido del campo horario)
- Radio en km desde tu ubicación (geolocalización)

Ideas fáciles de añadir después: filtro por municipio, ordenar resultados por
precio en una lista lateral, comparar dos combustibles a la vez, o marcar
"solo estaciones de bajo coste" (low-cost) si en el Excel viene ese campo.

## Limitaciones que debes saber

- No he podido probar el script contra el Excel real en este entorno (sin
  acceso a red para ejecutarlo), así que trátalo como un primer borrador
  sólido, no como código ya verificado end-to-end. Ejecuta el paso 1 y revisa
  el log.
- El estilo de mapa de OpenFreeMap es gratuito pero sin SLA; para producción
  con tráfico alto, valora una cuenta de Stadia Maps (tienen plan gratuito
  hasta cierto volumen) o MapTiler.
