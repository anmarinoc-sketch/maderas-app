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
 * Una especie sin veda puede ser que no la tenga, o que la norma no este cargada, o que
 * sea fauna y el regimen ni siquiera le aplique. Por eso `veda.aplica` tiene tres
 * valores y `veda.por_autoridad` responde autoridad por autoridad en vez de soltar un
 * "no figura" que no distingue nada.
 */

const DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'datos');

const leer = (archivo) => JSON.parse(readFileSync(join(DATOS, archivo), 'utf8'));

const amenazadas = leer('amenazadas-colombia.json');
const flora = leer('flora-colombia.json');
const exoticas = leer('exoticas-colombia.json');
const aves = leer('aves-endemicas-colombia.json');
const fauna = leer('fauna-colombia.json');
const herpeto = leer('herpetofauna-colombia.json');
const comunes = leer('nombres-comunes.json');
const vedas = leer('vedas-colombia.json');
const citesNuevo = leer('cites-actualizaciones.json');
const vigencia = leer('vigencia-normas.json');

/* -------------------------------------------------------------------- vigencia */

/**
 * Cuando se comprobo por ultima vez que la norma sigue en pie.
 *
 * Una veda de 1977 sirve igual que una de 2020 SI sigue vigente, y no sirve de nada si
 * la derogaron: lo que importa no es la antiguedad de la norma, es la antiguedad de la
 * comprobacion. Eso es lo que se enseña, con su fecha, en vez de dejar que el usuario
 * suponga que alguien lo miro hace poco.
 *
 * El aviso se calcula en el servidor y no en el telefono a proposito: asi el dia que la
 * comprobacion caduque, la app instalada empieza a avisar sola, sin reinstalar nada.
 */
const MES = 30 * 24 * 60 * 60 * 1000;

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function mesesDesde(fecha) {
  const cuando = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(cuando)) return null;
  return Math.floor((Date.now() - cuando) / MES);
}

/** Bloque de vigencia listo para pintar: la app no hace cuentas con fechas. */
function vigenciaDe(id) {
  const suya = vigencia.normas?.[id];
  if (!suya) return undefined;

  const comprobado = suya.comprobado ?? vigencia.comprobado;
  const meses = mesesDesde(comprobado);
  const limite = vigencia.meses_para_revisar ?? 12;
  const caducada = meses !== null && meses >= limite;

  return {
    estado: suya.estado,
    comprobado,
    texto:
      `Vigente hasta donde se pudo comprobar el ` +
      `${FECHA_LARGA.format(new Date(`${comprobado}T00:00:00Z`))}.`,
    nota: suya.nota,
    // Cuando la comprobacion envejece, el aviso aparece solo. Es la unica forma de que
    // esto no se pudra en silencio: nadie se acuerda de revisar lo que no protesta.
    aviso: caducada
      ? `Esta comprobacion tiene ya ${meses} meses. Antes de cualquier tramite, ` +
        `confirma la norma vigente con la autoridad ambiental.`
      : undefined,
  };
}

/**
 * Apendices CITES que han cambiado despues del Catalogo, indexados por genero.
 *
 * El Catalogo es de 2023 y la CITES se mueve cada dos o tres anos, asi que sus datos
 * envejecen y lo hacen en silencio. Costo un aviso del usuario: el cedro figuraba en el
 * Apendice III cuando el genero Cedrela entero esta en el II desde 2020, y los guayacanes
 * (Handroanthus, Tabebuia) no figuraban en absoluto pese a haber entrado en el II en
 * noviembre de 2024. Eran 58 especies maderables mal marcadas o sin marcar.
 *
 * Esto MANDA sobre el Catalogo.
 */
const CITES_POR_GENERO = new Map(
  citesNuevo.generos.map((g) => [sinTildes(g.genero), g])
);

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

/** Lo mismo para la fauna, que tambien tiene que reconocerse como nombre cientifico. */
const GENEROS_FAUNA = new Set(
  [
    ...Object.keys(fauna.especies),
    ...Object.keys(aves.especies),
    ...Object.keys(herpeto.especies),
  ].map(genero)
);

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
      vigencia: vigenciaDe(norma.id),
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

/**
 * A que autoridad pertenece una norma, para agrupar.
 *
 * El usuario pregunta "esto tiene veda nacional o regional, y de quien". Agrupar por
 * el campo `autoridad` en bruto no sirve: las nacionales estan repartidas entre
 * INDERENA, el Ministerio y el Congreso, y eso a quien consulta le da igual.
 */
