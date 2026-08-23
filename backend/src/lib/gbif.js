/**
 * Consultas a GBIF (Global Biodiversity Information Facility).
 *
 * Se usa para dos cosas que las listas locales no cubren:
 *   - Traducir un nombre comun a nombres cientificos, porque el Catalogo de Plantas de
 *     Colombia no trae nombres vulgares y el indice local solo cubre las amenazadas.
 *   - Normalizar un nombre cientifico mal escrito o desactualizado al nombre aceptado.
 *
 * Es gratuita, no pide clave y no tiene cuota practica, asi que preguntar aqui antes
 * que a Gemini ahorra consultas del nivel gratuito. Si GBIF no responde, no pasa nada:
 * todas las funciones devuelven vacio y el flujo sigue con el modelo.
 */

const BASE = 'https://api.gbif.org/v1';
const TIEMPO_MAXIMO = 8000;

async function pedir(ruta, parametros) {
  const url = new URL(BASE + ruta);
  for (const [k, v] of Object.entries(parametros)) url.searchParams.set(k, v);

  const corte = AbortSignal.timeout(TIEMPO_MAXIMO);
  try {
    const respuesta = await fetch(url, { signal: corte });
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch (error) {
    // GBIF es una ayuda, no un requisito: si falla se sigue sin ella.
    console.warn(`[gbif] ${ruta} no respondio: ${error.message}`);
    return null;
  }
}

/**
 * Normaliza un nombre cientifico al nombre aceptado.
 * @returns {{ nombre: string, familia: string, reino: string, rango: string, confianza: number }|null}
 */
export async function normalizarNombre(nombre) {
  const datos = await pedir('/species/match', { name: nombre, strict: 'false' });
  if (!datos || datos.matchType === 'NONE') return null;

  return {
    nombre: datos.species ?? datos.canonicalName ?? datos.scientificName,
    nombre_completo: datos.scientificName,
    familia: datos.family,
    reino: datos.kingdom,
    clase: datos.class,
    orden: datos.order,
    rango: datos.rank,
    estado: datos.status,
    confianza: datos.confidence,
    tipo_de_coincidencia: datos.matchType,
  };
}

/**
 * Busca especies por nombre comun.
 *
 * Devuelve candidatas deduplicadas por nombre cientifico. Un nombre como "guayacan"
 * da mas de cien resultados en GBIF, asi que se corta pronto: la app tiene que hacer
 * elegir, no enterrar al usuario en una lista.
 *
 * @returns {Array<{ nombre: string, familia: string, reino: string, comunes: string[] }>}
 */
export async function buscarPorNombreComun(texto, limite = 8) {
  const datos = await pedir('/species/search', {
    q: texto,
    qField: 'VERNACULAR',
    rank: 'SPECIES',
    status: 'ACCEPTED',
    limit: '30',
  });
  if (!datos?.results) return [];

  const porNombre = new Map();

  for (const r of datos.results) {
    const nombre = r.species ?? r.canonicalName;
    if (!nombre) continue;

    const previa = porNombre.get(nombre) ?? {
      nombre,
      familia: r.family,
      reino: r.kingdom,
      clase: r.class,
      comunes: new Set(),
    };

    for (const v of r.vernacularNames ?? []) {
      // Nos quedamos con los nombres en espanol o sin idioma declarado: los ingleses
      // solo estorban a quien busca "chingale".
      if (v.language && v.language !== 'spa') continue;
      if (v.vernacularName) previa.comunes.add(v.vernacularName);
    }

    porNombre.set(nombre, previa);
  }

  return [...porNombre.values()]
    .slice(0, limite)
    .map((c) => ({ ...c, comunes: [...c.comunes].slice(0, 6) }));
}
