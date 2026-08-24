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

MUY IMPORTANTE, LA ESTRUCTURA:
Una norma de veda suele traer VARIAS tablas o listados distintos, y cada uno tiene un
efecto juridico diferente: las especies que la propia corporacion veda, las que solo
declara amenazadas, y las que recoge de vedas nacionales que ya existian. Aplanarlas en
una sola lista destruye esa diferencia y convierte la transcripcion en algo inservible.

Devuelve UN GRUPO POR CADA TABLA O LISTADO del documento, en el orden en que aparecen,
con el titulo o el encabezado literal que lleve cada uno y el articulo al que pertenece.
Si una misma especie sale en dos tablas, ponla en las dos: no la unifiques.

NUMERA LAS FILAS y no arrastres nombres de una a otra.
Al leer una tabla escaneada es facil repetir el nombre de la fila de arriba cuando la de
abajo se ve mal. Si dos filas de la MISMA tabla te salen con el mismo nombre cientifico,
casi seguro que una esta mal leida: vuelve a mirar esa fila concreta, letra a letra, y si
de verdad no se lee, escribe "ILEGIBLE" en el nombre en vez de repetir el de al lado. Un
hueco declarado sirve; un nombre duplicado destruye el recuento.
`.trim();

export const ESQUEMA = {
  type: Type.OBJECT,
  required: ['norma', 'autoridad', 'fecha', 'total_declarado', 'grupos'],
  propertyOrdering: ['norma', 'autoridad', 'fecha', 'total_declarado', 'grupos'],
  properties: {
    norma: { type: Type.STRING, description: 'Numero y tipo de norma, tal cual aparece.' },
    autoridad: { type: Type.STRING },
    fecha: { type: Type.STRING },
    total_declarado: {
      type: Type.INTEGER,
      description: 'Cuantas especies dice la norma que cubre. 0 si no lo dice.',
    },
    grupos: {
      type: Type.ARRAY,
      description: 'Un elemento por cada tabla o listado del documento, en su orden.',
      items: {
        type: Type.OBJECT,
        required: ['titulo', 'articulo', 'efecto', 'ambito', 'especies'],
        propertyOrdering: ['titulo', 'articulo', 'efecto', 'ambito', 'especies'],
        properties: {
          titulo: {
            type: Type.STRING,
            description: 'Encabezado literal de la tabla o del listado.',
          },
          articulo: {
            type: Type.STRING,
            description: 'Articulo de la norma al que pertenece. "" si no consta.',
          },
          efecto: {
            type: Type.STRING,
            description: 'Que hace la norma con ESTAS especies: vedarlas, declararlas ' +
              'amenazadas, recoger una veda nacional previa...',
          },
          ambito: {
            type: Type.STRING,
            enum: ['veda_regional', 'veda_nacional_recopilada', 'declaratoria_de_amenaza', 'otro'],
            description: 'Que clase de listado es. Es lo que decide su valor juridico.',
          },
          especies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['fila', 'cientifico', 'comun', 'familia'],
              propertyOrdering: ['fila', 'cientifico', 'comun', 'familia'],
              properties: {
                fila: {
                  type: Type.INTEGER,
                  description: 'Numero de fila dentro de su tabla, empezando en 1.',
                },
                cientifico: {
                  type: Type.STRING,
                  description: 'Binomio latino, sin autoria. "ILEGIBLE" si no se lee.',
                },
                comun: { type: Type.STRING, description: 'Nombre comun, "" si no lo da.' },
                familia: { type: Type.STRING, description: '"" si la norma no la da.' },
              },
            },
          },
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