function autoridadDe(norma) {
  if (/CORNARE/i.test(norma.autoridad)) return 'CORNARE';
  if (/CORANTIOQUIA/i.test(norma.autoridad)) return 'CORANTIOQUIA';
  return 'NACIONAL';
}

const ETIQUETAS = {
  NACIONAL: 'Veda nacional (Minambiente)',
  CORANTIOQUIA: 'Veda regional — Corantioquia',
  CORNARE: 'Veda regional — Cornare',
};

/**
 * Estado de la especie frente a CADA autoridad, este vedada o no.
 *
 * Antes la app soltaba un "no figura en ninguna de las normas cargadas" seguido de un
 * parrafo de advertencia, y quien preguntaba se quedaba igual: no sabia si le faltaba
 * el permiso nacional, el regional o ninguno. Esto responde la pregunta tal como se
 * hace, autoridad por autoridad, y pone el aviso de listado incompleto SOLO donde
 * corresponde en vez de como un miedo general.
 *
 * LA FILA NACIONAL SOLO SALE CUANDO HAY VEDA NACIONAL DE VERDAD. Las vedas nacionales de
 * flora son pocas y casi todas por grupo —helechos arboreos, musgos, liquenes, quiches,
 * orquideas, Juglans, Quercus—, asi que en la inmensa mayoria de las consultas esa fila
 * repetia "sin veda" sin aportar nada, y encima empujaba abajo las dos regionales, que
 * son las que de verdad cambian de una especie a otra por aqui. En su lugar la app pinta
 * la condicion de amenaza de la Resolucion 0126 de 2024. Cuando la veda nacional SI
 * alcanza a la especie la fila vuelve, porque callar una prohibicion vigente es
 * exactamente el error que esta app no se puede permitir.
 */
function porAutoridad(encontradas) {
  const filas = Object.entries(ETIQUETAS).map(([id, etiqueta]) => {
    const suyas = vedas.normas.filter((n) => autoridadDe(n) === id);
    const acertadas = encontradas.filter((v) =>
      suyas.some((n) => n.norma === v.norma && n.autoridad === v.autoridad)
    );

    const incompletas = suyas.filter((n) => n.listado_incompleto);

    return {
      id,
      autoridad: etiqueta,
      vedada: acertadas.length > 0,
      normas: acertadas.map((v) => v.norma),
      listado_completo: incompletas.length === 0,
      aviso: incompletas.length
        ? `El listado de ${incompletas.map((n) => n.norma).join(' y ')} está incompleto en ` +
          'la app: aunque aquí no aparezca, puede estar vedada.'
        : undefined,
    };
  });

  return filas.filter((f) => f.id !== 'NACIONAL' || f.vedada);
}

/* ------------------------------------------------------------------- la consulta */

/**
 * Cruza un nombre cientifico contra las cuatro listas.
 * Devuelve siempre la misma forma, este o no la especie, con `en_listas` diciendo
 * en cuales aparecio: es lo que permite a la app no confundir silencio con negativa.
 */
/**
 * @param nombre
 * @param opciones.reinoSugerido  Reino que aporta quien llama cuando las listas no
 *   conocen la especie: el modelo dice si vio flora o fauna, y GBIF devuelve el reino.
 *   Sin esta pista, un perezoso —que no esta en ninguna lista— acabaria recibiendo el
 *   cuadro de vedas de flora, que no le aplica.
 */
