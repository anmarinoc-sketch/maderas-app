import { Router } from 'express';

import { exportar, registrar, verificacionDeImagen } from '../lib/aprendizaje.js';
import { identificarMadera } from '../lib/gemini.js';
import { bufferDesdeBase64, validarImagen } from '../lib/image.js';
import { normalizar as normalizarHuella, sha256 } from '../lib/huella.js';
import { AppError, errores } from '../lib/errors.js';
import { requiereAppKey } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { recibirImagen } from '../middleware/upload.js';

export const router = Router();

/** Envuelve un handler async para que sus rechazos lleguen al manejador de errores. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * POST /api/identificar-madera
 *
 * Acepta la imagen de dos formas:
 *   - multipart/form-data con el campo "imagen" (lo natural desde Android/OkHttp).
 *   - application/json con { "imagen_base64": "<base64 o data URL>" }.
 */
router.post(
  '/identificar-madera',
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

    // Huellas de esta foto. La exacta se calcula aqui; la perceptual la manda la app,
    // que es quien tiene el bitmap. Las versiones antiguas no la envian y no pasa nada.
    const exacta = sha256(imagen.buffer);
    const perceptual = normalizarHuella(req.body?.huella);

    // Si el usuario ya verifico esta misma pieza, el dato viaja pegado a la imagen.
    const verificada = verificacionDeImagen({ sha256: exacta, huella: perceptual });

    const inicio = Date.now();
    const { resultado, modelo, uso } = await identificarMadera(imagen, { verificada });
    const latenciaMs = Date.now() - inicio;

    console.log(
      `[ok] ${req.requestId} ${imagen.mimeType} ${(imagen.bytes / 1024).toFixed(0)} KB ` +
        `-> ${resultado?.nombre_cientifico ?? 'sin nombre'} (${latenciaMs} ms)` +
        (verificada ? ` [verificada: ${verificada.especie}]` : '')
    );

    res.json({
      ok: true,
      request_id: req.requestId,
      modelo,
      latencia_ms: latenciaMs,
      // Las huellas vuelven a la app para que las adjunte al verificar esta foto.
      imagen: {
        mime_type: imagen.mimeType,
        bytes: imagen.bytes,
        sha256: exacta,
        huella: perceptual,
      },
      verificada: verificada
        ? { especie: verificada.especie, fecha: verificada.fecha, exacta: verificada.exacta }
        : null,
      uso,
      resultado,
    });
  })
);

/**
 * POST /api/verificacion
 *
 * El usuario confirma o corrige una identificacion. Estas verificaciones se acumulan
 * y se inyectan como avisos en la instruccion de sistema de las siguientes consultas.
 */
router.post(
  '/verificacion',
  requiereAppKey,
  asyncHandler(async (req, res) => {
    const { acierto, dicho, real, confianza, nota, sha256: exacta, huella } = req.body ?? {};

    if (typeof acierto !== 'boolean') {
      throw new AppError(
        400,
        'VERIFICACION_INVALIDA',
        'Falta indicar si la identificacion fue correcta.',
        'Envia { "acierto": true|false, "dicho": "...", "real": "..." }.'
      );
    }

    // Un fallo sin la especie correcta no ensena nada: es el dato que da valor al aviso.
    if (!acierto && !String(real ?? '').trim()) {
      throw new AppError(
        400,
        'FALTA_ESPECIE_REAL',
        'Para registrar un fallo hay que indicar cual era la especie correcta.'
      );
    }

    const entrada = registrar({ acierto, dicho, real, confianza, nota, sha256: exacta, huella });
    console.log(
      `[verificacion] ${entrada.acierto ? 'acierto' : 'fallo'}: ` +
        `dicho="${entrada.dicho}" real="${entrada.real}"`
    );

    const resumen = exportar();
    res.json({
      ok: true,
      registradas: resumen.total,
      acierto_pct: resumen.acierto_pct,
    });
  })
);

/** GET /api/aprendizaje — permite exportar lo acumulado antes de un redespliegue. */
router.get(
  '/aprendizaje',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, ...exportar() });
  })
);
