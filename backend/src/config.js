import 'dotenv/config';

/**
 * Toda la configuracion sensible se lee de variables de entorno.
 * La GEMINI_API_KEY jamas se escribe en el codigo ni se devuelve al cliente.
 */
function requerido(nombre) {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    console.error(
      `\n[config] Falta la variable de entorno ${nombre}.\n` +
        `         Copia .env.example a .env y completa el valor.\n`
    );
    process.exit(1);
  }
  return valor;
}

function numero(nombre, porDefecto) {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

export const config = {
  geminiApiKey: requerido('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash',

  port: numero('PORT', 3000),
  host: process.env.HOST?.trim() || '0.0.0.0',

  maxImageBytes: numero('MAX_IMAGE_MB', 8) * 1024 * 1024,

  geminiTimeoutMs: numero('GEMINI_TIMEOUT_MS', 60_000),
  geminiMaxRetries: numero('GEMINI_MAX_RETRIES', 2),

  rateLimitWindowMs: numero('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: numero('RATE_LIMIT_MAX', 10),

  // Vacio => sin autenticacion (util en desarrollo).
  appApiKey: process.env.APP_API_KEY?.trim() || null,

  mimesPermitidos: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};
