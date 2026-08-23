import { randomUUID } from 'node:crypto';

import express from 'express';

import { config } from './config.js';
import { manejadorErrores, noEncontrado } from './middleware/errorHandler.js';
import { estadoModelos } from './lib/gemini.js';
import { estadoModelos as estadoModelosEspecies } from './lib/gemini-especies.js';
import { estadoDeListas } from './lib/especies.js';
import { router as identificarRouter } from './routes/identificar.js';
import { router as especiesRouter } from './routes/especies.js';

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
    const modelos = estadoModelos();
    const libres = modelos.filter((m) => m.disponible);
    const modelosEspecies = estadoModelosEspecies();
    const libresEspecies = modelosEspecies.filter((m) => m.disponible);

    res.json({
      ok: true,
      // Se conservan los campos de siempre: son los que mira XiloScan y los que usa
      // el comando de comprobacion que ya esta escrito en la documentacion.
      estado: libres.length ? 'operativo' : 'sin cuota',
      modelo: libres[0]?.modelo ?? null,
      modelos_disponibles: libres.length,
      modelos_totales: modelos.length,

      apps: {
        xiloscan: { modelos_disponibles: libres.length, modelos_totales: modelos.length },
        bioscan: {
          modelos_disponibles: libresEspecies.length,
          modelos_totales: modelosEspecies.length,
          // BioScan sigue sirviendo sin cuota: lo que esta en las listas no la gasta.
          listas: estadoDeListas(),
        },
      },
    });
  });

  app.use('/api', identificarRouter);
  app.use('/api', especiesRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
