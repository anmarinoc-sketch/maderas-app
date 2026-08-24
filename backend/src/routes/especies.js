import { Router } from 'express';

import { AppError, errores } from '../lib/errors.js';
import {
  candidatasPorNombreComun,
  consultarPorNombreCientifico,
  estadoDeListas,
  estaEnColombia,
  pareceBinomio,
  pareceNombreCientifico,
} from '../lib/especies.js';
import {
  buscarPorNombreComun,
  categoriaIucn,
  fichaDeRespaldo,
  normalizarNombre,
} from '../lib/gbif.js';
import { identificarPorFoto, redactarRelato, resolverNombre } from '../lib/gemini-especies.js';
import { fotoDeEspecie } from '../lib/foto.js';
import { bufferDesdeBase64, validarImagen } from '../lib/image.js';
import { requiereAppKey } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { recibirImagen } from '../middleware/upload.js';

export const router = Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Anade a un nombre cientifico todo lo que digan las listas oficiales, y opcionalmente
 * el relato redactado por el modelo.
 *
 * El relato es lo unico que gasta cuota, y se degrada solo: si Gemini no contesta o se
 * quedo sin cuota, la ficha oficial se devuelve igual. Es a proposito. Los datos que de
 * verdad importan estan en disco, asi que la app tiene que seguir sirviendo el dia que
 * se agoten las consultas.
 */
async function armarFicha(nombreCientifico, { conRelato, reinoSugerido, respaldo }) {
  let oficial = consultarPorNombreCientifico(nombreCientifico, { reinoSugerido, respaldo });
  if (!oficial) return null;

  /*
   * Si las listas locales dan poco, se completa con GBIF antes de seguir.
   *
   * Pasa con los reptiles y los anfibios: su indice se deduce de los registros de GBIF y
   * solo trae taxonomia, sin nombres comunes ni origen. Sin este paso, reconocerlos en la
   * lista los dejaba PEOR que cuando no se reconocian, porque entonces caian en el
   * respaldo de GBIF y volvian con nombres comunes.
   */
  const escasa = !oficial.nombres_comunes || oficial.origen.valor === 'desconocido';
  if (escasa && !respaldo) {
    const extra = await fichaDeRespaldo(oficial.nombre_cientifico);
    if (extra) {
      oficial = consultarPorNombreCientifico(nombreCientifico, {
        reinoSugerido,
        respaldo: extra,
      });
    }
  }

  const ficha = { ...oficial, relato: null, relato_no_disponible: null };

  /*
   * Categoria global de la UICN, ademas de la nacional.
   *
   * Las dos importan y no siempre coinciden: el roble es Preocupacion Menor en el mundo
   * y Vulnerable en Colombia. Aqui manda la nacional, que es la que tiene efecto legal,
   * pero enseñar solo una de las dos da una idea falsa de la especie.
   *
   * Es una llamada a GBIF, gratuita. Si falla, la ficha sale igual sin ella.
   */
  // La categoria mundial y la foto se piden a la vez: son dos servicios distintos y
  // encadenarlas solo sumaria esperas.
  const [global, foto] = await Promise.all([
    categoriaIucn(oficial.nombre_cientifico),
    fotoDeEspecie(oficial.nombre_cientifico),
  ]);
  ficha.amenaza = { ...ficha.amenaza, global };
  ficha.foto = foto;

  if (!conRelato) return ficha;

  try {
    const { resultado, modelo } = await redactarRelato({
      nombre_cientifico: oficial.nombre_cientifico,
      familia: oficial.familia,
      oficial: {
        origen: oficial.origen,
        endemica: oficial.endemica,
        amenaza: oficial.amenaza,
        cites: oficial.cites,
        distribucion: oficial.distribucion,
        vedas: oficial.vedas,
      },
    });
    ficha.relato = { ...resultado, generado_por: modelo };

    /*
     * Si las listas no saben si es nativa o exotica, se usa lo que diga el modelo.
     *
     * Pasa sobre todo con la fauna: las listas de origen cubren flora y aves. Dejar un
     * "no consta" ante "¿es nativa?" de un animal comun no ayuda a nadie, asi que se
     * responde, pero con la fuente cambiada a "modelo" para que la app lo pinte como lo
     * que es: una respuesta sin verificar, no un dato oficial.
     */
    const propuesto = resultado.origen_si_no_consta;
    const sirve = propuesto && ['nativa', 'exotica'].includes(propuesto.valor);
    if (ficha.origen?.valor === 'desconocido' && sirve) {
      ficha.origen = {
        valor: propuesto.valor,
        detalle: propuesto.explicacion,
        fuente: null,
        segun_el_modelo: true,
        nota: 'No figura en las listas oficiales cargadas: lo dice el modelo, sin verificar.',
      };
    }
  } catch (error) {
    // Un fallo aqui no invalida la consulta: la parte oficial ya esta resuelta.
    ficha.relato_no_disponible =
      error instanceof AppError ? error.message : 'No se pudo redactar la explicacion.';
    console.warn(`[relato] ${nombreCientifico}: ${ficha.relato_no_disponible}`);
  }

  return ficha;
}