export function consultarPorNombreCientifico(nombre, { reinoSugerido, respaldo } = {}) {
  const k = clave(nombre);
  if (!k) return null;

  const enFlora = flora.especies[k];
  const enAmenazadas = amenazadas.especies[k];
  const enExoticas = exoticas.especies[k];
  const enAves = aves.especies[k];
  const enFauna = fauna.especies[k];
  const enHerpeto = herpeto.especies[k];

  const ficha = {
    familia:
      enFlora?.familia ??
      enAmenazadas?.familia ??
      enAves?.familia ??
      enFauna?.familia ??
      enHerpeto?.familia ??
      respaldo?.familia,
    reino:
      enFlora?.reino ??
      enAmenazadas?.reino ??
      (enAves || enFauna || enHerpeto ? 'Animalia' : undefined) ??
      respaldo?.reino ??
      reinoSugerido,
    phylum: enFlora?.phylum,
  };

  /**
   * Las vedas cargadas son TODAS de flora silvestre.
   *
   * A la fauna no le aplica este regimen: lo suyo son las vedas de caza, que es otra
   * cosa y no esta cargada. Decirle a alguien que consulta un ave "no figura en ninguna
   * de las normas de veda" da a entender que se comprobo algo que no se comprobo. Ante
   * un animal, la app se calla sobre vedas y dice por que.
   */
  const esFauna = sinTildes(ficha.reino) === 'animalia';
  const lasVedas = esFauna ? [] : vedasDe(k, ficha);

  const elOrigen = determinarOrigen(enFlora, enExoticas, enAves, enFauna, esFauna, respaldo);

  /**
   * De una especie exotica, la ficha dice solo que es exotica.
   *
   * Lo que no es de aqui no puede ser endemico de Colombia, y la Resolucion 0126 de 2024
   * lista especies silvestres COLOMBIANAS: enseñar "no es endemica" y "no figura entre las
   * amenazadas" de un eucalipto o de una tilapia son dos huecos con aspecto de dato, que
   * es justo lo que esta app no debe producir. Vale igual para flora y para fauna.
   *
   * Lo que NO se calla: CITES, que aplica aunque la especie sea introducida —el hipopotamo
   * del Magdalena esta en el Apendice II, y media familia de las orquideas ornamentales
   * esta en el II—, el potencial invasor, que en una exotica es precisamente lo que hay
   * que mirar, y en flora LA VEDA, porque las vedas alcanzan por familia y una orquidea o
   * un helecho traidos de fuera caen dentro igual.
   *
   * Las dos condiciones de amenaza no son un adorno: si la resolucion o el Catalogo tienen
   * algo que decir de esta especie, manda lo que digan y la ficha se enseña entera.
   * Subestimar el riesgo es el peor error que puede cometer esta app.
   */
  const esExotica =
    elOrigen.valor === 'exotica' && !enAmenazadas && !enFlora?.amenaza_catalogo;

  return {
    clave: k,
    nombre_cientifico: enFlora?.nombre ?? enAmenazadas?.nombre ?? enExoticas?.nombre ?? nombre,
    autoria: enFlora?.autoria,
    familia: ficha.familia,
    reino: ficha.reino,
    clase: enAmenazadas?.clase ?? enFauna?.clase ?? enHerpeto?.clase ?? respaldo?.clase,
    nombres_comunes:
      [enAmenazadas?.comunes, enFauna?.comunes, enAves?.comunes, (respaldo?.comunes ?? []).join(' | ')]
        .filter(Boolean)
        .join(' | ') || undefined,

    en_listas: {
      catalogo_flora: Boolean(enFlora),
      amenazadas_nacional: Boolean(enAmenazadas),
      exoticas: Boolean(enExoticas),
      fauna_colombia: Boolean(enFauna),
      herpetofauna: Boolean(enHerpeto),
      aves_endemicas: Boolean(enAves),
    },

    // Que sea un animal, y que ademas sea de fuera. La app lo usa para decidir que
    // apartados tiene sentido pintar; el relato, para no hablar de conservarla aqui.
    es_fauna: esFauna,
    es_exotica: esExotica,
    // Forma antigua, la que entiende bio-v7. Se conserva por las mismas razones que
    // `vedas`: hay telefonos instalados que solo saben leer esta.
    fauna_exotica: esFauna && esExotica,

    origen: elOrigen,

    // Se devuelve el objeto, nunca null: quien consume esto lee `endemica.valor` directo.
    endemica: esExotica
      ? { valor: null, no_aplica: true, fuente: null }
      : endemismo(enFlora, enAves, enFauna, esFauna),

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
            vigencia: vigenciaDe('res-0126-2024'),
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
      // A una exotica no se le dice que "no figura en la Resolucion 0126": la resolucion
      // no la mira siquiera, asi que la frase daria a entender una comprobacion que no
      // significa nada.
      sin_categoria:
        !enAmenazadas && !enFlora?.amenaza_catalogo && !esExotica
          ? 'No figura en la Resolucion 0126 de 2024. Eso la deja fuera de las categorias CR, EN y VU; no quiere decir que este bien conservada.'
          : undefined,
    },

    cites: cites(k, enFlora),

    distribucion: {
      departamentos: enFlora?.departamentos ?? enFauna?.departamentos,
      altitud: enFlora?.altitud,
      regiones_biogeograficas: enFlora?.regiones,
      global: enFlora?.global,
      fuente: enFlora ? flora.fuente : enFauna ? fauna.fuente : null,
    },

    vedas: lasVedas,

    /**
     * Lo mismo, pero contestando a la pregunta tal como se hace: ¿tiene veda nacional?
     * ¿y regional, de quien? La app pinta esto; `vedas` se conserva para las versiones
     * ya instaladas, que no saben leer lo de abajo.
     */
    veda: esFauna
      ? {
          aplica: false,
          motivo:
            'Las vedas que consulta esta app son de FLORA silvestre. A la fauna le aplica ' +
            'otro regimen —vedas de caza y permisos de fauna— que no esta cargado, asi que ' +
            'esta app no puede decirte nada al respecto. Consulta a la autoridad ambiental.',
        }
      : {
          // Sin saber si es planta o animal no se puede afirmar que la consulta signifique
          // algo: se enseña lo encontrado, pero avisando de que puede no venir al caso.
          aplica: ficha.reino ? true : null,
          motivo: ficha.reino
            ? undefined
            : 'No se pudo determinar si es flora o fauna. Las vedas cargadas son solo de ' +
              'flora: si lo que consultas es un animal, esta consulta no viene al caso.',
          por_autoridad: porAutoridad(lasVedas),
          detalle: lasVedas,

          /*
           * Estar amenazada NO es estar vedada, pero tampoco deja la especie libre.
           *
           * La Resolucion 0126 de 2024 es un listado de amenaza y ella misma dice que no
           * modifica las vedas existentes. Aun asi, quien ve "sin veda" en una especie
           * en peligro se lleva una idea equivocada: las autoridades ambientales
           * restringen el aprovechamiento de las amenazadas por otras vias. Decir solo
           * "no" seria tecnicamente cierto y practicamente enganoso.
           */
          nota_amenazada: enAmenazadas
            ? `Sin veda no significa sin restricciones: esta especie figura como ` +
              `${enAmenazadas.categoria} en la ${amenazadas.norma}, y las autoridades ` +
              `ambientales restringen el aprovechamiento de las especies amenazadas. ` +
              `Consulta antes de intervenirla.`
            : undefined,
        },

    fuentes: [
      enAmenazadas && `${amenazadas.norma} (${amenazadas.autoridad})`,
      enFlora && flora.fuente,
      enExoticas && exoticas.fuente,
      lasVedas.length > 0 && 'Recopilacion de vedas de flora, MADS, y acuerdos corporativos',
    ].filter(Boolean),
  };
}

