import multer from 'multer';

import { config } from '../config.js';

/**
 * Guardamos la imagen en memoria: se reenvia a Gemini y se descarta.
 * Asi no dejamos fotos de clientes en disco.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    // Filtro barato por Content-Type declarado; la validacion real (magic bytes)
    // se hace despues en lib/image.js.
    if (file.mimetype?.startsWith('image/')) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
}).single('imagen');

/** Solo aplica multer cuando la peticion es multipart; el resto va como JSON. */
export function recibirImagen(req, res, next) {
  if (req.is('multipart/form-data')) return upload(req, res, next);
  return next();
}
