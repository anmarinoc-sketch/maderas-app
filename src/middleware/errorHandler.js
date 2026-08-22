import multer from 'multer';

import { config } from '../config.js';
import { AppError, errores } from '../lib/errors.js';

/** 404 para rutas que no existen. */
export function noEncontrado(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `No existe el recurso ${req.method} ${req.path}.`,
    },
  });
}

/**
 * Manejador central: toda respuesta de error sale con la misma forma
 * { ok:false, error:{ codigo, mensaje, detalle? } } para que la app Android
 * pueda decidir en un `when` sobre `codigo` sin parsear textos.
 */
// eslint-disable-next-line no-unused-vars -- Express exige la firma de 4 argumentos.
export function manejadorErrores(err, req, res, _next) {
  let error = err;

  if (err instanceof multer.MulterError) {
    error =
      err.code === 'LIMIT_FILE_SIZE'
        ? errores.imagenMuyGrande(config.maxImageBytes)
        : new AppError(
            400,
            'MULTIPART_INVALIDO',
            'El formulario multipart no es valido.',
            `Envia un unico archivo en el campo "imagen". (${err.code})`
          );
  } else if (err?.type === 'entity.too.large') {
    error = errores.imagenMuyGrande(config.maxImageBytes);
  } else if (err?.type === 'entity.parse.failed') {
    error = new AppError(400, 'JSON_INVALIDO', 'El cuerpo de la peticion no es JSON valido.');
  }

  if (!(error instanceof AppError)) {
    // Fallo no previsto: se registra completo en el servidor y se responde en generico.
    console.error(`[error] ${req.method} ${req.path} ->`, err);
    error = new AppError(500, 'ERROR_INTERNO', 'Error interno del servidor.');
  } else if (error.status >= 500) {
    console.error(`[error] ${req.method} ${req.path} -> ${error.codigo}: ${error.detalle ?? ''}`);
  }

  res.status(error.status).json({
    ok: false,
    request_id: req.requestId,
    error: {
      codigo: error.codigo,
      mensaje: error.message,
      ...(error.detalle ? { detalle: error.detalle } : {}),
    },
  });
}