/**
 * Apendice CITES, con la correccion por delante del Catalogo.
 *
 * El orden importa: primero lo curado a mano, que esta al dia, y solo si no hay nada
 * ahi se recurre al Catalogo. Al reves, el cedro seguiria saliendo como Apendice III.
 */
/**
 * Hasta que reunion de la CITES estan revisados los apendices.
 *
 * Es la unica de las tres fuentes normativas de la app que cambia sola cada dos o tres
 * anos, y lo hace en silencio: el cedro figuro cuatro anos en el Apendice equivocado
 * porque nadie miro despues de la CoP18. Decir hasta donde se ha mirado es lo que
 * convierte ese riesgo en algo visible.
 */
function vigenciaCites() {
  const c = vigencia.cites;
  if (!c) return undefined;

  const comprobado = c.comprobado ?? vigencia.comprobado;
  const meses = mesesDesde(comprobado);
  const limite = vigencia.meses_para_revisar ?? 12;

  return {
    estado: c.estado,
    comprobado,
    texto: `Apendices revisados hasta la ${c.ultima_reunion_revisada}, en vigor desde el 5 de marzo de 2026.`,
    nota: c.nota,
    aviso:
      meses !== null && meses >= limite
        ? `Esa revision tiene ya ${meses} meses y puede haber habido otra reunion. ` +
          `Antes de exportar, confirma el apendice vigente en speciesplus.net.`
        : undefined,
  };
}

function cites(k, enFlora) {
  const actualizado = CITES_POR_GENERO.get(genero(k));

  if (actualizado) {
    return {
      vigencia: vigenciaCites(),
      apendice: actualizado.apendice,
      significado: CITES[actualizado.apendice],
      alcance: `Todo el genero ${actualizado.genero}`,
      desde: actualizado.desde,
      reunion: actualizado.reunion,
      anotacion: actualizado.anotacion,
      fuente: 'CITES',
      advertencia:
        'Los apendices CITES cambian cada dos o tres anos. Antes de exportar, confirma ' +
        'el apendice vigente en speciesplus.net.',
    };
  }

  if (!enFlora?.cites) return null;

  return {
    vigencia: vigenciaCites(),
    apendice: enFlora.cites,
    significado: CITES[enFlora.cites],
    fuente: `${flora.fuente} (datos de 2023)`,
    advertencia:
      'Dato de 2023. Los apendices CITES cambian cada dos o tres anos: antes de exportar, ' +
      'confirma el apendice vigente en speciesplus.net.',
  };
}

