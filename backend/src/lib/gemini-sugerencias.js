import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';
import {
  ESQUEMA_SUGERENCIA,
  INSTRUCCION_SUGERENCIA,
  promptDeSugerencia,
} from './prompt-sugerencias.js';

/**
 * Sugerencias de qué comer. Comparte clave y contabilidad de cuota con el
 * análisis de fotos de NutriFoto: son la misma app, y separarlas solo repartiría
 * la misma cuota en dos mitades más pequeñas.
 */
const motor = crearMotor({
  apiKey: config.geminiApiKeyComida,
  modelos: config.geminiModelos,
  nombre: 'sugerencias',
});

export const estadoModelos = motor.estadoModelos;

export async function sugerirComida(datos) {
  return motor.generar({
    partes: [{ text: promptDeSugerencia(datos) }],
    instruccion: INSTRUCCION_SUGERENCIA,
    esquema: ESQUEMA_SUGERENCIA,
    // Más alta que en el análisis: aquí sí se busca variedad entre las tres
    // opciones, y proponer siempre el mismo pollo con arroz no sirve de nada.
    temperatura: 0.7,
  });
}
