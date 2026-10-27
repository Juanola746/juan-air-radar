# Juan Air Radar

Radar de escritorio para iPad, centrado en San Fernando (SADF), con centro configurable, aeródromos, tráfico ADS-B, viento/METAR y radar meteorológico.

## GitHub Pages

La pantalla se publica desde la raíz de la rama `main`: Settings → Pages → Deploy from a branch → main → /(root). El archivo `config.js` contiene la URL del servicio de datos. Se puede cambiar desde el engranaje de la aplicación.

## Servicio de datos independiente

GitHub Pages aloja la pantalla, pero no ejecuta el servidor. Para tráfico y METAR hace falta un Worker independiente que consulte las fuentes, porque estas no permiten consultas directas desde Safari.

1. En una cuenta propia de Cloudflare Workers, crear un Worker y reemplazar su código por el contenido de `worker.js`.
2. Añadir una variable de texto `ALLOWED_ORIGIN` con `https://juanola746.github.io`, sin ruta ni barra final.
3. Publicar el Worker y copiar su URL HTTPS.
4. En `config.js`, completar `apiBase` con esa URL (sin `/api`). También se puede guardar en Configuración desde el iPad.

Mientras apiBase esté vacío, se mostrará CONFIGURAR FUENTE. Esto no significa que el iPad esté sin internet. No se muestran datos simulados. El mapa base y los aeródromos pueden verse sin ese servicio.

El código fuente modular del servidor y de la app está en `Codigo_fuente_completo.zip`. La copia desplegada de la pantalla tiene todos sus archivos en la raíz para facilitar su carga desde la web de GitHub.

## Instalar en iPad

Abrir la página con Safari → Compartir → Agregar a pantalla de inicio. Nombre: Juan Air Radar. Usar horizontal. Requiere internet. Los ajustes quedan guardados en el dispositivo.

## Fuentes

- Tráfico: adsb.lol (ODbL), con adsb.fi como respaldo para uso personal.
- METAR: Aviation Weather Center / NOAA-NWS.
- Radar meteorológico: RainViewer, cobertura variable. Sin cobertura no equivale a ausencia de lluvia.
- Aeródromos: OurAirports; centro SADF según ANAC.
- Mapa: Esri, Maxar y colaboradores. Fotografías: Planespotters.net con autoría visible.

Los datos de terceros tienen sus propias licencias y límites. Los créditos completos están en INFO / SOURCES dentro de la app. Leaflet conserva su aviso de licencia en leaflet.js. Proyecto independiente inspirado en un radar de escritorio; no es el software oficial de Sporty’s ni un instrumento de navegación.
