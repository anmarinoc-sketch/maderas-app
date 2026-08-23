import { Router } from 'express';

import { AppError, errores } from '../lib/errors.js';
import {
  candidatasPorNombreComun,
  consultarPorNombreCientifico,
  estadoDeListas,
  pareceNombreCientifico,
} from '../lib/especies.js';
import { buscarPorNombreComun, normalizarNombre } from '../lib/gbif.js';
import { identificarPorFoto, redactarRelato, resolverNombre } from '../lib/gemini-especies.js';
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
async function armarFicha(nombreCientifico, { conRelato }) {
  const oficial = consultarPorNombreCientifico(nombreCientifico);
  if (!oficial) return null;

  const ficha = { ...oficial, relato: null, relato_no_disponible: null };
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

function fichaOficialDe(nombre) {
  const limpio = String(nombre ?? '').trim().toLowerCase();
  if (!limpio || NO_ES_UN_NOMBRE.has(limpio)) return null;
  return consultarPorNombreCientifico(nombre);
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
    const principal = fichaOficialDe(resultado.nombre_cientifico);

    const alternativas = (resultado.alternativas ?? []).map((a) => ({
      ...a,
      oficial: fichaOficialDe(a.nombre_cientifico),
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
 * Resuelve el nombre en cuatro pasos, del mas barato al mas caro, y para en cuanto uno
 * responde. Los tres primeros no gastan ni una consulta de Gemini:
 *   1. Es un nombre cientifico que esta en las listas -> ficha directa.
 *   2. Esta en el indice local de nombres comunes.
 *   3. GBIF lo reconoce como nombre vulgar (API gratuita, sin clave).
 *   4. Se lo preguntamos al modelo, y lo que diga se verifica contra las listas.
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

    /* 1. Nombre cientifico conocido. */
    if (pareceNombreCientifico(consulta)) {
      const ficha = await armarFicha(consulta, { conRelato });
      if (ficha?.en_listas.catalogo_flora || ficha?.en_listas.amenazadas_nacional) {
        return responder({ resuelto_por: 'listas_oficiales', ficha });
      }
    }

    /* 2. Indice local de nombres comunes (cubre las especies amenazadas). */
    const locales = candidatasPorNombreComun(consulta);
    if (locales.length === 1) {
      return responder({
        resuelto_por: 'indice_local_de_nombres_comunes',
        ficha: await armarFicha(locales[0], { conRelato }),
      });
    }
    if (locales.length > 1) {
      return responder({
        resuelto_por: 'indice_local_de_nombres_comunes',
        hay_que_elegir: true,
        aviso: `"${consulta}" designa varias especies. Elige cual quieres consultar.`,
        candidatas: locales.map((k) => resumirCandidata(consultarPorNombreCientifico(k))),
      });
    }

    /* 3. GBIF, gratis y sin cuota. */
    const enGbif = await buscarPorNombreComun(consulta);
    if (enGbif.length === 1) {
      return responder({
        resuelto_por: 'gbif',
        ficha: await armarFicha(enGbif[0].nombre, { conRelato }),
      });
    }
    if (enGbif.length > 1) {
      return responder({
        resuelto_por: 'gbif',
        hay_que_elegir: true,
        aviso: `"${consulta}" designa varias especies. Elige cual quieres consultar.`,
        candidatas: enGbif.map((c) => ({
          ...resumirCandidata(consultarPorNombreCientifico(c.nombre)),
          nombres_comunes: c.comunes.join(', '),
        })),
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
        ficha: await armarFicha(nombre, { conRelato }),
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

/* -------------------------------------------------------------------- diagnostico */

/** GET /api/listas — que listas oficiales tiene cargadas el servidor y de cuando son. */
router.get(
  '/listas',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, ...estadoDeListas() });
  })
);
