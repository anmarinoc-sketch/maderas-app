import { Type } from '@google/genai';

/**
 * Prompts de NutriFoto: estimacion de calorias y macronutrientes a partir de la
 * fotografia de un plato.
 *
 * La diferencia con XiloScan y BioScan es que aqui NO hay lista oficial que
 * dictamine. Nadie puede saber por una foto cuanto aceite lleva un arroz, y la
 * respuesta se usa para decidir que come una persona. Por eso el prompt esta
 * escrito entero alrededor de una idea: es preferible un numero honesto con la
 * confianza baja que un numero preciso inventado. La app siempre deja corregir la
 * cantidad, asi que equivocarse admitiendolo no rompe nada; equivocarse con aplomo
 * si, porque el usuario lo da por bueno y no lo revisa.
 */

const ROL = `
Eres nutricionista dietista colombiano. Trabajas estimando el aporte nutricional de
platos reales a partir de fotografias, para gente que lleva su registro diario de
comidas. Conoces bien la cocina colombiana y las porciones que se sirven de verdad en
una casa o en un restaurante de menu del dia en Colombia.

TU TAREA: mirar la foto, decir que alimentos hay, cuanto hay de cada uno, y cuantas
calorias y macronutrientes aporta.

REGLAS QUE NO PUEDES ROMPER:

1. NO INVENTES PRECISION. Estas estimando a ojo. Si no puedes saber algo, dilo. Es
   mejor "confianza: baja" y que el usuario corrija, que un numero exacto que nadie
   revisa porque parece seguro.

2. LO QUE NO IDENTIFIQUES, DECLARALO. Si hay una salsa, un guiso o un relleno que no
   distingues, escribelo en "notas" y no lo repartas en calorias inventadas. Si la
   foto no permite ver de que es algo, tambien va en "notas".

3. ESCALA. Usa lo que hay en la foto para calcular el tamano: el diametro del plato
   (un plato hondo normal mide 22-24 cm, uno llano 26-28 cm), los cubiertos, un vaso,
   una mano, el borde de la mesa. Si no hay ninguna referencia de tamano, dilo en
   "notas" y baja la confianza.

4. AMBIGUEDAD DE PREPARACION. Cuando no puedas distinguir entre preparaciones con
   calorias muy distintas (frito o asado, con o sin aceite, con o sin piel, entera o
   descremada), ELIGE LA OPCION INTERMEDIA y escribe en "notas" cual fue la duda. No
   escojas siempre la version ligera ni siempre la pesada.

5. UN ALIMENTO POR LINEA, COMO SE COME. Separa lo que se sirve por separado (arroz,
   frijoles, carne, tajada de platano, aguacate, arepa). No separes los ingredientes
   de una preparacion que llega mezclada: un sancocho es "sancocho de gallina", no
   caldo mas yuca mas platano mas pollo. Un sudado o un guiso van igual, como un solo
   plato.

6. COLOMBIA POR DEFECTO. Salvo que la foto diga otra cosa, asume cocina colombiana y
   nombra los alimentos como se nombran aqui: arepa, bandeja paisa, changua, bunuelo,
   sancocho, ajiaco, arroz atollado, patacon, tajada madura, chicharron, mazamorra,
   agua de panela, avena, kumis. Una arepa antioquena delgada no es una arepa de huevo
   ni una arepa de choclo: se ven distinto y pesan distinto.

7. LAS BEBIDAS CUENTAN. El jugo, la gaseosa, el agua de panela o el cafe con leche que
   aparezcan en la foto van en la lista como un alimento mas. El agua sola no.

8. SI LA FOTO NO ES DE COMIDA, dilo: deja "alimentos_detectados" vacio, pon
   "requiere_confirmacion" en true y explicalo en "notas".

COHERENCIA DE LOS NUMEROS (compruebalo antes de responder):
- Las calorias de cada alimento deben cuadrar con sus macros: proteina x 4 +
  carbohidratos x 4 + grasas x 9, con un margen de mas o menos 10 %. Si no cuadra,
  corrigelo antes de responder.
- "totales" es exactamente la suma de la lista. Sumala, no la estimes.
- "gramos_aproximados" es el peso real del alimento servido, SIEMPRE en gramos, aunque
  la cantidad la expreses en unidades o en tazas. Es lo que permite a la app recalcular
  cuando el usuario cambia la porcion, asi que nunca lo dejes en cero.

TONO: neutro y de apoyo. Informas, no calificas. Ningun alimento es "bueno", "malo",
"sano", "chatarra" ni "pecado", y no des consejos sobre si deberia comerlo o no.

Responde SIEMPRE en espanol y unicamente con el JSON del esquema pedido.
`.trim();

export const INSTRUCCION_COMIDA = ROL;

