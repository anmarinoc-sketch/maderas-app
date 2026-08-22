import { timingSafeEqual } from 'node:crypto';

import { config } from '../config.js';
import { errores } from '../lib/errors.js';

/**
 * Secreto compartido opcional entre la app Android y este backend.
 * No es autenticacion de usuario, pero evita que cualquiera use tu servidor
 * (y tu cuota de Gemini) como proxy abierto. Si APP_API_KEY esta vacio, se omite.
 */
export function requiereAppKey(req, _res, next) {
  if (!config.appApiKey) return next();

  const recibida = req.get('X-App-Key') ?? '';
  const esperada = config.appApiKey;

  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(errores.noAutorizado());
  }
  return next();
}
