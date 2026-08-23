import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';
import { RESPONSE_SCHEMA, construirSystemPrompt, promptDeUsuario } from './prompt.js';

/**
 * Identificacion de maderas (XiloScan).
 *
 * La rotacion de modelos, la contabilidad de cuotas y la traduccion de errores viven
 * en motor-gemini.js desde que BioScan necesito lo mismo con otra clave. Aqui solo
 * queda lo propio de las maderas: que prompt se manda y con que imagen.
 */
const motor = crearMotor({
  apiKey: config.geminiApiKey,
  modelos: config.geminiModelos,
  nombre: 'maderas',
});

export const estadoModelos = motor.estadoModelos;

/**
 * Envia la imagen a Gemini y devuelve el resultado ya parseado.
 *
 * @param imagen  bytes y tipo de la foto.
 * @param opciones.verificada  { especie } si esta misma foto ya fue verificada en campo
 *        por el usuario; el dato viaja pegado a la imagen en el turno de usuario.
 */
export async function identificarMadera({ buffer, mimeType }, { verificada = null } = {}) {
  return motor.generar({
    partes: [
      { inlineData: { mimeType, data: buffer.toString('base64') } },
      { text: promptDeUsuario(verificada) },
    ],
    instruccion: construirSystemPrompt(),
    esquema: RESPONSE_SCHEMA,
    temperatura: 0.2,
  });
}
