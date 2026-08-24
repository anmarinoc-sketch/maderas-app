/**
 * Separaciones finas entre las especies que YA se han confundido en campo.
 *
 * Las fichas de la clave contienen de sobra con que distinguir estos pares: el chingale
 * es blanco cremoso y el algarrobo cafe oscuro, el balso tiene 12-30 poros por 10mm2 y
 * el soto entre 65 y 125. El problema no era que faltara el dato, sino que quedaba
 * enterrado en la prosa de dos fichas que hay que leer y comparar. Aqui se saca a la
 * superficie, emparejado y en orden de peso.
 *
 * Solo entran pares realmente fallados, verificados por el usuario sobre la pieza fisica.
 * No se inventan confusiones plausibles: cada linea de este archivo se paga en tokens
 * que le quitan sitio a la clave.
 */

/**
 * El discriminador va primero, y es siempre el mas grosero de los que sirven: el que se
 * aprecia en una foto de movil sin escala. El color y la densidad de poros mandan sobre
 * las medidas en micras, que en una foto sin referencia son orden de magnitud.
 */
const PARES = [
  {
    a: 'CHINGALE (Jacaranda copaia)',
    b: 'ALGARROBO (Hymenaea courbaril)',
    veces: 2,
    porque: 'los dos tienen parenquima aliforme confluente, asi que caen en el mismo grupo',
    separa: [
      'COLOR, lo primero: el chingale es BLANCO CREMOSO, con albura y duramen casi iguales. ' +
        'El algarrobo va de CAFE OSCURO a CAFE ROJIZO, con la albura separada del duramen de ' +
        'golpe. Una pieza clara y pareja no es algarrobo.',
      'CONTENIDOS DE LOS POROS: en el chingale son BLANCOS; en el algarrobo, OSCUROS y muy ' +
        'caracteristicos. Es el mismo caracter con el color invertido.',
      'BANDAS MARGINALES: el algarrobo las tiene, regularmente espaciadas. El chingale no.',
      'CUANTOS POROS: chingale 12-30 por 10mm2; algarrobo 30-65, mas del doble.',
    ],
  },
  {
    a: 'CHINGALE (Jacaranda copaia)',
    b: 'GUAYACAN LILA (Tabebuia rosea)',
    veces: 1,
    porque: 'los dos son de parenquima confluente y de la misma familia botanica',
    separa: [
      'TAMANO DE LOS POROS: en el chingale se ven a simple vista, medianos (100-200 um). En ' +
        'el guayacan lila apenas se distinguen, y son la mitad de grandes (50-100 um).',
      'CUANTOS POROS: el chingale los tiene MUY escasos y gruesos; el guayacan lila, muchos ' +
        'mas y finos. Es la diferencia mas segura de las dos.',
      'COLOR: chingale blanco cremoso; guayacan lila cafe claro o almendrado.',
      'BANDAS TANGENCIALES CLARAS: el guayacan lila puede mostrarlas; el chingale no.',
    ],
  },
  {
    a: 'CEDRO (Cedrela odorata)',
    b: 'TECA (Tectona grandis)',
    veces: 2,
    porque:
      'comparten parenquima vasicentrico con bandas marginales y anillos definidos por esas ' +
      'mismas bandas: sobre el papel son casi la misma descripcion',
    separa: [
      'EL CONTRASTE DENTRO DEL ANILLO manda. La teca tiene los poros del comienzo del anillo ' +
        'MUY grandes (200-300 um, se ven de lejos) y los del final apenas visibles: el salto ' +
        'es abrupto y salta a la vista. En el cedro los poros son parejos, medianos ' +
        '(100-200 um), sin ese contraste marcado.',
      'COLOR: cedro rosado a marron rojizo. Teca marron dorado, y a menudo con bandas verde ' +
        'oliva, que son inconfundibles cuando aparecen.',
      'CONTENIDOS: el cedro los tiene NEGROS y abundantes.',
      'Si de verdad no se resuelve el contraste del anillo en la foto, no elijas: deja las dos ' +
        'en alternativas con la confianza repartida y dilo en limitaciones.',
    ],
  },
  {
    a: 'BALSO (Ochroma pyramidale)',
    b: 'SOTO (Virola spp.)',
    veces: 1,
    porque: 'los dos son maderas claras y livianas de parenquima escaso',
    separa: [
      'CUANTOS POROS, y no hay mas que mirar: el balso tiene 12-30 por 10mm2 y el soto entre ' +
        '65 y 125. Son cuatro veces mas. Si la cara del corte se ve tupida de poros, no es balso.',
      'TAMANO: los del balso son moderadamente grandes (200-300 um) y se ven de lejos; los del ' +
        'soto son medianos (100-200 um).',
      'ORIENTACION: el soto los tiene multiples de 2 a 3 con tendencia radial clara; el balso, ' +
        'sin ninguna orientacion.',
      'COLOR: el soto se oxida a marron negruzco con el tiempo; el balso se queda blanco hueso.',
    ],
  },
];

