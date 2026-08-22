import { crearApp } from './app.js';
import { config } from './config.js';

const app = crearApp();

const servidor = app.listen(config.port, config.host, () => {
  console.log(`\n  madera-backend escuchando en http://${config.host}:${config.port}`);
  console.log(`  modelo: ${config.geminiModel}`);
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

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log(`\n[${senal}] cerrando servidor...`);
    servidor.close(() => process.exit(0));
  });
}
