import { randomUUID } from 'node:crypto';

import express from 'express';

import { config } from './config.js';
import { manejadorErrores, noEncontrado } from './middleware/errorHandler.js';
import { router as identificarRouter } from './routes/identificar.js';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // detras de nginx/Cloud Run: req.ip real para el rate limit.

  // Identificador por peticion: aparece en los logs y en la respuesta, para soporte.
  app.use((req, _res, next) => {
    req.requestId = randomUUID();
    next();
  });

  // El JSON puede llevar base64, que infla ~33% respecto al binario.
  app.use(express.json({ limit: Math.ceil((config.maxImageBytes * 1.4) / 1024) + 'kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, estado: 'operativo', modelo: config.geminiModel });
  });

  app.use('/api', identificarRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
