import { Type } from '@google/genai';

import { config } from '../config.js';
import { crearMotor } from './motor-gemini.js';

/**
 * Transcripcion de una norma escaneada a su tabla de especies.
 *
 * Existe por el Acuerdo 404 de 2020 de Cornare, que veda 30 especies del Oriente
 * antioqueno y solo esta publicado como PDF escaneado: sus paginas son imagenes en
 * JBIG2, sin capa de texto. Ninguna herramienta del proyecto puede leerlo, y sin ese
 * listado la app calla sobre vedas que si existen.
 *
 * Gemini si sabe leer un escaneo. Aqui se le pide que COPIE, no que interprete: la
 * transcripcion tiene que poder cotejarse linea por linea con el original antes de
 * darle valor de dato legal.
 */

const motor = crearMotor({
  apiKey: config.geminiApiKeyEspecies,
  modelos: config.geminiModelos,
  nombre: 'transcripcion',
});

export const INSTRUCCION = `
Transcribes normas ambientales colombianas escaneadas. Tu unico trabajo es COPIAR lo que
pone el documento, no interpretarlo ni completarlo.

Reglas:
- Copia los nombres cientificos EXACTAMENTE como aparecen, aunque veas que estan mal
  escritos o desactualizados. La transcripcion tiene que poder cotejarse con el original.
- No anadas ninguna especie que no este en el documento, por evidente que te parezca.
- Si una palabra no se lee bien, ponla igual y marcala con [?] al final.
- Si hay una tabla de especies, recorrela entera, fila por fila, hasta el final. Cuenta
  las filas y no te dejes ninguna.
- Si el documento dice cuantas especies son, dilo en total_declarado aunque no cuadre con
  las que hayas podido leer. Que no cuadre es justo lo que hay que saber.
`.trim();

export const ESQUEMA = {
  type: Type.OBJECT,
  required: ['norma', 'autoridad', 'fecha', 'efecto', 'total_declarado', 'especies'],
  propertyOrdering: ['norma', 'autoridad', 'fecha', 'efecto', 'total_declarado', 'especies'],
  properties: {
    norma: { type: Type.STRING, description: 'Numero y tipo de norma, tal cual aparece.' },
    autoridad: { type: Type.STRING },
    fecha: { type: Type.STRING },
    efecto: { type: Type.STRING, description: 'Que prohibe o restringe exactamente.' },
    total_declarado: {
      type: Type.INTEGER,
      description: 'Cuantas especies dice la norma que cubre. 0 si no lo dice.',
    },
    especies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['cientifico', 'comun', 'familia'],
        propertyOrdering: ['cientifico', 'comun', 'familia'],
        properties: {
          cientifico: { type: Type.STRING, description: 'Binomio latino, sin autoria.' },
          comun: { type: Type.STRING, description: 'Nombre comun, "" si la norma no lo da.' },
          familia: { type: Type.STRING, description: '"" si la norma no la da.' },
        },
      },
    },
  },
};

/**
 * @param {Buffer} pdf
 * @returns {Promise<{ resultado: object, modelo: string }>}
 */
export async function transcribirPdf(pdf) {
  return motor.generar({
    partes: [
      { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
      {
        text:
          'Transcribe la tabla o el listado de especies que esta norma declara vedadas, ' +
          'protegidas o en peligro. Devuelve todas las especies, sin omitir ninguna.',
      },
    ],
    instruccion: INSTRUCCION,
    esquema: ESQUEMA,
    // Cero: no queremos que redacte ni complete, queremos que copie.
    temperatura: 0,
  });
}
