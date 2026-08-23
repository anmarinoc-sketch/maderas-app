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

/** Modelos por defecto, de mas a menos capaz. Los "lite" van al final: identifican peor. */
const MODELOS_POR_DEFECTO = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];

/**
 * GEMINI_MODELOS define la cadena completa. GEMINI_MODEL, si existe, solo encabeza
 * la lista por defecto (no la sustituye): asi un despliegue antiguo con un unico
 * modelo configurado gana la rotacion sin tocar su configuracion.
 */
function cadenaDeModelos() {
  const lista = process.env.GEMINI_MODELOS?.trim()
    ? process.env.GEMINI_MODELOS.split(',')
    : [process.env.GEMINI_MODEL ?? '', ...MODELOS_POR_DEFECTO];

  return [...new Set(lista.map((m) => m.trim()).filter(Boolean))];
}

export const config = {
  geminiApiKey: requerido('GEMINI_API_KEY'),

  /**
   * Clave para BioScan (identificacion de especies). Va aparte de la de XiloScan a
   * proposito: el nivel gratuito limita 20 peticiones diarias por modelo Y POR
   * PROYECTO, asi que dos apps con la misma clave se reparten las ~160 consultas
   * diarias. Con un proyecto de Google Cloud distinto cada app tiene las suyas.
   *
   * Si no esta configurada se cae en la de XiloScan: la app funciona igual, solo que
   * compartiendo cuota. Asi se puede desplegar antes de crear el segundo proyecto.
   */
  geminiApiKeyEspecies:
    process.env.GEMINI_API_KEY_ESPECIES?.trim() || requerido('GEMINI_API_KEY'),

  /**
   * Si BioScan tiene clave propia o esta compartiendo la de XiloScan.
   *
   * Se publica en /health como un simple si/no para poder comprobar desde fuera que la
   * variable quedo bien puesta en Render. Es un booleano, nunca la clave: el valor no
   * sale de este proceso.
   */
  geminiClaveEspeciesPropia: Boolean(process.env.GEMINI_API_KEY_ESPECIES?.trim()),

  /**
   * Cadena de modelos. El nivel gratuito limita a 20 peticiones diarias POR MODELO,
   * asi que cuando uno agota su cuota se pasa al siguiente y la capacidad diaria del
   * conjunto se multiplica. Van ordenados de mas a menos capaz: los "lite" son el
   * ultimo recurso porque identifican peor.
   */
  geminiModelos: cadenaDeModelos(),

  port: numero('PORT', 3000),
  host: process.env.HOST?.trim() || '0.0.0.0',

  maxImageBytes: numero('MAX_IMAGE_MB', 8) * 1024 * 1024,

  geminiTimeoutMs: numero('GEMINI_TIMEOUT_MS', 120_000),

  // Tokens de razonamiento antes de responder. 0 lo desactiva.
  geminiThinking: Number(process.env.GEMINI_THINKING ?? 4096),
  geminiMaxRetries: numero('GEMINI_MAX_RETRIES', 2),

  rateLimitWindowMs: numero('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: numero('RATE_LIMIT_MAX', 10),

  // Vacio => sin autenticacion (util en desarrollo).
  appApiKey: process.env.APP_API_KEY?.trim() || null,

  mimesPermitidos: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};