/**
 * Palabras con las que el modelo dice "no lo se" cuando el esquema le exige un nombre.
 * Buscarlas en las listas devolveria una ficha vacia pero con forma de ficha, y la app
 * pintaria una especie llamada "desconocido". Mejor devolver null y que se vea el hueco.
 */
const NO_ES_UN_NOMBRE = new Set(['desconocido', 'indeterminado', 'no visible', 'n/a', 'ninguno']);

/**
 * El grupo que ve el modelo, traducido a reino.
 *
 * Sirve de pista cuando la especie no esta en ninguna lista: sin ella, un perezoso
 * recibiria el cuadro de vedas de flora, que no le aplica.
 */
const REINO_DEL_GRUPO = { flora: 'Plantae', fauna: 'Animalia', hongo: 'Fungi' };

function fichaOficialDe(nombre, grupo) {
  const limpio = String(nombre ?? '').trim().toLowerCase();
  if (!limpio || NO_ES_UN_NOMBRE.has(limpio)) return null;
  return consultarPorNombreCientifico(nombre, {
    reinoSugerido: REINO_DEL_GRUPO[String(grupo ?? '').toLowerCase()],
  });
}

/** Etiqueta que deja claro de donde sale cada mitad de la respuesta. */
const PROCEDENCIA = {
  listas_oficiales:
    'Origen, endemismo, amenaza, CITES, distribucion y vedas salen de las listas ' +
    'oficiales cargadas en el servidor, con su norma citada.',
  modelo:
    'La identificacion a partir de la foto y los textos explicativos los produce ' +
    'Gemini, y pueden equivocarse. Contrasta el nombre con los caracteres observados.',
};

/* --------------------------------------------------------- identificar por foto */

/**
 * POST /api/identificar-especie
 *
 * Acepta la imagen igual que XiloScan: multipart con el campo "imagen", o JSON con
 * { "imagen_base64": "..." }.
 */
router.post(
  '/identificar-especie',
  requiereAppKey,
  rateLimit,
  recibirImagen,
  asyncHandler(async (req, res) => {
    const bruto = req.file?.buffer
      ? req.file.buffer
      : req.body?.imagen_base64
        ? bufferDesdeBase64(req.body.imagen_base64)
        : null;

    if (!bruto) throw errores.sinImagen();

    const imagen = validarImagen(bruto);

    const inicio = Date.now();
    const { resultado, modelo, uso } = await identificarPorFoto(imagen);
    const latenciaMs = Date.now() - inicio;

    // La ficha oficial se arma para la principal y para cada alternativa: asi el usuario
    // ve de un vistazo que la segunda opcion si esta vedada y la primera no.
    const principal = fichaOficialDe(resultado.nombre_cientifico, resultado.grupo);

    const alternativas = (resultado.alternativas ?? []).map((a) => ({
      ...a,
      oficial: fichaOficialDe(a.nombre_cientifico, resultado.grupo),
    }));

    console.log(
      `[ok] ${req.requestId} especie ${(imagen.bytes / 1024).toFixed(0)} KB -> ` +
        `${resultado?.nombre_cientifico ?? 'sin nombre'} ` +
        `(conf ${resultado?.confianza ?? '?'}, ${latenciaMs} ms)`
    );

    res.json({
      ok: true,
      request_id: req.requestId,
      modelo,
      latencia_ms: latenciaMs,
      uso,
      procedencia: PROCEDENCIA,
      identificacion: resultado,
      oficial: principal,
      alternativas,
    });
  })
);

