import { Router } from 'express';

import { AppError } from '../lib/errors.js';
import { transcribirPdf } from '../lib/transcribir.js';
import { rateLimit } from '../middleware/rateLimit.js';

/**
 * Ruta TEMPORAL para transcribir una norma escaneada.
 *
 * Por que en el servidor y no en la maquina de casa: la clave de Gemini vive solo en
 * Render y no debe salir de ahi. Ejecutar la herramienta en local obligaria a sacarla,
 * y no compensa por una transcripcion que se hace una vez.
 *
 * Se quita en cuanto el Acuerdo 404 este transcrito y revisado. Mientras tanto:
 *   - Solo acepta identificadores de una lista cerrada; no se le puede pasar una URL
 *     arbitraria, que convertiria el servidor en un descargador ajeno.
 *   - El resultado se guarda en memoria, asi que insistir no gasta cuota mas de una vez.
 */
export const router = Router();

const NORMAS = {
  'cornare-404': {
    url: 'https://www.cornare.gov.co/Acuerdos/Acuerdo_404_2020_cornare.pdf',
    descripcion: 'Acuerdo 404 de 2020 de Cornare, veda de 30 especies de flora',
  },
};

const MAX_BYTES = 20 * 1024 * 1024;

/** Una transcripcion por norma; la segunda llamada devuelve la guardada. */
const cache = new Map();

router.get('/transcribir-norma', rateLimit, async (req, res, next) => {
  try {
    const id = String(req.query.id ?? '');
    const norma = NORMAS[id];

    if (!norma) {
      throw new AppError(
        400,
        'NORMA_DESCONOCIDA',
        'Ese identificador de norma no esta en la lista.',
        `Disponibles: ${Object.keys(NORMAS).join(', ')}`
      );
    }

    // refrescar=1 fuerza una transcripcion nueva; hace falta al cambiar el esquema.
    if (cache.has(id) && req.query.refrescar !== '1') {
      return res.json({ ok: true, id, desde_cache: true, ...cache.get(id) });
    }

    const descarga = await fetch(norma.url, { redirect: 'follow' });
    if (!descarga.ok) {
      throw new AppError(
        502,
        'DESCARGA_FALLIDA',
        'No se pudo descargar el PDF de la norma.',
        `${norma.url} respondio ${descarga.status}`
      );
    }

    const pdf = Buffer.from(await descarga.arrayBuffer());
    if (pdf.length > MAX_BYTES) {
      throw new AppError(413, 'PDF_MUY_GRANDE', 'El PDF supera el limite admitido.');
    }

    const { resultado, modelo } = await transcribirPdf(pdf);

    const salida = {
      norma: norma.descripcion,
      fuente: norma.url,
      bytes: pdf.length,
      modelo,
      transcripcion: resultado,
      aviso:
        'Transcripcion automatica de un escaneo. REVISAR contra el PDF original antes ' +
        'de darle valor de dato legal.',
    };
    cache.set(id, salida);

    res.json({ ok: true, id, desde_cache: false, ...salida });
  } catch (error) {
    next(error);
  }
});
