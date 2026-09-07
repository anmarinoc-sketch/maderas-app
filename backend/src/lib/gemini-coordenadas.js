import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';
import {
  ESQUEMA_COORDENADAS,
  INSTRUCCION_COORDENADAS,
  PROMPT_COORDENADAS,
  promptConPista,
} from './prompt-coordenadas.js';

/**
 * Consultas del lector de cuadros de coordenadas a Gemini.
 *
 * Motor propio con su clave, por el mismo motivo que BioScan y NutriFoto: el nivel
 * gratuito limita 20 peticiones diarias por modelo y por proyecto, y un dia de leer
 * planos no puede dejar sin identificar maderas. Sin clave propia funciona igual
 * compartiendo la de XiloScan, y /health lo dice.
 */
const motor = crearMotor({
  apiKey: config.geminiApiKeyCoordenadas,
  modelos: config.geminiModelos,
  nombre: 'coordenadas',
});

export const estadoModelos = motor.estadoModelos;

/**
 * Transcribe el cuadro de coordenadas de la imagen de un plano o un documento.
 *
 * @param {{ buffer: Buffer, mimeType: string, pista?: string }} entrada
 */
export async function leerCoordenadas({ buffer, mimeType, pista }) {
  const texto = pista?.trim() ? promptConPista(pista.trim()) : PROMPT_COORDENADAS;

  return motor.generar({
    partes: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: texto }],
    instruccion: INSTRUCCION_COORDENADAS,
    esquema: ESQUEMA_COORDENADAS,
    // Cero, y es la unica de las cuatro apps que lo usa. Aqui no se busca una
    // hipotesis entre varias plausibles: el digito impreso en el papel es uno solo,
    // y la misma imagen tiene que dar siempre la misma transcripcion.
    temperatura: 0,
  });
}
