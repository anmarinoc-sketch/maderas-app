import { Router } from 'express';

import { leerCoordenadas } from '../lib/gemini-coordenadas.js';
import { bufferDesdeBase64, validarImagen } from '../lib/image.js';
import { errores } from '../lib/errors.js';
import { requiereAppKey } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { recibirImagen } from '../middleware/upload.js';

export const router = Router();

/** Envuelve un handler async para que sus rechazos lleguen al manejador de errores. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Codigos que el conversor sabe manejar. La lista vive aqui ademas de en el prompt
 * porque el prompt es una peticion y esto es una garantia: si el modelo devuelve
 * "EPSG:2317" o "MAGNA Bogota", el campo se vacia y el usuario escoge de la lista.
 * Una sugerencia equivocada es peor que ninguna, porque invita a aceptarla sin mirar.
 */
const EPSG_VALIDOS = new Set([
  'EPSG:4326', 'EPSG:4686', 'EPSG:4218',
  'EPSG:3114', 'EPSG:3115', 'EPSG:3116', 'EPSG:3117', 'EPSG:3118',
  'EPSG:21896', 'EPSG:21897', 'EPSG:21898', 'EPSG:21899',
  'EPSG:3857', 'EPSG:9377',
]);

const CONFIANZAS = ['alta', 'media', 'baja'];
const TIPOS = ['geograficas', 'planas', 'desconocido'];

/** Una tabla de linderos larga cabe de sobra; mas que esto es el modelo repitiendose. */
const MAX_PUNTOS = 400;

const texto = (valor, limite) =>
  typeof valor === 'string' ? valor.trim().slice(0, limite) : '';

/**
 * Deja la transcripcion en un estado del que el conversor pueda fiarse.
 *
 * Nada de lo que se hace aqui toca los digitos: los numeros salen tal como el modelo
 * los leyo, sin normalizar separadores ni convertir nada. Eso es deliberado, porque
 * quien revisa compara el texto contra la imagen caracter por caracter, y ese cotejo
 * es la unica garantia real de que la lectura es correcta. Lo que si se hace es
 * acotar el resto: codigos EPSG fuera de lista, etiquetas de confianza inventadas,
 * filas sin ningun digito y respuestas kilometricas.
 */
function normalizar(resultado) {
  const entrada = Array.isArray(resultado?.puntos) ? resultado.puntos : [];

  const puntos = entrada
    .map((p) => ({
      nombre: texto(p?.nombre, 60),
      y_texto: texto(p?.y_texto, 60),
      x_texto: texto(p?.x_texto, 60),
      confianza: CONFIANZAS.includes(p?.confianza) ? p.confianza : 'baja',
      duda: texto(p?.duda, 300),
    }))
    // Una fila sin un solo digito en ninguno de los dos ejes no es un punto:
    // es un encabezado, un separador o una linea de totales que se colo.
    .filter((p) => /\d/.test(p.y_texto) || /\d/.test(p.x_texto))
    .slice(0, MAX_PUNTOS);

  const epsg = texto(resultado?.sistema?.epsg_sugerido, 20).toUpperCase();

  return {
    sistema: {
      descripcion: texto(resultado?.sistema?.descripcion, 300),
      epsg_sugerido: EPSG_VALIDOS.has(epsg) ? epsg : '',
      confianza: CONFIANZAS.includes(resultado?.sistema?.confianza)
        ? resultado.sistema.confianza
        : 'baja',
    },
    tipo_coordenada: TIPOS.includes(resultado?.tipo_coordenada)
      ? resultado.tipo_coordenada
      : 'desconocido',
    puntos,
    notas: texto(resultado?.notas, 1200),
    // Siempre true, sin excepcion, y por eso no se lee lo que diga el modelo. Una
    // coordenada mal transcrita no se delata sola: no rompe nada, no da error, solo
    // pone el punto en otro sitio. La revision contra la imagen no es opcional.
    requiere_confirmacion: true,
  };
}

/**
 * POST /api/leer-coordenadas
 *
 * Transcribe el cuadro de coordenadas de la foto o el escaneo de un plano, una
 * escritura o una resolucion. NO convierte: devuelve los numeros tal como estan
 * impresos para que el conversor los pase por proj4 despues de que el usuario los
 * revise contra la imagen.
 *
 * Acepta la imagen de dos formas:
 *   - multipart/form-data con el campo "imagen" (y opcionalmente "pista").
 *   - application/json con { "imagen_base64": "<base64 o data URL>", "pista": "..." }.
 */
router.post(
  '/leer-coordenadas',
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
    const pista = typeof req.body?.pista === 'string' ? req.body.pista.slice(0, 400) : '';

    const inicio = Date.now();
    const { resultado, modelo, uso } = await leerCoordenadas({ ...imagen, pista });
    const latenciaMs = Date.now() - inicio;

    const normalizado = normalizar(resultado);
    const dudosos = normalizado.puntos.filter((p) => p.confianza !== 'alta').length;

    console.log(
      `[ok:coordenadas] ${req.requestId} ${imagen.mimeType} ${(imagen.bytes / 1024).toFixed(0)} KB ` +
        `-> ${normalizado.puntos.length} puntos, ${dudosos} dudosos, ` +
        `sistema ${normalizado.sistema.epsg_sugerido || 'sin identificar'} ` +
        `(${latenciaMs} ms, ${modelo})`
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
