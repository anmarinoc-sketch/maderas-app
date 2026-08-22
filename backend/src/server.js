import { crearApp } from './app.js';
import { config } from './config.js';

const app = crearApp();

const servidor = app.listen(config.port, config.host, () => {
  console.log(`\n  madera-backend escuchando en http://${config.host}:${config.port}`);
  console.log(`  modelos: ${config.geminiModelos.join(', ')}`);
  console.log(`  imagen maxima: ${(config.maxImageBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  X-App-Key: ${config.appApiKey ? 'requerida' : 'desactivada'}`);
  console.log(`  POST http://localhost:${config.port}/api/identificar-madera\n`);
});

// Detras de un proxy (Render, Cloud Run, nginx) el servidor NUNCA debe cerrar una
// conexion keep-alive antes que el proxy. Node cierra a los 5 s por defecto; si el
// proxy reutiliza esa conexion justo despues, ve la conexion caida y responde un
// error que nuestro codigo jamas llega a ver: peticiones perdidas sin rastro en los
// logs. Por eso keepAliveTimeout va holgadamente por encima del idle del proxy.
servidor.keepAliveTimeout = 120_000;
// Node exige que headersTimeout supere keepAliveTimeout.
servidor.headersTimeout = servidor.keepAliveTimeout + 5_000;
// Subir una foto desde el movil con mala cobertura puede ser lento.
servidor.requestTimeout = 300_000;

/**
 * Auto-ping para no dormirse.
 *
 * El plan gratuito de Render apaga el servicio tras 15 minutos sin trafico de entrada,
 * y despertarlo añade casi un minuto a la siguiente foto. En vez de un cron externo
 * —que llenaba el historial de GitHub con 144 ejecuciones al dia— el propio servicio
 * se llama a si mismo por su URL publica: la peticion sale a internet y vuelve por el
 * router de Render, que es lo que cuenta como actividad.
 *
 * RENDER_EXTERNAL_URL la define Render; fuera de Render no existe y esto no se activa.
 */
const urlPublica = process.env.RENDER_EXTERNAL_URL?.trim();
if (urlPublica) {
  const cada = 10 * 60 * 1000;
  const latido = setInterval(() => {
    fetch(`${urlPublica.replace(/\/$/, '')}/health`)
      .then((r) => {
        if (!r.ok) console.warn(`[latido] respuesta ${r.status}`);
      })
      .catch((e) => console.warn(`[latido] fallo: ${e.message}`));
  }, cada);
  // unref para que este temporizador no impida que el proceso termine al cerrarse.
  latido.unref();
  console.log(`  auto-ping cada 10 min contra ${urlPublica}`);
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log(`\n[${senal}] cerrando servidor...`);
    servidor.close(() => process.exit(0));
  });
}
