import { Type } from '@google/genai';

import { NUMERO_ESPECIES, REFERENCIA_REGIONAL } from './referencia.js';

/**
 * Rol experto. Se envia como systemInstruction (no como texto del usuario)
 * para que el modelo lo trate como marco de trabajo y no como dato a analizar.
 */
const ROL = `
Eres un dendrologo y anatomista de la madera con experiencia pericial en identificacion
macroscopica de especies lenosas a partir de la seccion transversal (corte de testa).
Trabajas para profesionales de la industria maderera: aserraderos, carpinteria, control de
calidad y verificacion de suministro.

METODO DE TRABAJO (aplicalo siempre, en este orden):
1. Evalua primero si la imagen muestra realmente una seccion transversal de madera y si la
   calidad (enfoque, iluminacion, escala, superficie lijada o rasgada) permite un analisis fiable.
2. Describe la anatomia visible antes de proponer un nombre. Observa:
   - Porosidad: difusa, semi-anillada (semi-porosa) o anillada.
   - Vasos/poros: tamano, abundancia, agrupacion (solitarios, multiples radiales, racemiformes),
     presencia de tilosis o contenidos (gomas, resinas, depositos blanquecinos).
   - Parenquima axial: apotraqueal difuso o en bandas, paratraqueal escaso, vasicentrico,
     aliforme, confluente, marginal o en lineas.
   - Radios: finura, espaciado, visibilidad a simple vista, radios anchos u ondulados.
   - Anillos de crecimiento: nitidos o difusos, transicion abrupta o gradual entre leno temprano
     y leno tardio; en coniferas, presencia de canales resiniferos.
   - Color y contraste albura/duramen, veteado o figura, y cualquier rasgo macroscopico util.
3. Solo entonces propon la identificacion mas probable y hasta tres alternativas plausibles,
   justificando cada una con los rasgos observados.

REGLAS DURAS:
- No inventes. Si un rasgo no es visible o es ambiguo, escribe exactamente "no visible" o
  "indeterminado"; si un dato no se puede establecer, escribe "desconocido".
- La identificacion macroscopica tiene limites reales: a menudo solo se llega al genero o a un
  grupo comercial. En ese caso indica el genero (p. ej. "Quercus sp.") y dilo en las limitaciones.
- CALIBRACION DE LA CONFIANZA. Esto es tan importante como el nombre que propongas: quien
  usa la app decide compras y peritajes segun ese numero, y una confianza inflada le hace
  mas dano que un "no se". Identificar especie con una sola foto macroscopica rara vez
  justifica pasar de 0,6. Usa esta escala y no la infles:
    0,0-0,3  No se puede precisar. Imagen insuficiente o caracteres no diagnosticos.
    0,3-0,5  Solo alcanzas familia o grupo comercial, o dudas entre varias especies.
    0,5-0,7  Genero probable, o especie con 3 caracteres coincidentes. LO NORMAL AQUI.
    0,7-0,9  Especie muy probable: 4 o mas caracteres independientes coinciden y ninguno
             la contradice.
    0,9-1,0  Reservado a caracteres unicos e inequivocos. Casi nunca con una foto.
  Si te apoyas en menos de tres caracteres, la confianza NO puede pasar de 0,5, por
  convincente que te parezca el parecido general.
  Si dos especies encajan casi igual de bien, ninguna puede superar 0,5: repartelas entre
  la principal y las alternativas.
- Si la imagen no es madera, o no es un corte transversal, pon identificacion_posible en false,
  explica el motivo en limitaciones y deja los campos de nombre como "desconocido".
- Distinguir especies del mismo genero, o maderas legalmente sensibles (CITES), suele exigir
  anatomia microscopica o analisis de laboratorio: advierte de ello cuando aplique.
- Responde SIEMPRE en espanol y unicamente con el JSON del esquema pedido.
`.trim();

/**
 * Instruccion de sistema completa: el rol mas la clave de determinacion regional.
 * La clave va al final para que quede contigua a la imagen del turno de usuario.
 */
export const SYSTEM_PROMPT = `${ROL}\n\n${REFERENCIA_REGIONAL}`;

/** Texto que acompana a la imagen en el turno del usuario. */
export const USER_PROMPT = `
Analiza esta fotografia del corte transversal de una pieza de madera e identifica la especie.

Contrasta lo que observes con la clave de las ${NUMERO_ESPECIES} maderas comerciales del Valle de Aburra
que tienes en la instruccion de sistema: la pieza probablemente sea una de ellas. Si ninguna
encaja con la anatomia observada, dilo y usa tu conocimiento general.

Rellena todos los campos del esquema JSON: caracteristicas anatomicas observadas, nombre comun,
nombre cientifico, familia, confianza calibrada, origen de la identificacion, alternativas
plausibles, limitaciones del analisis y recomendaciones concretas para mejorar la toma si la
imagen no es optima.
`.trim();

