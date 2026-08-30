import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';
import {
  ESQUEMA_COMIDA,
  INSTRUCCION_COMIDA,
  PROMPT_COMIDA,
  promptConDescripcion,
} from './prompt-comida.js';

/**
 * Consultas de NutriFoto a Gemini.
 *
 * Motor propio con su clave, por lo mismo que BioScan: el nivel gratuito limita 20
 * peticiones diarias por modelo y por proyecto, asi que compartir clave significa que
 * un dia de contar calorias deja sin identificar maderas. Si no hay clave propia
 * configurada funciona igual, compartiendo cuota, y /health lo dice.
 */
const motor = crearMotor({
  apiKey: config.geminiApiKeyComida,
  modelos: config.geminiModelos,
  nombre: 'comida',
});

export const estadoModelos = motor.estadoModelos;

/**
 * Estima alimentos, porciones, calorias y macros de la foto de un plato.
 *
 * @param {{ buffer: Buffer, mimeType: string, descripcion?: string }} entrada
 */
export async function analizarComida({ buffer, mimeType, descripcion }) {
  const texto = descripcion?.trim() ? promptConDescripcion(descripcion.trim()) : PROMPT_COMIDA;

  return motor.generar({
    partes: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: texto }],
    instruccion: INSTRUCCION_COMIDA,
    esquema: ESQUEMA_COMIDA,
    // Mas baja que en las otras apps: aqui no se busca una hipotesis creativa entre
    // especies parecidas, se busca que el mismo plato de siempre el mismo numero.
    temperatura: 0.1,
  });
}