/* ------------------------------------------------------------ consultar por nombre */

/**
 * GET /api/especie?q=roble&relato=1
 *
 * Resuelve el nombre en tres pasos, del mas barato al mas caro, y para en cuanto uno
 * responde. Los dos primeros no gastan ni una consulta de Gemini:
 *   1. Es un nombre cientifico que esta en las listas -> ficha directa.
 *   2. Es un nombre comun -> se unen el indice local y GBIF, se filtra por Colombia y se
 *      enseñan TODAS las opciones, porque un nombre comun casi nunca designa una sola cosa.
 *   3. Nada lo reconoce -> se lo preguntamos al modelo y lo verifican las listas.
 */
router.get(
  '/especie',
  requiereAppKey,
  rateLimit,
  asyncHandler(async (req, res) => {
    const consulta = String(req.query.q ?? '').trim();
    const conRelato = req.query.relato !== '0';

    if (consulta.length < 2) {
      throw new AppError(
        400,
        'CONSULTA_VACIA',
        'Escribe el nombre de la especie que quieres consultar.',
        'Vale el nombre comun ("roble", "chingale") o el cientifico ("Quercus humboldtii").'
      );
    }

    const responder = (extra) =>
      res.json({ ok: true, request_id: req.requestId, consulta, procedencia: PROCEDENCIA, ...extra });

    /* 1. Nombre cientifico conocido, en cualquiera de las listas. */
    if (pareceNombreCientifico(consulta)) {
      const ficha = await armarFicha(consulta, { conRelato });
      const enAlguna = Object.values(ficha?.en_listas ?? {}).some(Boolean);
      if (enAlguna) return responder({ resuelto_por: 'listas_oficiales', ficha });
    }

    /*
     * 1b. Tiene forma de nombre cientifico pero no esta en ninguna lista colombiana.
     *
     * Aqui caen reptiles, anfibios, insectos y cualquier especie de fuera. GBIF los
     * resuelve gratis, asi que se pregunta ANTES que al modelo: gastar una consulta de
     * cuota en algo que una API publica contesta seria tirarla.
     */
    if (pareceBinomio(consulta)) {
      const respaldo = await fichaDeRespaldo(consulta);
      if (respaldo) {
        return responder({
          resuelto_por: 'gbif',
          ficha: await armarFicha(respaldo.nombre, { conRelato, respaldo }),
        });
      }
    }

    /*
     * 2 y 3. Nombre comun: SIEMPRE se enseñan todas las opciones.
     *
     * Antes, si el indice local resolvia el nombre a una sola especie, se saltaba GBIF y
     * se iba derecho a la ficha. Con "roble" eso daba solo Quercus humboldtii y ocultaba
     * el flor morado (Tabebuia rosea) y el roble negro, que es justo lo que hay que ver
     * antes de decidir. Un nombre comun casi nunca designa una sola cosa.
     *
     * Las dos fuentes se unen: el indice local cubre las especies amenazadas y las aves,
     * y GBIF el resto. Lo de GBIF se filtra por Colombia porque su indice es mundial y
     * con "roble" saca antes hayas de Chile que nada de aqui.
     */
    const candidatas = new Map();

    for (const k of candidatasPorNombreComun(consulta)) {
      const ficha = consultarPorNombreCientifico(k);
      if (ficha) candidatas.set(ficha.clave, resumirCandidata(ficha));
    }

    for (const c of await buscarPorNombreComun(consulta)) {
      if (!estaEnColombia(c.nombre)) continue;
      const ficha = consultarPorNombreCientifico(c.nombre, { reinoSugerido: c.reino });
      if (!ficha || candidatas.has(ficha.clave)) continue;
      candidatas.set(ficha.clave, {
        ...resumirCandidata(ficha),
        nombres_comunes: c.comunes.join(', ') || undefined,
      });
    }

    // Se recorta DESPUES de filtrar, y a un numero que quepa en una pantalla.
    const opciones = ordenarCandidatas([...candidatas.values()]).slice(0, 12);

    if (opciones.length === 1) {
      return responder({
        resuelto_por: 'nombre_comun',
        ficha: await armarFicha(opciones[0].nombre_cientifico, { conRelato }),
      });
    }
    if (opciones.length > 1) {
      return responder({
        resuelto_por: 'nombre_comun',
        hay_que_elegir: true,
        aviso: `"${consulta}" designa varias especies en Colombia. Elige cuál quieres consultar.`,
        candidatas: opciones,
      });
    }

    /* 4. Ultimo recurso: que lo proponga el modelo, y lo verifican las listas. */
    const { resultado, modelo } = await resolverNombre(consulta);
    const propuestas = (resultado.candidatas ?? []).filter((c) => c.nombre_cientifico);

    if (!resultado.reconocido || propuestas.length === 0) {
      return responder({
        resuelto_por: 'ninguna_fuente',
        encontrada: false,
        aviso:
          `No se pudo identificar a que especie corresponde "${consulta}". ` +
          'Prueba con el nombre cientifico, o con otro de los nombres comunes que uses.',
        nota_del_modelo: resultado.nota,
      });
    }

    if (propuestas.length === 1) {
      // Antes de dar el nombre por bueno se pasa por GBIF, que corrige la ortografia y
      // los nombres desactualizados que el modelo repite a menudo.
      const normalizado = await normalizarNombre(propuestas[0].nombre_cientifico);
      const nombre = normalizado?.nombre ?? propuestas[0].nombre_cientifico;
      return responder({
        resuelto_por: 'modelo',
        propuesto_por_el_modelo: propuestas[0],
        modelo,
        ficha: await armarFicha(nombre, {
          conRelato,
          reinoSugerido:
            REINO_DEL_GRUPO[String(propuestas[0].grupo ?? '').toLowerCase()] ?? normalizado?.reino,
        }),
      });
    }

    return responder({
      resuelto_por: 'modelo',
      modelo,
      hay_que_elegir: true,
      aviso: `"${consulta}" puede referirse a varias especies. Elige cual quieres consultar.`,
      nota_del_modelo: resultado.nota,
      candidatas: propuestas.map((c) => ({
        ...resumirCandidata(consultarPorNombreCientifico(c.nombre_cientifico)),
        nombre_comun: c.nombre_comun,
        donde_se_usa: c.donde_se_usa,
      })),
    });
  })
);

