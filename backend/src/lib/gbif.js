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
/**
 * @param limite  cuantas devolver. Por defecto TODAS las que encuentre: quien llama
 *   filtra por Colombia y recorta despues. Recortar antes de filtrar dejaba fuera
 *   justo las colombianas, que GBIF devuelve al final de una lista mundial.
 */
export async function buscarPorNombreComun(texto, limite = 60) {
  // 100 y no 30: el indice de nombres vulgares de GBIF es mundial y muy ruidoso. Con
  // "roble" las primeras decenas son hayas de Chile y bignoniaceas cubanas, y las
  // colombianas aparecen mas abajo. Quien filtra por Colombia es la ruta, que si tiene
  // las listas del pais delante.
  const datos = await pedir('/species/search', {
    q: texto,
    qField: 'VERNACULAR',
    rank: 'SPECIES',
    status: 'ACCEPTED',
    limit: '100',
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

/**
 * Categoria global de la Lista Roja de la UICN.
 *
 * Es distinta de la categoria nacional y las dos importan: el roble (Quercus humboldtii)
 * es Preocupacion Menor en el mundo y Vulnerable en Colombia, y aqui manda la nacional
 * porque es la que tiene efecto legal. Enseñar solo una de las dos da una idea falsa.
 *
 * GBIF republica la Lista Roja, asi que no hace falta la clave de la UICN.
 */
const NOMBRES_IUCN = {
  EXTINCT: 'Extinta',
  EXTINCT_IN_THE_WILD: 'Extinta en estado silvestre',
  CRITICALLY_ENDANGERED: 'En peligro critico',
  ENDANGERED: 'En peligro',
  VULNERABLE: 'Vulnerable',
  NEAR_THREATENED: 'Casi amenazada',
  LEAST_CONCERN: 'Preocupacion menor',
  DATA_DEFICIENT: 'Datos insuficientes',
  NOT_EVALUATED: 'No evaluada',
};

/**
 * Red de seguridad: todo lo que las listas colombianas no cubren.
 *
 * Las listas cargadas son flora, aves, mamiferos y peces de agua dulce. Reptiles,
 * anfibios, insectos y cualquier especie de fuera se quedaban sin ficha, y el usuario
 * veia "no encontrada" ante nombres perfectamente validos. Aqui GBIF resuelve la
 * taxonomia, los nombres comunes y si la especie tiene registros EN COLOMBIA, que es lo
 * que de verdad se pregunta.
 *
 * Es informacion de GBIF, no de una lista oficial colombiana, y se devuelve marcada como
 * tal para que la app no la pinte con el mismo peso.
 */
export async function fichaDeRespaldo(nombre) {
  const coincidencia = await pedir('/species/match', { name: nombre, strict: 'false' });
  if (!coincidencia?.usageKey || coincidencia.matchType === 'NONE') return null;

  const aceptado = coincidencia.species ?? coincidencia.canonicalName;

  const [enColombia, vernaculos] = await Promise.all([
    pedir('/occurrence/search', {
      scientificName: aceptado,
      country: 'CO',
      limit: '0',
    }),
    pedir(`/species/${coincidencia.usageKey}/vernacularNames`, { limit: '60' }),
  ]);

  const comunes = [
    ...new Set(
      (vernaculos?.results ?? [])
        .filter((v) => !v.language || v.language === 'spa' || v.language === 'es')
        .map((v) => v.vernacularName)
        .filter(Boolean)
    ),
  ].slice(0, 8);

  return {
    nombre: aceptado,
    nombre_completo: coincidencia.scientificName,
    reino: coincidencia.kingdom,
    clase: coincidencia.class,
    orden: coincidencia.order,
    familia: coincidencia.family,
    comunes,
    registros_en_colombia: enColombia?.count ?? 0,
    fuente: 'GBIF',
  };
}

export async function categoriaIucn(nombre) {
  const coincidencia = await pedir('/species/match', { name: nombre, strict: 'false' });
  if (!coincidencia?.usageKey) return null;

  const iucn = await pedir(`/species/${coincidencia.usageKey}/iucnRedListCategory`, {});
  if (!iucn?.category) return null;

  return {
    codigo: iucn.code ?? null,
    categoria: NOMBRES_IUCN[iucn.category] ?? iucn.category,
    amenazada: ['CRITICALLY_ENDANGERED', 'ENDANGERED', 'VULNERABLE'].includes(iucn.category),
    fuente: 'Lista Roja de la UICN, via GBIF',
  };
}
