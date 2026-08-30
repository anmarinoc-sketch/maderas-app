import { randomUUID } from 'node:crypto';

import express from 'express';

import { config } from './config.js';
import { manejadorErrores, noEncontrado } from './middleware/errorHandler.js';
import { estadoModelos } from './lib/gemini.js';
import { estadoModelos as estadoModelosEspecies } from './lib/gemini-especies.js';
import { estadoModelos as estadoModelosComida } from './lib/gemini-comida.js';
import { estadoModelos as estadoModelosSugerencias } from './lib/gemini-sugerencias.js';
import { estadoDeListas } from './lib/especies.js';
import { construirSystemPrompt } from './lib/prompt.js';
import { router as identificarRouter } from './routes/identificar.js';
import { router as especiesRouter } from './routes/especies.js';
import { router as comidaRouter } from './routes/comida.js';

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

  /**
   * CORS. Hace falta desde que NutriFoto llama a este backend desde un navegador
   * (la web en Vercel y el WebView de Capacitor, cuyo origen es https://localhost).
   * Sin credenciales de por medio: no hay cookies ni sesion que proteger, solo la
   * cuota, de la que se encargan el rate limit y APP_API_KEY.
   */
  app.use((req, res, next) => {
    const origen = req.get('Origin');
    if (origen && (!config.origenesPermitidos || config.origenesPermitidos.includes(origen))) {
      res.set('Access-Control-Allow-Origin', origen);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-App-Key');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.get('/health', (_req, res) => {
    const modelos = estadoModelos();
    const libres = modelos.filter((m) => m.disponible);
    const modelosEspecies = estadoModelosEspecies();
    const libresEspecies = modelosEspecies.filter((m) => m.disponible);
    const modelosComida = estadoModelosComida();
    const libresComida = modelosComida.filter((m) => m.disponible);
    const libresSugerencias = estadoModelosSugerencias().filter((m) => m.disponible);

    res.json({
      ok: true,
      // Se conservan los campos de siempre: son los que mira XiloScan y los que usa
      // el comando de comprobacion que ya esta escrito en la documentacion.
      estado: libres.length ? 'operativo' : 'sin cuota',
      modelo: libres[0]?.modelo ?? null,
      modelos_disponibles: libres.length,
      modelos_totales: modelos.length,

      apps: {
        xiloscan: {
          modelos_disponibles: libres.length,
          modelos_totales: modelos.length,
          // Tamano de la instruccion de sistema. No es dato de diagnostico clinico: es
          // la unica forma de saber DESDE FUERA si Render ya desplego un cambio del
          // prompt. Sin esto habia que medir a ciegas y esperar a que el numero cuadrara.
          prompt_caracteres: construirSystemPrompt().length,
        },
        bioscan: {
          modelos_disponibles: libresEspecies.length,
          modelos_totales: modelosEspecies.length,
          // Solo si/no. Sirve para comprobar desde fuera que GEMINI_API_KEY_ESPECIES
          // quedo bien puesta en Render; la clave en si nunca sale del servidor.
          cuota_propia: config.geminiClaveEspeciesPropia,
          cuota: config.geminiClaveEspeciesPropia
            ? 'BioScan tiene su propia cuota diaria'
            : 'BioScan comparte la cuota de XiloScan (falta GEMINI_API_KEY_ESPECIES)',
          // BioScan sigue sirviendo sin cuota: lo que esta en las listas no la gasta.
          listas: estadoDeListas(),
        },
        nutrifoto: {
          modelos_disponibles: libresComida.length,
          modelos_totales: modelosComida.length,
          cuota_propia: config.geminiClaveComidaPropia,
          cuota: config.geminiClaveComidaPropia
            ? 'NutriFoto tiene su propia cuota diaria'
            : 'NutriFoto comparte la cuota de XiloScan (falta GEMINI_API_KEY_COMIDA)',
          // NutriFoto sigue sirviendo sin cuota: el registro manual y el diario son
          // locales, solo el analisis por foto necesita a Gemini.
          // Van por separado porque cada motor lleva su propia cuenta de modelos
          // agotados: la foto puede quedarse sin cuota y la sugerencia seguir viva.
          sugerencias_disponibles: libresSugerencias.length,
          sin_cuota: 'El registro manual y el historial funcionan igual sin cuota.',
        },
      },
    });
  });

  app.use('/api', identificarRouter);
  app.use('/api', especiesRouter);
  app.use('/api', comidaRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