/**
 * Discrepancia entre fuentes sobre un caracter diagnostico.
 *
 * No se corrige la ficha de la UNAL, que es la fuente del proyecto y puede tener razon
 * para el material de aqui: se declara el desacuerdo. Lo que hay que evitar es que el
 * modelo descarte chingale por un caracter sobre el que las autoridades no se ponen de
 * acuerdo, que es la explicacion mas probable de sus tres fallos.
 */
const DISCREPANCIAS = `
UN CARACTER EN DISPUTA — CHINGALE (Jacaranda copaia)
La ficha de la UNAL describe sus poros como "predominantemente solitarios y algunos
multiples de 2". El Instituto Thunen de Hamburgo describe la misma especie como "en
multiplos, comunmente en filas radiales cortas de 2 a 3 vasos". Las dos fuentes se
contradicen en la agrupacion. Por tanto: NO descartes el chingale porque veas los poros en
filas radiales cortas, ni porque los veas solitarios. Ese caracter no decide aqui; decidelo
por el color, por lo escasos que son los poros y por el parenquima.
`.trim();

/**
 * Aviso sobre el color.
 *
 * El metodo de campo del curso pide humedecer la cara del corte, y la madera mojada se ve
 * bastante mas oscura y saturada que seca. Dos de los seis fallos registrados son maderas
 * CLARAS tomadas por maderas OSCURAS, asi que el aviso va aparte y en el mismo bloque.
 */
const AVISO_HUMEDAD = `
CUIDADO CON EL COLOR EN LA FOTO
El metodo de campo pide humedecer la cara del corte con agua antes de fotografiarla, y la
madera mojada se ve MAS OSCURA y mas saturada de lo que es en seco. No conviertas eso en un
duramen oscuro: si el tono es parejo en toda la cara y no se distingue una albura clara de un
duramen oscuro, sospecha antes de una madera clara humedecida que de una madera oscura. El
brillo mojado tambien puede tapar los contenidos de los poros.
`.trim();

/** Bloque listo para la clave, o cadena vacia si algun dia se vacia la lista. */
export function separacionesFinas() {
  if (PARES.length === 0) return '';

  const bloques = PARES.map((p) => {
    const pasos = p.separa.map((s, i) => `  ${i + 1}. ${s}`).join('\n');
    const cuantas = p.veces === 1 ? 'fallado 1 vez' : `fallado ${p.veces} veces`;
    return `${p.a}  vs  ${p.b}   [${cuantas}]\n  Se confunden porque ${p.porque}.\n  LO QUE LOS SEPARA, en este orden:\n${pasos}`;
  });

  return `
PASO 5 — SEPARACIONES QUE YA SE HAN FALLADO
Estas confusiones ocurrieron de verdad y las corrigio un profesional sobre la pieza fisica.
Si tu candidata es una de estas, comprueba el caracter que las separa ANTES de decidir, y
di en el analisis cual de los dos viste.

${bloques.join('\n\n')}

${DISCREPANCIAS}

${AVISO_HUMEDAD}
`.trim();
}

export const NUMERO_PARES = PARES.length;