/**
 * Esquema de salida estructurada. Gemini lo respeta en modo application/json,
 * de forma que la app Android siempre recibe la misma forma de objeto.
 * Todos los campos son obligatorios: los "no se sabe" se expresan con
 * "desconocido" / "no visible", no con ausencia de campo.
 */
export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'identificacion_posible',
    'calidad_imagen',
    'nombre_comun',
    'nombres_comunes_alternativos',
    'nombre_cientifico',
    'familia',
    'confianza',
    'origen_identificacion',
    'caracteristicas_anatomicas',
    'alternativas',
    'usos_habituales',
    'limitaciones',
    'recomendaciones_captura',
  ],
  propertyOrdering: [
    'identificacion_posible',
    'calidad_imagen',
    'caracteristicas_anatomicas',
    'nombre_comun',
    'nombres_comunes_alternativos',
    'nombre_cientifico',
    'familia',
    'confianza',
    'origen_identificacion',
    'alternativas',
    'usos_habituales',
    'limitaciones',
    'recomendaciones_captura',
  ],
  properties: {
    identificacion_posible: {
      type: Type.BOOLEAN,
      description: 'false si la imagen no muestra un corte transversal de madera analizable.',
    },
    calidad_imagen: {
      type: Type.STRING,
      enum: ['alta', 'media', 'baja', 'insuficiente'],
      description: 'Aptitud de la foto para el analisis anatomico.',
    },
    caracteristicas_anatomicas: {
      type: Type.OBJECT,
      required: [
        'porosidad',
        'vasos_poros',
        'parenquima_axial',
        'radios',
        'anillos_crecimiento',
        'color_albura_duramen',
        'figura_veteado',
        'otros_rasgos',
      ],
      propertyOrdering: [
        'porosidad',
        'vasos_poros',
        'parenquima_axial',
        'radios',
        'anillos_crecimiento',
        'color_albura_duramen',
        'figura_veteado',
        'otros_rasgos',
      ],
      properties: {
        porosidad: {
          type: Type.STRING,
          description: 'Difusa, semi-anillada, anillada o no visible.',
        },
        vasos_poros: {
          type: Type.STRING,
          description: 'Tamano, abundancia, agrupacion, tilosis o contenidos.',
        },
        parenquima_axial: {
          type: Type.STRING,
          description: 'Tipo y patron del parenquima axial visible.',
        },
        radios: {
          type: Type.STRING,
          description: 'Finura, espaciado y visibilidad de los radios.',
        },
        anillos_crecimiento: {
          type: Type.STRING,
          description: 'Nitidez, transicion leno temprano/tardio, canales resiniferos.',
        },
        color_albura_duramen: {
          type: Type.STRING,
          description: 'Colores y contraste entre albura y duramen.',
        },
        figura_veteado: {
          type: Type.STRING,
          description: 'Veteado, jaspeado, radios visibles a simple vista, etc.',
        },
        otros_rasgos: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Rasgos adicionales relevantes (nudos, ataque biologico, marcas de sierra).',
        },
      },
    },
    nombre_comun: {
      type: Type.STRING,
      description: 'Nombre comercial o comun mas usado. "desconocido" si no procede.',
    },
    nombres_comunes_alternativos: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Otros nombres comerciales o regionales de la misma madera.',
    },
    nombre_cientifico: {
      type: Type.STRING,
      description: 'Binomio latino, o "Genero sp." si solo se llega al genero.',
    },
    familia: {
      type: Type.STRING,
      description: 'Familia botanica (p. ej. Fagaceae).',
    },
    confianza: {
      type: Type.NUMBER,
      description: 'Confianza calibrada de 0 a 1 en la identificacion principal.',
    },
    origen_identificacion: {
      type: Type.STRING,
      enum: ['guia_valle_aburra', 'conocimiento_general', 'no_identificada'],
      description:
        'guia_valle_aburra si la especie coincide con una ficha de la clave regional; ' +
        'conocimiento_general si la anatomia no encaja en la clave y recurres a otra fuente; ' +
        'no_identificada si no se pudo identificar.',
    },
    alternativas: {
      type: Type.ARRAY,
      description: 'Hasta 3 especies o grupos alternativos compatibles con lo observado.',
      items: {
        type: Type.OBJECT,
        required: ['nombre_comun', 'nombre_cientifico', 'familia', 'confianza', 'motivo'],
        propertyOrdering: ['nombre_comun', 'nombre_cientifico', 'familia', 'confianza', 'motivo'],
        properties: {
          nombre_comun: { type: Type.STRING },
          nombre_cientifico: { type: Type.STRING },
          familia: { type: Type.STRING },
          confianza: { type: Type.NUMBER },
          motivo: {
            type: Type.STRING,
            description: 'Rasgos que la apoyan y rasgos que la descartarian.',
          },
        },
      },
    },
    usos_habituales: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Usos industriales tipicos de la madera identificada.',
    },
    limitaciones: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Por que el resultado podria ser erroneo o incompleto (CITES, nivel de genero).',
    },
    recomendaciones_captura: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Acciones para una mejor foto: lijar la testa, luz rasante, macro, escala.',
    },
  },
};
