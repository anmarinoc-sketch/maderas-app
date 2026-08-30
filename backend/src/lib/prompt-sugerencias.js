import { Type } from '@google/genai';

/**
 * Prompts de la sugerencia "¿qué puedo comer?" de NutriFoto.
 *
 * Aquí el modelo no estima: propone. La diferencia importa, porque el riesgo
 * cambia de sitio. En el análisis por foto el peligro era inventar un número
 * preciso; aquí es proponer un plato que no cabe en lo que queda del día, o que
 * exige ingredientes que no hay en la casa, o que ignora el plan que le dio a la
 * persona un profesional.
 *
 * De ahí las tres reglas que sostienen el prompt: las cantidades cuadran con lo
 * que queda, se cocina con lo que hay, y el plan del usuario manda sobre
 * cualquier idea propia del modelo.
 */

const ROL = `
Eres nutricionista dietista colombiano. Le propones a una persona qué comer AHORA, con
lo que le queda de su meta del día. Conoces la cocina colombiana y las porciones reales
de una casa en Colombia.

REGLAS QUE NO PUEDES ROMPER:

1. LAS CUENTAS CUADRAN. Cada opción que propongas debe caber en las calorías que
   quedan. Ajusta las cantidades hasta que quepa; no propongas un plato y luego digas
   que hay que comer menos. Si lo que queda es muy poco, propon algo pequeño y dilo.

2. SI HAY UN PLAN, EL PLAN MANDA. Cuando te pasen las porciones del plan de la persona,
   tus opciones se construyen CON ESAS PORCIONES y con esos alimentos, no con otros. Un
   plan se lo dio un profesional que conoce el caso; tu papel es ayudar a cumplirlo, no
   corregirlo. Si algo del plan te parece mejorable, cállatelo: no es tu paciente.

3. SI TE DICEN QUÉ HAY EN LA CASA, COCINAS CON ESO. No propongas ingredientes que no
   mencionaron, salvo los básicos que hay en cualquier cocina: sal, aceite, cebolla,
   ajo, tomate, limón, especias. Si con lo que hay no alcanza para nada razonable,
   dilo en "nota" y propon lo mínimo que faltaría comprar.

4. TRES OPCIONES DISTINTAS ENTRE SÍ. Que no sean el mismo plato con otro nombre: una
   más rápida, una más completa, una más liviana. Cada una con su preparación real, en
   pasos que alguien pueda seguir.

5. NÚMEROS HONESTOS. Las calorías de cada alimento deben cuadrar con sus macros
   (proteína x 4 + carbohidratos x 4 + grasas x 9, margen de 10 %), y los totales son
   la suma exacta de los alimentos. Son estimaciones de tabla, no mediciones.

6. NADA DE MEDICINA. No diagnosticas, no tratas condiciones, no hablas de suplementos
   ni de medicamentos. Si lo que te preguntan sale de "qué cocino con esto", dilo en
   "nota" y sugiere consultarlo con su profesional de salud.

TONO: neutro y práctico, de alguien que cocina. Informas, no juzgas. Ningún alimento es
"bueno", "malo", "limpio" ni "chatarra", y no felicitas ni regañas por lo que se comió.

Responde SIEMPRE en español y únicamente con el JSON del esquema pedido.
`.trim();

export const INSTRUCCION_SUGERENCIA = ROL;

/**
 * Arma el turno de usuario. Todo lo que sabe el modelo del caso entra por aquí:
 * lo que queda del día, la comida que toca, el plan si lo hay, y lo que la
 * persona escribió.
 */
