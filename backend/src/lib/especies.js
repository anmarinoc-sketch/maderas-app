import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Consulta de una especie contra las listas oficiales colombianas.
 *
 * Todo lo que tenga consecuencias legales o de conservacion sale de aqui, no del
 * modelo. Gemini mira la foto y redacta; estas listas mandan. Cuando una respuesta
 * mezcla ambas cosas, cada dato lleva de donde salio para que se pueda distinguir
 * un hecho verificable de una frase bien escrita.
 *
 * Regla que atraviesa todo el archivo: NO ENCONTRADO NO ES LO MISMO QUE NO APLICA.
 * Si una especie no esta en la lista de vedas puede ser que no este vedada, o que la
 * lista este incompleta (el listado de Cornare lo esta). La diferencia se devuelve
 * explicita en `cobertura`, y la app tiene que enseñarla.
 */

const DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'datos');

const leer = (archivo) => JSON.parse(readFileSync(join(DATOS, archivo), 'utf8'));

const amenazadas = leer('amenazadas-colombia.json');
const flora = leer('flora-colombia.json');
const exoticas = leer('exoticas-colombia.json');
const comunes = leer('nombres-comunes.json');
const vedas = leer('vedas-colombia.json');

/** Igual que en herramientas/construir-listas.js: las claves tienen que coincidir. */
export function sinTildes(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function clave(nombre) {
  return sinTildes(nombre)
    .replace(/[^a-z\s.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => p === 'sp.' || !p.endsWith('.'))
    .filter((p) => p !== 'x')
    .slice(0, 2)
    .join(' ');
}

const genero = (k) => String(k).split(' ')[0];

/**
 * Todos los generos que aparecen en el Catalogo, precalculados.
 *
 * Sirve para decidir si lo que ha escrito el usuario es un nombre cientifico. Se
 * calcula una vez al arrancar porque hacerlo en cada consulta obligaba a recorrer las
 * 44.000 claves del Catalogo, y eso son varios milisegundos regalados por peticion.
 */
const GENEROS = new Set(Object.keys(flora.especies).map(genero));

/* ------------------------------------------------------------------------ vedas */

/**
 * Indice de las vedas, armado una sola vez al arrancar.
 *
 * Una veda puede alcanzar a una especie por cuatro caminos distintos: por su nombre,
 * por su genero ("Juglans spp."), por su familia ("Orchidaceae") o por un grupo suelto
 * ("musgos", "liquenes"). Los cuatro tienen que consultarse, porque las normas viejas
 * mezclan los niveles sin ningun criterio.
 */
function indexarVedas() {
  const porEspecie = new Map();
  const porGenero = new Map();
  const porFamilia = new Map();
  const porGrupo = [];
  const universales = [];

  const anotar = (mapa, llave, norma, comoCoincide, comun) => {
    if (!llave) return;
    const lista = mapa.get(llave) ?? [];
    lista.push({ norma, comoCoincide, comun });
    mapa.set(llave, lista);
  };

  for (const norma of vedas.normas) {
    if (norma.aplica_a_todas_las_especies) universales.push(norma);

    for (const e of norma.especies ?? []) {
      anotar(porEspecie, clave(e.cientifico), norma, 'especie', e.comun);
      for (const alias of e.tambien ?? []) {
        anotar(porEspecie, clave(alias), norma, 'especie', e.comun);
      }
    }
    for (const g of norma.generos ?? []) {
      anotar(porGenero, sinTildes(g.genero), norma, 'genero', g.comun);
    }
    for (const f of norma.familias ?? []) {
      anotar(porFamilia, sinTildes(f.familia), norma, 'familia', f.comun);
    }
    for (const gr of norma.grupos ?? []) {
      porGrupo.push({ norma, grupo: gr });
    }
  }

  return { porEspecie, porGenero, porFamilia, porGrupo, universales };
}

const INDICE = indexarVedas();

/**
 * Que vedas alcanzan a esta especie.
 *
 * Una misma norma puede alcanzarla por varios caminos a la vez: la Resolucion 0801 de
 * 1977 nombra tanto el genero Cyathea como la familia Cyatheaceae, y una Cyathea encaja
 * por los dos. Es una sola veda, asi que se agrupa por norma y se acumulan los caminos
 * en `coincide_por`; enseñarla dos veces solo haria dudar de si son dos prohibiciones.
 *
 * @param k        clave de la especie
 * @param ficha    lo que sepamos de ella (familia, reino, phylum) para los grupos
 */
export function vedasDe(k, ficha = {}) {
  const porNorma = new Map();

  const sumar = ({ norma, comoCoincide, comun }) => {
    const previa = porNorma.get(norma.id);
    if (previa) {
      if (!previa.coincide_por.includes(comoCoincide)) previa.coincide_por.push(comoCoincide);
      if (comun && !previa.nombre_en_la_norma) previa.nombre_en_la_norma = comun;
      return;
    }
    porNorma.set(norma.id, {
      norma: norma.norma,
      autoridad: norma.autoridad,
      ambito: norma.ambito,
      territorio: norma.territorio,
      efecto: norma.efecto,
      excepciones: norma.excepciones,
      coincide_por: [comoCoincide],
      nombre_en_la_norma: comun,
      listado_incompleto: norma.listado_incompleto,
    });
  };

  for (const c of INDICE.porEspecie.get(k) ?? []) sumar(c);
  for (const c of INDICE.porGenero.get(genero(k)) ?? []) sumar(c);
  for (const c of INDICE.porFamilia.get(sinTildes(ficha.familia)) ?? []) sumar(c);

  for (const { norma, grupo } of INDICE.porGrupo) {
    const porPhylum = (grupo.coincide_phylum ?? []).some(
      (p) => sinTildes(p) === sinTildes(ficha.phylum)
    );
    const porReino = (grupo.coincide_reino ?? []).some(
      (r) => sinTildes(r) === sinTildes(ficha.reino)
    );
    if (porPhylum || porReino) sumar({ norma, comoCoincide: 'grupo', comun: grupo.comun });
  }

  return [...porNorma.values()];
}

/** Que partes del mapa de vedas estan incompletas. Se devuelve siempre, haya o no veda. */
function coberturaDeVedas() {
  const incompletas = vedas.normas
    .filter((n) => n.listado_incompleto)
    .map((n) => `${n.norma} (${n.autoridad})`);

  return {
    completa: incompletas.length === 0,
    listados_incompletos: incompletas,
    advertencia:
      'No aparecer en esta consulta NO significa que la especie no este vedada: ' +
      'el listado de Cornare esta incompleto y las vedas regionales de otras corporaciones ' +
      'no estan cargadas. Verifica siempre ante la autoridad ambiental competente.',
    nota_procedimiento: vedas.nota_procedimiento,
    detalle_cobertura: vedas.cobertura,
    vedas_de_ambito_condicionado: INDICE.universales.map((n) => ({
      norma: n.norma,
      territorio: n.territorio,
      efecto: n.efecto,
    })),
  };
}

/* ------------------------------------------------------------------- la consulta */

/**
 * Cruza un nombre cientifico contra las cuatro listas.
 * Devuelve siempre la misma forma, este o no la especie, con `en_listas` diciendo
 * en cuales aparecio: es lo que permite a la app no confundir silencio con negativa.
 */
export function consultarPorNombreCientifico(nombre) {
  const k = clave(nombre);
  if (!k) return null;

  const enFlora = flora.especies[k];
  const enAmenazadas = amenazadas.especies[k];
  const enExoticas = exoticas.especies[k];

  const ficha = {
    familia: enFlora?.familia ?? enAmenazadas?.familia,
    reino: enFlora?.reino ?? enAmenazadas?.reino,
    phylum: enFlora?.phylum,
  };

  const lasVedas = vedasDe(k, ficha);

  return {
    clave: k,
    nombre_cientifico: enFlora?.nombre ?? enAmenazadas?.nombre ?? enExoticas?.nombre ?? nombre,
    autoria: enFlora?.autoria,
    familia: ficha.familia,
    reino: ficha.reino,
    clase: enAmenazadas?.clase,
    nombres_comunes: enAmenazadas?.comunes,

    en_listas: {
      catalogo_flora: Boolean(enFlora),
      amenazadas_nacional: Boolean(enAmenazadas),
      exoticas: Boolean(enExoticas),
    },

    origen: determinarOrigen(enFlora, enExoticas),

    // Estar en el Catalogo no basta: hay fichas sin el dato de origen, y en esas el
    // endemismo no consta. Decir "false" ahi seria afirmar que no es endemica, que es
    // justo lo que no sabemos.
    endemica: enFlora?.origen
      ? {
          valor: Boolean(enFlora.endemica),
          fuente: flora.fuente,
          nota: enFlora.endemica
            ? 'Endemica de Colombia: no existe de forma natural en ningun otro pais.'
            : undefined,
        }
      : {
          valor: null,
          fuente: null,
          nota: enFlora
            ? 'Su ficha del Catalogo no trae el dato de origen: no consta.'
            : 'No esta en el Catalogo de plantas; no se puede afirmar nada.',
        },

    amenaza: {
      nacional: enAmenazadas
        ? {
            categoria: enAmenazadas.categoria,
            significado: SIGNIFICADO[enAmenazadas.categoria],
            norma: amenazadas.norma,
            autoridad: amenazadas.autoridad,
            // La resolucion a veces categoriza cada subespecie por separado y con
            // categorias distintas. `categoria` es la PEOR del grupo, y aqui va el
            // desglose: la danta figura como VU, pero la subespecie colombiana es CR.
            desglose: enAmenazadas.desglose,
            nota_desglose: enAmenazadas.desglose
              ? 'La resolucion categoriza por separado las subespecies. Se muestra la ' +
                'categoria mas grave del grupo; comprueba abajo cual te aplica.'
              : undefined,
          }
        : null,
      // El Catalogo trae su propia lectura, que puede diferir de la norma vigente.
      catalogo: enFlora?.amenaza_catalogo
        ? { categoria: enFlora.amenaza_catalogo, fuente: flora.fuente }
        : null,
      sin_categoria:
        !enAmenazadas && !enFlora?.amenaza_catalogo
          ? 'No figura en la Resolucion 0126 de 2024. Eso la deja fuera de las categorias CR, EN y VU; no quiere decir que este bien conservada.'
          : undefined,
    },

    // Los apendices CITES cambian en cada conferencia de las partes y el Catalogo es de
    // 2023: el cedro (Cedrela odorata) figura aqui en el III cuando el genero entero paso
    // al II. Por eso el dato va con la advertencia pegada y nunca se presenta como ultima
    // palabra. Para un tramite de exportacion hay que mirar speciesplus.net.
    cites: enFlora?.cites
      ? {
          apendice: enFlora.cites,
          significado: CITES[enFlora.cites],
          fuente: `${flora.fuente} (datos de 2023)`,
          advertencia:
            'Los apendices CITES se actualizan cada dos o tres anos. Antes de exportar, ' +
            'confirma el apendice vigente en speciesplus.net.',
        }
      : null,

    distribucion: {
      departamentos: enFlora?.departamentos,
      altitud: enFlora?.altitud,
      regiones_biogeograficas: enFlora?.regiones,
      global: enFlora?.global,
      fuente: enFlora ? flora.fuente : null,
    },

    vedas: lasVedas,
    cobertura_vedas: coberturaDeVedas(),

    fuentes: [
      enAmenazadas && `${amenazadas.norma} (${amenazadas.autoridad})`,
      enFlora && flora.fuente,
      enExoticas && exoticas.fuente,
      lasVedas.length > 0 && 'Recopilacion de vedas de flora, MADS, y acuerdos corporativos',
    ].filter(Boolean),
  };
}

/**
 * Nativa o exotica.
 *
 * El Catalogo es la fuente buena: dice "Nativa", "Endemica", "Cultivada" o
 * "Naturalizada". La lista de exoticas del Humboldt sirve de refuerzo y aporta el
 * continente de origen. Cuando ninguna la tiene, se dice que no se sabe y ya.
 */
function determinarOrigen(enFlora, enExoticas) {
  if (enFlora?.origen) {
    const texto = sinTildes(enFlora.origen);
    const esNativa = texto.includes('nativa') || texto.includes('endemica');
    return {
      valor: esNativa ? 'nativa' : 'exotica',
      detalle: enFlora.origen,
      origen_geografico: enExoticas?.origen,
      invasividad: enExoticas?.invasividad,
      fuente: 'Catalogo de Plantas y Liquenes de Colombia',
    };
  }

  if (enExoticas) {
    return {
      valor: 'exotica',
      detalle: enExoticas.estatus,
      origen_geografico: enExoticas.origen,
      invasividad: enExoticas.invasividad,
      fuente: exoticas.fuente,
    };
  }

  return {
    valor: 'desconocido',
    detalle: null,
    fuente: null,
    nota: 'No esta en el Catalogo de plantas ni en la lista de exoticas. Si es un animal, es lo normal: esas listas solo cubren flora.',
  };
}

const SIGNIFICADO = {
  CR: 'En peligro critico: riesgo extremadamente alto de extincion en estado silvestre.',
  EN: 'En peligro: riesgo muy alto de extincion en estado silvestre.',
  VU: 'Vulnerable: riesgo alto de extincion en estado silvestre.',
};

const CITES = {
  I: 'Apendice I: comercio internacional prohibido salvo casos excepcionales.',
  II: 'Apendice II: el comercio internacional exige permiso de exportacion.',
  III: 'Apendice III: especie protegida en al menos un pais, que pide cooperacion para controlar su comercio.',
};

/* ---------------------------------------------------------------- nombres comunes */

/**
 * Candidatas para un nombre comun, usando el indice local.
 *
 * Es deliberadamente pequeño: solo cubre las especies amenazadas, porque el Catalogo
 * no trae nombres vulgares. Lo que no salga de aqui se resuelve con GBIF y, en ultimo
 * termino, proponiendolo el modelo y verificandolo contra estas mismas listas.
 */
export function candidatasPorNombreComun(texto) {
  const k = clave(texto);
  if (!k) return [];

  const exactas = comunes[k] ?? [];
  if (exactas.length > 0) return exactas;

  // Coincidencia parcial: "roble negro" tambien debe encontrar "roble".
  const parciales = new Set();
  for (const [comun, claves] of Object.entries(comunes)) {
    if (comun.includes(k) || k.includes(comun)) claves.forEach((c) => parciales.add(c));
  }
  return [...parciales].slice(0, 12);
}

/** Un nombre parece cientifico si es un binomio latino y su genero existe en las listas. */
export function pareceNombreCientifico(texto) {
  const k = clave(texto);
  if (!/^[a-z]+ [a-z]+$/.test(k)) return false;
  const g = genero(k);
  return (
    Boolean(flora.especies[k]) ||
    Boolean(amenazadas.especies[k]) ||
    Boolean(exoticas.especies[k]) ||
    INDICE.porGenero.has(g) ||
    GENEROS.has(g)
  );
}

/** Resumen para /health y para saber que se cargo. */
export function estadoDeListas() {
  return {
    amenazadas: { norma: amenazadas.norma, especies: Object.keys(amenazadas.especies).length },
    flora: { fuente: flora.url, especies: Object.keys(flora.especies).length },
    exoticas: { especies: Object.keys(exoticas.especies).length },
    nombres_comunes: Object.keys(comunes).length,
    vedas: { normas: vedas.normas.length, actualizado: vedas.actualizado },
  };
}
