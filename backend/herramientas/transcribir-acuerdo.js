/**
 * Transcribe un acuerdo o resolucion escaneado a la tabla de especies que lleva dentro.
 *
 * Existe por el Acuerdo 404 de 2020 de Cornare, que veda 30 especies del Oriente
 * antioqueno y solo esta publicado como PDF escaneado: sus paginas son imagenes
 * comprimidas en JBIG2, sin capa de texto. No hay forma de leerlo con las herramientas
 * del proyecto, y sin ese listado la app calla sobre vedas que si existen.
 *
 * Gemini si sabe leer un escaneo. Una consulta basta para las seis paginas, asi que
 * cuesta 1 de las ~160 diarias.
 *
 * Uso:
 *     GEMINI_API_KEY=... node herramientas/transcribir-acuerdo.js ruta/al/acuerdo.pdf
 *
 * Imprime el JSON por pantalla. NO escribe nada: la transcripcion de una norma se
 * revisa a ojo contra el original antes de pegarla en src/datos/vedas-colombia.json,
 * porque un OCR que se coma una especie deja un hueco que nadie va a notar.
 */
import { readFileSync } from 'node:fs';

import { GoogleGenAI, Type } from '@google/genai';

const ruta = process.argv[2];
if (!ruta) {
  console.error('\n  Falta la ruta del PDF.\n  Uso: node herramientas/transcribir-acuerdo.js acuerdo.pdf\n');
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error('\n  Falta GEMINI_API_KEY en el entorno.\n');
  process.exit(1);
}

const ESQUEMA = {
  type: Type.OBJECT,
  required: ['norma', 'autoridad', 'fecha', 'efecto', 'especies'],
  propertyOrdering: ['norma', 'autoridad', 'fecha', 'efecto', 'especies'],
  properties: {
    norma: { type: Type.STRING, description: 'Numero y tipo de norma, tal cual aparece.' },
    autoridad: { type: Type.STRING },
    fecha: { type: Type.STRING },
    efecto: { type: Type.STRING, description: 'Que prohibe o restringe exactamente.' },
    especies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['cientifico', 'comun'],
        propertyOrdering: ['cientifico', 'comun', 'familia'],
        properties: {
          cientifico: { type: Type.STRING, description: 'Binomio latino, sin autoria.' },
          comun: { type: Type.STRING, description: 'Nombre comun, "" si la norma no lo da.' },
          familia: { type: Type.STRING },
        },
      },
    },
  },
};

const INSTRUCCION = `
Transcribes normas ambientales colombianas escaneadas. Tu unico trabajo es COPIAR lo
que pone el documento, no interpretarlo ni completarlo.

Reglas:
- Copia los nombres cientificos EXACTAMENTE como aparecen, aunque veas que estan mal
  escritos o desactualizados. La transcripcion tiene que poder cotejarse con el original.
- No anadas ninguna especie que no este en el documento, por evidente que te parezca.
- Si una palabra no se lee bien, ponla igual y marcala con [?] al final.
- Si el documento tiene una tabla de especies, recorrela entera, fila por fila, hasta el
  final. Cuenta las filas y no te dejes ninguna.
`.trim();

const ai = new GoogleGenAI({ apiKey });

const respuesta = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash',
  contents: [
    {
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: readFileSync(ruta).toString('base64') } },
        {
          text:
            'Transcribe la tabla o el listado de especies que esta norma declara vedadas, ' +
            'protegidas o en peligro. Devuelve todas las especies, sin omitir ninguna.',
        },
      ],
    },
  ],
  config: {
    systemInstruction: INSTRUCCION,
    responseMimeType: 'application/json',
    responseSchema: ESQUEMA,
    temperature: 0,
  },
});

const datos = JSON.parse(respuesta.text);
console.log(JSON.stringify(datos, null, 2));
console.error(`\n  ${datos.especies.length} especies transcritas. REVISALAS contra el PDF antes de usarlas.\n`);
