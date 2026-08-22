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

// Timeouts generosos: subir una foto desde movil con mala cobertura es lento.
servidor.requestTimeout = config.geminiTimeoutMs + 30_000;
servidor.headersTimeout = servidor.requestTimeout + 5_000;

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log(`\n[${senal}] cerrando servidor...`);
    servidor.close(() => process.exit(0));
  });
}
