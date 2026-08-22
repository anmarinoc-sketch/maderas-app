import { GoogleGenAI } from '@google/genai';

import { config } from '../config.js';
import { AppError } from './errors.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt.js';

// La clave solo vive aqui, en el proceso del servidor. Nunca viaja al cliente.
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Extrae el codigo HTTP del error del SDK, venga como venga. */
function codigoHttp(error) {
  const candidatos = [error?.status, error?.code, error?.response?.status, error?.error?.code];
  for (const c of candidatos) {
    const n = Number(c);
    if (Number.isInteger(n) && n >= 400 && n <= 599) return n;
  }
  return null;
}

/**
 * El SDK adjunta el JSON de error de Google en `message`. Extraemos solo el texto
 * legible: no queremos volcar el payload entero del proveedor hacia la app.
 */
function mensajeCorto(error) {
  const bruto = String(error?.message ?? error);
  const json = bruto.match(/\{[\s\S]*\}/);
  if (json) {
    try {
      const parseado = JSON.parse(json[0]);
      const mensaje = parseado?.error?.message ?? parseado?.message;
      if (mensaje) return String(mensaje).slice(0, 300);
    } catch {
      /* nos quedamos con el texto bruto */
    }
  }
  return bruto.slice(0, 300);
}

/** Traduce un fallo del SDK a un AppError con mensaje util para la app Android. */
function traducirError(error) {
  const status = codigoHttp(error);
  const bruto = String(error?.message ?? error);
  const mensajeOriginal = mensajeCorto(error);

  if (error?.name === 'AbortError' || /timeout|aborted|ETIMEDOUT/i.test(bruto)) {
    return new AppError(
      504,
      'TIEMPO_AGOTADO',
      'Gemini tardo demasiado en responder.',
      'Reintenta con una imagen mas ligera o vuelve a intentarlo en unos segundos.'
    );
  }

  // Una clave invalida llega como 400 API_KEY_INVALID, no como 401.
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(bruto)) {
    return new AppError(
      502,
      'CREDENCIAL_INVALIDA',
      'El servidor no pudo autenticarse contra Gemini.',
      'Revisa GEMINI_API_KEY en el archivo .env del backend.'
    );
  }

  switch (status) {
    case 400:
      return new AppError(
        502,
        'PETICION_RECHAZADA',
        'Gemini rechazo la peticion.',
        mensajeOriginal
      );
    case 401:
    case 403:
      // No filtramos nada de la clave: solo avisamos al operador del backend.
      return new AppError(
        502,
        'CREDENCIAL_INVALIDA',
        'El servidor no pudo autenticarse contra Gemini.',
        'Revisa GEMINI_API_KEY y que la API este habilitada para el proyecto.'
      );
    case 404:
      return new AppError(
        502,
        'MODELO_NO_DISPONIBLE',
        `El modelo "${config.geminiModel}" no esta disponible para esta clave.`,
        mensajeOriginal
      );
    case 429:
      // El detalle de Google dice que limite se agoto (por minuto, por dia, tokens).
      // Se registra en el servidor, nunca se devuelve al cliente.
      console.warn(`[cuota] ${bruto}`);
      return new AppError(
        429,
        'CUOTA_EXCEDIDA',
        'Se alcanzo el limite de cuota de Gemini (nivel gratuito).',
        'El nivel gratuito limita peticiones por minuto y por dia. Espera unos segundos y reintenta, o habilita facturacion para subir de nivel.'
      );
    case 500:
    case 502:
    case 503:
      return new AppError(
        503,
        'SERVICIO_NO_DISPONIBLE',
        'Gemini no esta disponible en este momento.',
        'Es un fallo temporal del proveedor. Reintenta en unos segundos.'
      );
    default:
      return new AppError(
        502,
        'ERROR_GEMINI',
        'Error inesperado al consultar Gemini.',
        mensajeOriginal
      );
  }
}

/** Reintentamos solo lo que puede resolverse solo: saturacion y limites de ritmo. */
function esReintentable(error) {
  const status = codigoHttp(error);
  return status === 429 || status === 500 || status === 502 || status === 503;
}

/**
 * Envia la imagen a Gemini y devuelve el resultado ya parseado.
 * @param {{ buffer: Buffer, mimeType: string }} imagen
 * @returns {Promise<{ resultado: object, modelo: string, uso: object|null }>}
 */
export async function identificarMadera({ buffer, mimeType }) {
  let ultimoError;

  for (let intento = 0; intento <= config.geminiMaxRetries; intento += 1) {
    try {
      const respuesta = await ai.models.generateContent({
        model: config.geminiModel,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: buffer.toString('base64') } },
              { text: USER_PROMPT },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          httpOptions: { timeout: config.geminiTimeoutMs },
        },
      });

      const bloqueo =
        respuesta?.promptFeedback?.blockReason ??
        (respuesta?.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : null);
      if (bloqueo) {
        throw new AppError(
          422,
          'CONTENIDO_BLOQUEADO',
          'Gemini bloqueo la imagen por sus filtros de contenido.',
          `Motivo: ${bloqueo}. Prueba con otra fotografia de la pieza.`
        );
      }

      const texto = respuesta?.text?.trim();
      if (!texto) {
        throw new AppError(
          502,
          'RESPUESTA_VACIA',
          'Gemini devolvio una respuesta vacia.',
          respuesta?.candidates?.[0]?.finishReason
            ? `finishReason: ${respuesta.candidates[0].finishReason}`
            : undefined
        );
      }

      let resultado;
      try {
        resultado = JSON.parse(texto);
      } catch {
        throw new AppError(
          502,
          'RESPUESTA_INVALIDA',
          'Gemini devolvio una respuesta que no es JSON valido.',
          texto.slice(0, 300)
        );
      }

      return {
        resultado,
        modelo: config.geminiModel,
        uso: respuesta?.usageMetadata ?? null,
      };
    } catch (error) {
      // Los AppError que lanzamos arriba ya son definitivos: no se reintentan.
      if (error instanceof AppError) throw error;

      ultimoError = error;
      if (intento < config.geminiMaxRetries && esReintentable(error)) {
        const espera = 800 * 2 ** intento + Math.floor(Math.random() * 250);
        console.warn(
          `[gemini] intento ${intento + 1} fallido (${codigoHttp(error) ?? 'sin codigo'}), ` +
            `reintentando en ${espera} ms`
        );
        await dormir(espera);
        continue;
      }
      throw traducirError(error);
    }
  }

  throw traducirError(ultimoError);
}