/**
 * Lo justo para pintar una fila de la lista de candidatas: el nombre, y las dos
 * banderas que hacen que el usuario elija una u otra.
 */
function resumirCandidata(ficha) {
  if (!ficha) return null;
  return {
    nombre_cientifico: ficha.nombre_cientifico,
    familia: ficha.familia,
    nombres_comunes: ficha.nombres_comunes,
    origen: ficha.origen.valor,
    endemica: ficha.endemica.valor,
    amenaza: ficha.amenaza.nacional?.categoria ?? null,
    vedada: ficha.vedas.length > 0,
  };
}

/**
 * Las candidatas que mas importan, primero.
 *
 * Quien busca "roble" delante de un arbol necesita ver antes la que esta vedada o
 * amenazada que la que no tiene ninguna restriccion: si la lista es larga, lo que queda
 * abajo no se lee.
 */
function ordenarCandidatas(lista) {
  const peso = (c) =>
    (c.vedada ? 4 : 0) + (c.amenaza ? 2 : 0) + (c.endemica === true ? 1 : 0);
  return [...lista].sort((a, b) => peso(b) - peso(a));
}

/* -------------------------------------------------------------------- diagnostico */

/** GET /api/listas — que listas oficiales tiene cargadas el servidor y de cuando son. */
router.get(
  '/listas',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, ...estadoDeListas() });
  })
);