/**
 * Endemismo, buscandolo donde toque segun el grupo.
 *
 * El Catalogo de Plantas resuelve la flora. Para aves esta la lista del Humboldt, que
 * hizo falta porque la app decia "el endemismo no consta" del pauji colombiano
 * (Crax alberti), que es endemico y de los casos mas conocidos del pais: quedarse mudo
 * ante algo asi hace dudar del resto.
 *
 * De mamiferos, reptiles, anfibios, peces e insectos NO hay fuente cargada, y eso se
 * dice tal cual en vez de dejar un "no consta" que parece un no.
 */
function endemismo(enFlora, enAves, enFauna, esFauna) {
  if (enAves) {
    const esEndemica = sinTildes(enAves.categoria) === 'endemica';
    return {
      valor: esEndemica,
      categoria: enAves.categoria,
      fuente: aves.fuente,
      donde: enAves.donde,
      nota: esEndemica
        ? 'Endemica de Colombia: no vive de forma natural en ningun otro pais.'
        : 'Casi endemica: su distribucion desborda un poco las fronteras de Colombia.',
    };
  }

  if (enFlora?.origen) {
    return {
      valor: Boolean(enFlora.endemica),
      fuente: flora.fuente,
      nota: enFlora.endemica
        ? 'Endemica de Colombia: no existe de forma natural en ningun otro pais.'
        : undefined,
    };
  }

  // Aves, mamiferos y peces de agua dulce: las listas nacionales marcan el endemismo.
  if (enFauna) {
    return {
      valor: Boolean(enFauna.endemica),
      fuente: fauna.fuente,
      nota: enFauna.endemica
        ? 'Endemica de Colombia: no vive de forma natural en ningun otro pais.'
        : undefined,
    };
  }

  if (esFauna) {
    return {
      valor: null,
      fuente: null,
      nota:
        'No hay lista de endemismo cargada para este grupo. Estan las aves, los mamiferos ' +
        'y los peces de agua dulce, ademas de la flora. De reptiles, anfibios e ' +
        'invertebrados no se puede afirmar nada desde una fuente oficial colombiana.',
    };
  }

  return {
    valor: null,
    fuente: null,
    nota: enFlora
      ? 'Su ficha del Catalogo no trae el dato de origen: no consta.'
      : 'No esta en el Catalogo de plantas; no se puede afirmar nada.',
  };
}

/**
 * Nativa o exotica.
 *
 * El Catalogo es la fuente buena: dice "Nativa", "Endemica", "Cultivada" o
 * "Naturalizada". La lista de exoticas del Humboldt sirve de refuerzo y aporta el
 * continente de origen. Cuando ninguna la tiene, se dice que no se sabe y ya.
 */
