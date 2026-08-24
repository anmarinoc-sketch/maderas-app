/**
 * Fotografia de una especie.
 *
 * Se saca de Wikipedia por el nombre cientifico: es gratis, no pide clave, tiene foto de
 * casi todo lo que a alguien se le ocurra buscar, y las imagenes son de Wikimedia
 * Commons, con licencia libre. Se prueba primero la Wikipedia en espanol y luego la
 * inglesa, que cubre mucho mas en especies poco conocidas.
 *
 * No es un dato oficial ni pretende serlo: sirve para reconocer de un vistazo si lo que
 * la app propone se parece a lo que se tiene delante. Por eso la app la muestra con el
 * nombre encima y no como prueba de nada.
 */

const TIEMPO_MAXIMO = 6000;

/**
 * Cache en memoria. Sin ella, cada consulta a la misma especie repite dos llamadas a
 * Wikipedia; con ella, el segundo vistazo a un roble es instantaneo. Se pierde al
 * reiniciar, que es lo correcto: asi una foto retirada de Wikipedia desaparece sola.
 */
const cache = new Map();
const MAX_CACHE = 500;

async function buscarEn(idioma, nombre) {
  const url = new URL(`https://${idioma}.wikipedia.org/w/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'pageimages');
  url.searchParams.set('piprop', 'thumbnail|original');
  url.searchParams.set('pithumbsize', '900');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('titles', nombre);

  try {
    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(TIEMPO_MAXIMO),
      headers: { 'User-Agent': 'BioScan/1.0 (app de identificacion de especies)' },
    });
    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    const paginas = Object.values(datos?.query?.pages ?? {});
    const pagina = paginas.find((p) => p?.thumbnail?.source);
    if (!pagina) return null;

    return {
      url: pagina.thumbnail.source,
      ancho: pagina.thumbnail.width,
      alto: pagina.thumbnail.height,
      titulo: pagina.title,
      fuente: `Wikipedia (${idioma})`,
      pagina: `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(pagina.title)}`,
    };
  } catch (error) {
    // La foto es un adorno util, no un requisito: si Wikipedia no responde, no pasa nada.
    console.warn(`[foto] ${idioma}:${nombre} no respondio: ${error.message}`);
    return null;
  }
}

/**
 * @param {string} nombreCientifico
 * @returns {Promise<{url:string,fuente:string,pagina:string}|null>}
 */
export async function fotoDeEspecie(nombreCientifico) {
  const clave = String(nombreCientifico ?? '').trim();
  if (!clave) return null;

  if (cache.has(clave)) return cache.get(clave);

  const foto = (await buscarEn('es', clave)) ?? (await buscarEn('en', clave));

  // Se guarda incluso el null: no encontrar foto tambien cuesta dos llamadas.
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(clave, foto);

  return foto;
}