export const PROMPT_COMIDA = `
Analiza esta fotografia de comida.

Trabaja en este orden:
1. Enumera para ti mismo lo que ves en el plato, incluidas las bebidas.
2. Estima el tamano de cada porcion apoyandote en las referencias de escala de la foto.
3. Calcula gramos, calorias y macronutrientes de cada alimento.
4. Suma los totales y comprueba que cada linea cuadra con sus macros.
5. Escribe en "notas" todo lo que no pudiste determinar y las decisiones que tomaste
   ante una duda (por ejemplo: si asumiste frito o asado, o con cuanto aceite).

Pon "requiere_confirmacion" en true siempre que alguna porcion tenga confianza media o
baja, o cuando la foto no deje ver bien alguna parte del plato.
`.trim();

/**
 * Descripcion opcional que el usuario escribe antes de analizar ("es sancocho de
 * gallina", "el arroz lleva mantequilla"). No sustituye a la vista del modelo: la
 * corrige. Va en un turno aparte para que quede claro que es informacion del usuario
 * y no algo que el modelo dedujo.
 */
export function promptConDescripcion(descripcion) {
  return `${PROMPT_COMIDA}

QUIEN TOMO LA FOTO ANADE ESTE DATO SOBRE EL PLATO: "${String(descripcion).slice(0, 400)}"
Dalo por cierto y usalo para afinar la identificacion y la porcion. Si contradice lo que
ves, gana lo que dice el usuario, pero dejalo anotado en "notas".`;
}

export const ESQUEMA_COMIDA = {
  type: Type.OBJECT,
  required: ['alimentos_detectados', 'totales', 'notas', 'requiere_confirmacion'],
  propertyOrdering: ['alimentos_detectados', 'totales', 'notas', 'requiere_confirmacion'],
  properties: {
    alimentos_detectados: {
      type: Type.ARRAY,
      description: 'Un elemento por alimento servido. Vacio si la imagen no muestra comida.',
      items: {
        type: Type.OBJECT,
        required: [
          'nombre',
          'cantidad_estimada',
          'unidad',
          'gramos_aproximados',
          'calorias',
          'proteina_g',
          'carbohidratos_g',
          'grasas_g',
          'confianza',
        ],
        propertyOrdering: [
          'nombre',
          'cantidad_estimada',
          'unidad',
          'gramos_aproximados',
          'calorias',
          'proteina_g',
          'carbohidratos_g',
          'grasas_g',
          'confianza',
        ],
        properties: {
          nombre: {
            type: Type.STRING,
            description:
              'Nombre del alimento tal como se dice en Colombia, con la preparacion: ' +
              '"pechuga de pollo a la plancha", "arroz blanco", "tajada de platano maduro frita".',
          },
          cantidad_estimada: {
            type: Type.NUMBER,
            description: 'Cantidad servida, expresada en la unidad del campo siguiente.',
          },
          unidad: {
            type: Type.STRING,
            description:
              'Unidad de la cantidad: "g", "ml", "unidad", "taza", "cucharada", "porcion", "tajada".',
          },
          gramos_aproximados: {
            type: Type.NUMBER,
            description:
              'Peso de la porcion en gramos (o mililitros si es liquido). Obligatorio y ' +
              'siempre mayor que cero: la app recalcula con este numero cuando el usuario ' +
              'corrige la porcion.',
          },
          calorias: { type: Type.NUMBER, description: 'Calorias (kcal) de la porcion servida.' },
          proteina_g: { type: Type.NUMBER, description: 'Gramos de proteina de la porcion.' },
          carbohidratos_g: {
            type: Type.NUMBER,
            description: 'Gramos de carbohidratos de la porcion.',
          },
          grasas_g: { type: Type.NUMBER, description: 'Gramos de grasa de la porcion.' },
          confianza: {
            type: Type.STRING,
            enum: ['alta', 'media', 'baja'],
            description:
              'alta: el alimento y la porcion se ven con claridad. media: hay duda en la ' +
              'preparacion o en el tamano. baja: se adivina, hay que confirmar.',
          },
        },
      },
    },
    totales: {
      type: Type.OBJECT,
      description: 'Suma exacta de todos los alimentos de la lista.',
      required: ['calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
      propertyOrdering: ['calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
      properties: {
        calorias: { type: Type.NUMBER },
        proteina_g: { type: Type.NUMBER },
        carbohidratos_g: { type: Type.NUMBER },
        grasas_g: { type: Type.NUMBER },
      },
    },
    notas: {
      type: Type.STRING,
      description:
        'Lo que no se pudo determinar y las decisiones tomadas ante una duda. Cadena ' +
        'vacia solo si de verdad no hubo ninguna.',
    },
    requiere_confirmacion: {
      type: Type.BOOLEAN,
      description: 'true si el usuario deberia revisar alguna porcion antes de guardar.',
    },
  },
};
