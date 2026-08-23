import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';
import {
  ESQUEMA_FOTO,
  ESQUEMA_NOMBRE,
  ESQUEMA_RELATO,
  INSTRUCCION_FOTO,
  INSTRUCCION_NOMBRE,
  INSTRUCCION_RELATO,
  PROMPT_FOTO,
  promptDeNombre,
  promptDeRelato,
} from './prompt-especies.js';

/**
 * Consultas de BioScan a Gemini.
 *
 * Motor propio, con su clave: el limite del nivel gratuito es por modelo y por
 * proyecto, y compartir clave con XiloScan significaria que un dia de identificar
 * especies deja sin identificar maderas.
 */
const motor = crearMotor({
  apiKey: config.geminiApiKeyEspecies,
  modelos: config.geminiModelos,
  nombre: 'especies',
});

export const estadoModelos = motor.estadoModelos;

/** Reconoce la especie de una fotografia. */
export async function identificarPorFoto({ buffer, mimeType }) {
  return motor.generar({
    partes: [
      { inlineData: { mimeType, data: buffer.toString('base64') } },
      { text: PROMPT_FOTO },
    ],
    instruccion: INSTRUCCION_FOTO,
    esquema: ESQUEMA_FOTO,
    temperatura: 0.2,
  });
}

/**
 * Traduce un nombre comun a nombres cientificos.
 * Solo se llama cuando ni las listas locales ni GBIF han sabido resolverlo.
 */
export async function resolverNombre(texto) {
  return motor.generar({
    partes: [{ text: promptDeNombre(texto) }],
    instruccion: INSTRUCCION_NOMBRE,
    esquema: ESQUEMA_NOMBRE,
    temperatura: 0.3,
  });
}

/**
 * Redacta la explicacion de una especie ya identificada, apoyandose en los datos
 * oficiales que ya trae el sistema.
 */
export async function redactarRelato(ficha) {
  return motor.generar({
    partes: [{ text: promptDeRelato(ficha) }],
    instruccion: INSTRUCCION_RELATO,
    esquema: ESQUEMA_RELATO,
    temperatura: 0.4,
  });
}
