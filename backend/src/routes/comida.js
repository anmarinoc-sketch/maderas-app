import { Router } from 'express';

import { analizarComida } from '../lib/gemini-comida.js';
import { bufferDesdeBase64, validarImagen } from '../lib/image.js';
import { errores } from '../lib/errors.js';
import { requiereAppKey } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { recibirImagen } from '../middleware/upload.js';

export const router = Router();

/** Envuelve un handler async para que sus rechazos lleguen al manejador de errores. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const redondear = (n, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
};

/**
 * Deja el resultado del modelo en un estado del que la app pueda fiarse.
 *
 * Dos cosas se arreglan aqui y no en el prompt, porque pedirselas al modelo funciona
 * casi siempre y "casi" no basta cuando el numero se guarda en el diario del usuario:
 *
 *   - Los totales se recalculan sumando. Si el modelo suma mal, manda la suma.
 *   - Se anade `por_100g` a cada alimento. La pantalla de ajuste necesita recalcular
 *     al vuelo cuando el usuario cambia la porcion, y para eso hace falta el valor
 *     unitario, no el de la porcion que el modelo vio.
 */
function normalizar(resultado) {
  const entrada = Array.isArray(resultado?.alimentos_detectados)
    ? resultado.alimentos_detectados
    : [];

  const alimentos = entrada
    .filter((a) => a && typeof a.nombre === 'string' && a.nombre.trim())
    .map((a) => {
      const calorias = numero(a.calorias);
      const proteina = numero(a.proteina_g);
      const carbohidratos = numero(a.carbohidratos_g);
      const grasas = numero(a.grasas_g);

      // Si el modelo se olvido de los gramos, se cae a la cantidad cuando la unidad ya
      // es de peso; si tampoco, a 100 g, que deja el por_100g igual a la porcion y no
      // rompe el recalculo (el usuario corrige la cantidad y todo cuadra).
      const unidad = String(a.unidad ?? 'g').trim() || 'g';
      const gramos =
        numero(a.gramos_aproximados) ||
        (['g', 'ml', 'gr', 'gramos'].includes(unidad.toLowerCase()) ? numero(a.cantidad_estimada) : 0) ||
        100;

      const factor = 100 / gramos;

      return {
        nombre: a.nombre.trim(),
        cantidad_estimada: numero(a.cantidad_estimada) || gramos,
        unidad,
        gramos_aproximados: redondear(gramos, 0),
        calorias: redondear(calorias, 0),
        proteina_g: redondear(proteina),
        carbohidratos_g: redondear(carbohidratos),
        grasas_g: redondear(grasas),
        confianza: ['alta', 'media', 'baja'].includes(a.confianza) ? a.confianza : 'baja',
        por_100g: {
          calorias: redondear(calorias * factor, 0),
          proteina_g: redondear(proteina * factor),
          carbohidratos_g: redondear(carbohidratos * factor),
          grasas_g: redondear(grasas * factor),
        },
      };
    });

  const totales = alimentos.reduce(
    (acc, a) => ({
      calorias: acc.calorias + a.calorias,
      proteina_g: acc.proteina_g + a.proteina_g,
      carbohidratos_g: acc.carbohidratos_g + a.carbohidratos_g,
      grasas_g: acc.grasas_g + a.grasas_g,
    }),
    { calorias: 0, proteina_g: 0, carbohidratos_g: 0, grasas_g: 0 }
  );

  const dudoso = alimentos.some((a) => a.confianza !== 'alta');

  return {
    alimentos_detectados: alimentos,
    totales: {
      calorias: redondear(totales.calorias, 0),
      proteina_g: redondear(totales.proteina_g),
      carbohidratos_g: redondear(totales.carbohidratos_g),
      grasas_g: redondear(totales.grasas_g),
    },
    notas: typeof resultado?.notas === 'string' ? resultado.notas.trim() : '',
    // Ante la duda, se pide confirmar: el coste de revisar es un toque, el de no
    // revisar es un dato falso guardado en el diario.
    requiere_confirmacion:
      resultado?.requiere_confirmacion === false && !dudoso && alimentos.length > 0 ? false : true,
  };
}

/**
 * POST /api/analizar-comida
 *
 * Acepta la imagen de dos formas:
 *   - multipart/form-data con el campo "imagen" (y opcionalmente "descripcion").
 *   - application/json con { "imagen_base64": "<base64 o data URL>", "descripcion": "..." }.
 */
router.post(
  '/analizar-comida',
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
    const descripcion =
      typeof req.body?.descripcion === 'string' ? req.body.descripcion.slice(0, 400) : '';

    const inicio = Date.now();
    const { resultado, modelo, uso } = await analizarComida({ ...imagen, descripcion });
    const latenciaMs = Date.now() - inicio;

    const normalizado = normalizar(resultado);

    console.log(
      `[ok:comida] ${req.requestId} ${imagen.mimeType} ${(imagen.bytes / 1024).toFixed(0)} KB ` +
        `-> ${normalizado.alimentos_detectados.length} alimentos, ` +
        `${normalizado.totales.calorias} kcal (${latenciaMs} ms, ${modelo})`
    );

    res.json({
      ok: true,
      request_id: req.requestId,
      modelo,
      latencia_ms: latenciaMs,
      imagen: { mime_type: imagen.mimeType, bytes: imagen.bytes },
      uso,
      resultado: normalizado,
    });
  })
);