function determinarOrigen(enFlora, enExoticas, enAves, enFauna, esFauna, respaldo) {
  // Un ave endemica o casi endemica de Colombia es nativa por definicion. Dejarlo en
  // "no consta" era absurdo teniendo el dato delante.
  if (enAves) {
    return {
      valor: 'nativa',
      detalle: `Nativa de Colombia (${enAves.categoria.toLowerCase()})`,
      fuente: aves.fuente,
    };
  }

  /*
   * Aves, mamiferos y peces: la lista nacional marca las exoticas y las endemicas, y
   * deja el campo vacio en las demas. En un inventario de la fauna DE Colombia, lo que
   * no esta marcado como exotico es de aqui, asi que el vacio se lee como nativa.
   */
  if (enFauna) {
    const exotica = /Ex[oó]tica|Introducida/i.test(enFauna.origen ?? '');
    return {
      valor: exotica ? 'exotica' : 'nativa',
      detalle: enFauna.origen,
      fuente: fauna.fuente,
    };
  }

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

  // GBIF no dice si es nativa, pero si cuantos registros hay en Colombia: presente en el
  // pais es la mitad de la respuesta, y es mejor que un silencio.
  if (respaldo?.registros_en_colombia > 0) {
    return {
      valor: 'desconocido',
      detalle: `Con ${respaldo.registros_en_colombia.toLocaleString('es-CO')} registros en Colombia (GBIF)`,
      fuente: 'GBIF',
      nota: 'Presente en Colombia, pero ninguna lista oficial cargada dice si es nativa o introducida.',
    };
  }

  return {
    valor: 'desconocido',
    detalle: null,
    fuente: null,
    nota: esFauna
      ? 'Las listas de origen que consulta esta app cubren flora y aves. De este grupo ' +
        'no hay fuente oficial cargada, asi que no se puede afirmar si es nativa o exotica.'
      : 'No esta en el Catalogo de plantas ni en la lista de exoticas.',
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

  /*
   * Coincidencia parcial POR PALABRAS, no por trozos de palabra.
   *
   * "roble negro" tiene que encontrar "roble", pero "lora" no puede encontrar
   * "passiflora": buscando la lora salian seis pasifloras y ni un solo loro. Comparar
   * substrings sueltos en nombres castellanos produce coincidencias absurdas.
   */
  const palabras = k.split(' ').filter((p) => p.length >= 3);
  if (palabras.length === 0) return [];

  const parciales = new Set();
  for (const [comun, claves] of Object.entries(comunes)) {
    const suyas = comun.split(' ');
    const encaja = palabras.every((p) => suyas.some((s) => s === p || s.startsWith(p)));
    if (encaja) claves.forEach((c) => parciales.add(c));
  }
  return [...parciales].slice(0, 12);
}

/**
 * Si la especie figura en alguna lista colombiana.
 *
 * Se usa para filtrar lo que devuelve GBIF al buscar un nombre vulgar: su indice es
 * mundial y con "roble" saca hayas de Chile y bignoniaceas cubanas antes que nada de
 * aqui. Quedarse con lo que existe en Colombia es lo que hace util la lista.
 */
export function estaEnColombia(nombre) {
  const k = clave(nombre);
  return Boolean(
    flora.especies[k] ||
      amenazadas.especies[k] ||
      aves.especies[k] ||
      fauna.especies[k] ||
      herpeto.especies[k]
  );
}

/**
 * Tiene forma de nombre cientifico: dos palabras latinas.
 *
 * No comprueba que exista, solo la forma. Sirve para decidir si vale la pena preguntar a
 * GBIF antes que al modelo: "Bothrops asper" merece una consulta gratuita a GBIF, y
 * "lora" no.
 */
export function pareceBinomio(texto) {
  return /^[a-z]+ [a-z]+$/.test(clave(texto));
}

/** Un nombre parece cientifico si es un binomio latino y su genero existe en las listas. */
export function pareceNombreCientifico(texto) {
  const k = clave(texto);
  if (!/^[a-z]+ [a-z]+$/.test(k)) return false;
  const g = genero(k);
  return (
    estaEnColombia(texto) ||
    Boolean(exoticas.especies[k]) ||
    INDICE.porGenero.has(g) ||
    GENEROS.has(g) ||
    GENEROS_FAUNA.has(g)
  );
}

/** Resumen para /health y para saber que se cargo. */
export function estadoDeListas() {
  return {
    amenazadas: { norma: amenazadas.norma, especies: Object.keys(amenazadas.especies).length },
    flora: { fuente: flora.url, especies: Object.keys(flora.especies).length },
    exoticas: { especies: Object.keys(exoticas.especies).length },
    fauna: {
      fuente: 'Aves (ACO), mamiferos y peces de agua dulce, SiB Colombia',
      especies: Object.keys(fauna.especies).length,
    },
    aves_endemicas: { especies: Object.keys(aves.especies).length },
    herpetofauna: {
      fuente: herpeto.fuente,
      especies: Object.keys(herpeto.especies).length,
    },
    nombres_comunes: Object.keys(comunes).length,
    vedas: { normas: vedas.normas.length, actualizado: vedas.actualizado },
    // Cuando se comprobo por ultima vez que lo que cita la app sigue en pie, y cuando
    // toca volver a mirarlo. Se expone en /api/listas para poder revisarlo sin abrir la app.
    vigencia: {
      comprobado: vigencia.comprobado,
      meses_desde_la_comprobacion: mesesDesde(vigencia.comprobado),
      revisar_cada_meses: vigencia.meses_para_revisar,
      como: vigencia.como,
      normas_comprobadas: Object.keys(vigencia.normas ?? {}).length,
      cites: vigenciaCites(),
    },
    // Lo que NO esta en disco y se resuelve preguntando fuera, en este orden.
    en_caliente: [
      'GBIF: especies fuera de las listas, nombres vulgares y categoria mundial de la UICN',
      'Wikipedia: fotografia de la especie',
      'Gemini: identificacion por foto y textos explicativos',
    ],
  };
}