export function promptDeSugerencia({ restante, meta, comida, ingredientes, preferencias, plan, consumido }) {
  const lineas = [];

  lineas.push(`COMIDA QUE TOCA: ${comida || 'la siguiente del día'}.`);
  lineas.push(
    `LE QUEDA HOY: ${Math.round(restante?.kcal ?? 0)} kcal, ` +
      `${Math.round(restante?.prot ?? 0)} g de proteína, ` +
      `${Math.round(restante?.carb ?? 0)} g de carbohidratos y ` +
      `${Math.round(restante?.gras ?? 0)} g de grasa.`
  );

  if (meta) {
    lineas.push(
      `SU META DEL DÍA COMPLETA ES: ${Math.round(meta.kcal)} kcal, ${Math.round(meta.prot)} g de ` +
        `proteína, ${Math.round(meta.carb)} g de carbohidratos, ${Math.round(meta.gras)} g de grasa.`
    );
  }

  if (consumido) {
    lineas.push(
      `HOY YA LLEVA: ${Math.round(consumido.kcal)} kcal ` +
        `(P ${Math.round(consumido.prot)} g, C ${Math.round(consumido.carb)} g, G ${Math.round(consumido.gras)} g).`
    );
  }

  if (plan) {
    lineas.push(
      '\nSU PLAN NUTRICIONAL (se lo dio un profesional; construye las opciones con estas ' +
        'porciones y estos alimentos):\n' +
        String(plan).slice(0, 4000)
    );
  }

  if (ingredientes?.trim()) {
    lineas.push(`\nLO QUE TIENE EN LA CASA: ${ingredientes.trim().slice(0, 600)}`);
  }

  if (preferencias?.trim()) {
    lineas.push(`\nPREFERENCIAS Y RESTRICCIONES: ${preferencias.trim().slice(0, 400)}`);
  }

  lineas.push(
    '\nPropón TRES opciones que quepan en lo que le queda. Para cada una: los alimentos ' +
      'con su cantidad y su aporte, los pasos de preparación, el tiempo, y una línea de ' +
      'por qué encaja con lo que le falta hoy.'
  );

  return lineas.join('\n');
}

const ALIMENTO = {
  type: Type.OBJECT,
  required: ['nombre', 'cantidad', 'unidad', 'gramos', 'calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
  propertyOrdering: ['nombre', 'cantidad', 'unidad', 'gramos', 'calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
  properties: {
    nombre: { type: Type.STRING, description: 'Nombre del alimento como se dice en Colombia.' },
    cantidad: { type: Type.NUMBER, description: 'Cantidad en la unidad indicada.' },
    unidad: {
      type: Type.STRING,
      description: 'g, ml, unidad, taza, cucharada, tajada, porción…',
    },
    gramos: {
      type: Type.NUMBER,
      description: 'Peso en gramos de esa cantidad. Obligatorio y mayor que cero: la app recalcula con él.',
    },
    calorias: { type: Type.NUMBER },
    proteina_g: { type: Type.NUMBER },
    carbohidratos_g: { type: Type.NUMBER },
    grasas_g: { type: Type.NUMBER },
  },
};

export const ESQUEMA_SUGERENCIA = {
  type: Type.OBJECT,
  required: ['opciones', 'nota'],
  propertyOrdering: ['opciones', 'nota'],
  properties: {
    opciones: {
      type: Type.ARRAY,
      description: 'Tres opciones distintas entre sí que quepan en lo que queda del día.',
      items: {
        type: Type.OBJECT,
        required: ['nombre', 'por_que', 'alimentos', 'totales', 'preparacion', 'tiempo_minutos', 'peso'],
        propertyOrdering: ['nombre', 'por_que', 'peso', 'tiempo_minutos', 'alimentos', 'totales', 'preparacion'],
        properties: {
          nombre: { type: Type.STRING, description: 'Nombre del plato, corto y reconocible.' },
          por_que: {
            type: Type.STRING,
            description: 'Una línea: por qué esta opción encaja con lo que le falta hoy.',
          },
          peso: {
            type: Type.STRING,
            enum: ['liviana', 'media', 'pesada'],
            description:
              'Qué tan contundente es el plato para el momento del día, no si es sano: ' +
              'liviana hasta 350 kcal, media hasta 650, pesada por encima.',
          },
          tiempo_minutos: { type: Type.NUMBER, description: 'Minutos de preparación, aproximado.' },
          alimentos: { type: Type.ARRAY, items: ALIMENTO },
          totales: {
            type: Type.OBJECT,
            required: ['calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
            propertyOrdering: ['calorias', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
            properties: {
              calorias: { type: Type.NUMBER },
              proteina_g: { type: Type.NUMBER },
              carbohidratos_g: { type: Type.NUMBER },
              grasas_g: { type: Type.NUMBER },
            },
          },
          preparacion: {
            type: Type.ARRAY,
            description: 'Pasos de preparación, uno por elemento. Cortos y en orden.',
            items: { type: Type.STRING },
          },
        },
      },
    },
    nota: {
      type: Type.STRING,
      description:
        'Lo que haya que advertir: que queda poco margen, que falta comprar algo, ' +
        'o que la pregunta se salía de lo alimentario. Vacío si no hay nada.',
    },
  },
};
