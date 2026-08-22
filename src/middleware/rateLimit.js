import { config } from '../config.js';
import { errores } from '../lib/errors.js';

/**
 * Limitador por IP en memoria, sin dependencias. Su objetivo no es la seguridad
 * sino proteger la cuota del nivel gratuito de Gemini frente a rafagas o bucles
 * de reintento de la app. Para varias instancias, cambia esto por Redis.
 */
const ventanas = new Map(); // ip -> { conteo, expiraEn }

// Limpieza periodica para que el Map no crezca sin control.
const limpieza = setInterval(() => {
  const ahora = Date.now();
  for (const [ip, dato] of ventanas) {
    if (dato.expiraEn <= ahora) ventanas.delete(ip);
  }
}, 60_000);
limpieza.unref();

export function rateLimit(req, res, next) {
  const ahora = Date.now();
  const ip = req.ip ?? req.socket.remoteAddress ?? 'desconocida';
  const actual = ventanas.get(ip);

  if (!actual || actual.expiraEn <= ahora) {
    ventanas.set(ip, { conteo: 1, expiraEn: ahora + config.rateLimitWindowMs });
    return next();
  }

  actual.conteo += 1;
  if (actual.conteo > config.rateLimitMax) {
    const segundos = Math.max(1, Math.ceil((actual.expiraEn - ahora) / 1000));
    res.set('Retry-After', String(segundos));
    return next(errores.demasiadasSolicitudes(segundos));
  }

  return next();
}
