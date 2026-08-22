import { readFileSync } from 'node:fs';

/**
 * Clave de determinacion de las maderas comerciales del Valle de Aburra.
 *
 * Datos del curso "Anatomia e identificacion de maderas" (2011), Laboratorio de
 * Productos Forestales "Hector Anaya Lopez", Universidad Nacional de Colombia -
 * Sede Medellin. Descripciones segun IAWA 1989/2004 y Coradin & Bolzon 1992.
 *
 * De las fichas originales solo se envia al modelo lo que se puede ver en una
 * fotografia del corte transversal. Se descarta a proposito:
 *   - Lineas vasculares, estratificacion y altura de radios: son caracteres del
 *     plano tangencial o radial, invisibles en una foto de testa.
 *   - Olor, sabor, brillo, grano, textura, tacto y densidad: no se fotografian.
 *   - Distribucion geografica y propiedades mecanicas: no ayudan a identificar.
 * Ese recorte baja la referencia de ~42.000 a ~13.000 caracteres y, sobre todo,
 * quita ruido que empujaba al modelo a anclarse en una misma especie.
 */
const especies = JSON.parse(
  readFileSync(new URL('../datos/maderas-valle-aburra.json', import.meta.url), 'utf8')
);

/** Frases de relleno que se repiten en las 34 fichas sin aportar nada. */
const RELLENO = [
  /\s*en el plano transversal \(X\)\s*/gi,
  /\s*en el plano tangencial \(T\)\s*/gi,
  /\s*en el plano radial \(R\)\s*/gi,
  /\s*predominantemente\s*/gi,
  /\s*regularmente\s*/gi,
  /\s*aproximadamente\s*/gi,
];

function compactar(texto) {
  let t = ` ${texto} `;
  for (const re of RELLENO) t = t.replace(re, ' ');
  return t
    // Magnificacion y visibilidad
    .replace(/visibles? con aumento de 5x/gi, '5x')
    .replace(/visibles? a simple vista/gi, 'a simple vista')
    .replace(/apenas visibles?/gi, 'apenas visibles')
    // Unidades: la notacion corta dice lo mismo con la cuarta parte de tokens
    .replace(/de (\d+) a (\d+)/gi, '$1-$2')
    .replace(/\s*μm de (di[áa]metro|ancho)/gi, 'um')
    .replace(/\s*μm/gi, 'um')
    .replace(/\s*en 10\s*mm2\s*/gi, '/10mm2 ')
    .replace(/\s*por 5\s*mm/gi, '/5mm')
    .replace(/menores? de 1\s*mm/gi, '<1mm')
    .replace(/menos de /gi, '<')
    // Muletillas
    .replace(/\bdefinidos? por\b/gi, 'def.')
    .replace(/\bde color\b/gi, '')
    .replace(/con transici[óo]n (gradual|abrupta) a/gi, (m, tipo) => `-> (${tipo})`)
    .replace(/\by algunos\b/gi, '+')
    .replace(/\bm[úu]ltiples de\b/gi, 'multiples')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;.])/g, '$1')
    .trim()
    .replace(/[.;,]$/, '');
}

/**
 * Quita del segmento SOLO su etiqueta inicial, que ya va en mayusculas delante.
 * El patron termina en \b a proposito: sin el se comia el texto que sigue hasta
 * la primera letra acentuada ("canales secretores axiales traumaticos" -> "aticos").
 */
function sinEtiqueta(texto, etiqueta) {
  return texto
    .replace(new RegExp(`^\\s*(?:${etiqueta})\\b`, 'i'), '')
    .replace(/^[,;:\s]+/, '')
    .trim();
}

/** Reparte la prosa de la ficha en los caracteres que se ven en la testa. */
function caracteres(macroscopicos) {
  const partes = macroscopicos.split(/;\s*/);
  const buscar = (re) => {
    const encontrado = partes.find((p) => re.test(p));
    return encontrado ? compactar(encontrado) : null;
  };

  const radios = buscar(/\bradios\b/i);

  return {
    porosidad: buscar(/porosidad/i)?.replace(/^porosidad\s*/i, ''),
    poros: sinEtiqueta(buscar(/poros\b/i) || '', 'poros') || null,
    parenquima: sinEtiqueta(buscar(/par[ée]nquima/i) || '', 'par[ée]nquima') || null,
    // El segmento de radios arrastra contraste radial y estratificacion tangencial,
    // que no se ven en la testa: se corta ahi.
    radios: radios
      ? sinEtiqueta(radios, 'radios').split(/,\s*(?:contrastad|no contrastad|bajos|altos|estratificad|no estratificad)/i)[0].trim()
      : null,
    anillos: sinEtiqueta(buscar(/anillos de crecimiento/i) || '', 'anillos de crecimiento') || null,
    canales: sinEtiqueta(buscar(/canales/i) || '', 'canales') || null,
  };
}

/** Del apartado organoleptico solo interesa el color: es lo unico que se fotografia. */
function color(organolepticos) {
  const primera = organolepticos.split(/;\s*/)[0];
  return /albura|duramen|color/i.test(primera) ? compactar(primera) : null;
}

function comoLinea(e) {
  const c = caracteres(e.macroscopicos);
  const campos = [
    c.porosidad && `POROSIDAD: ${c.porosidad}`,
    c.poros && `POROS: ${c.poros}`,
    c.parenquima && `PARENQUIMA: ${c.parenquima}`,
    c.radios && `RADIOS: ${c.radios}`,
    c.anillos && `ANILLOS: ${c.anillos}`,
    c.canales && `CANALES: ${c.canales}`,
    color(e.organolepticos) && `COLOR: ${color(e.organolepticos)}`,
  ].filter(Boolean);

  const cabecera = `${e.nombres.join('/')} — ${e.botanico} (${e.familia})`;
  const aviso = e.amenaza ? `\n  AMENAZA: ${e.amenaza}` : '';
  return `${cabecera}\n  ${campos.join('\n  ')}${aviso}`;
}

export const NUMERO_ESPECIES = especies.length;

/**
 * Grupos de la clave, en el orden en que se recorren.
 *
 * El primer corte NO es la porosidad: 30 de las 32 latifoliadas de esta flora son de
 * porosidad difusa, asi que ese carácter casi no separa. El que reparte de verdad es
 * el tipo de parenquima axial.
 */
const GRUPOS = [
  {
    id: 'CONIFERAS',
    titulo: 'CONIFERAS — sin poros: tejido uniforme de traqueidas',
    prueba: (e) => /CUPRESSACEAE|PINACEAE/i.test(e.familia),
  },
  {
    id: 'A',
    titulo: 'GRUPO A — parenquima ALIFORME o CONFLUENTE (alas o puentes entre poros)',
    prueba: (e) => /aliforme|confluente/i.test(e.macroscopicos),
  },
  {
    id: 'B',
    titulo: 'GRUPO B — parenquima VASICENTRICO (solo un anillo ceñido al poro)',
    prueba: (e) => /vasic[ée]ntrico/i.test(e.macroscopicos),
  },
  {
    id: 'C',
    titulo: 'GRUPO C — parenquima EN BANDAS (lineas tangenciales continuas)',
    prueba: (e) => /en bandas/i.test(e.macroscopicos),
  },
  {
    id: 'D',
    titulo: 'GRUPO D — parenquima APOTRAQUEAL DIFUSO (puntos sueltos, sin relacion con el poro)',
    prueba: (e) => /apotraqueal|difuso/i.test(e.macroscopicos),
  },
  {
    id: 'E',
    titulo: 'GRUPO E — parenquima ESCASO, AUSENTE o NO VISIBLE',
    prueba: () => true,
  },
];

/** Reparte cada especie en el primer grupo cuya prueba encaje. */
function agrupar() {
  const pendientes = [...especies];
  return GRUPOS.map((g) => {
    const miembros = [];
    for (let i = pendientes.length - 1; i >= 0; i--) {
      if (g.prueba(pendientes[i])) miembros.unshift(...pendientes.splice(i, 1));
    }
    return { ...g, miembros };
  }).filter((g) => g.miembros.length);
}

const grupos = agrupar();

const indice = grupos
  .map((g) => `  ${g.titulo}  ->  ${g.miembros.length} especies`)
  .join('\n');

const cuerpo = grupos
  .map(
    (g) =>
      `----- ${g.titulo} (${g.miembros.length}) -----\n\n` +
      g.miembros.map(comoLinea).join('\n\n')
  )
  .join('\n\n');

export const REFERENCIA_REGIONAL = `
=== CLAVE DE ${NUMERO_ESPECIES} MADERAS COMERCIALES DEL VALLE DE ABURRA ===
Fuente: Universidad Nacional de Colombia - Sede Medellin, Laboratorio de Productos
Forestales "Hector Anaya Lopez" (2011). Solo caracteres visibles en el corte transversal.

RECORRE LA CLAVE EN ESTE ORDEN. No leas las fichas en paralelo: descarta grupos enteros.

PASO 1 — ¿Se ven poros (vasos)?
  NO, tejido uniforme y radios finisimos ....... vete al grupo CONIFERAS y no mires el resto.
  SI, hay poros ................................ sigue al paso 2.

PASO 2 — Porosidad.
  Anotala, pero AQUI CASI NO DISCRIMINA: 30 de las 32 latifoliadas de esta flora son de
  porosidad difusa. Que sea difusa no descarta practicamente nada.

PASO 3 — Tipo de parenquima axial. ESTE es el carácter que reparte esta flora.
  Mira si el tejido claro forma alas o puentes entre poros, un anillo ceñido a cada poro,
  bandas tangenciales, puntos sueltos, o si no se ve. Elige UN grupo:

${indice}

PASO 4 — Ya dentro del grupo, separa por tamano de poros, cuantos hay, si son solitarios
  o multiples, si tienen tilosis o contenidos, y por la finura y numero de radios.

REGLAS QUE NO PUEDES SALTARTE:
- Describe primero lo que ves; solo despues mires a que grupo pertenece.
- Elige una especie unicamente si coincide en TRES O MAS caracteres independientes.
  Con dos o menos, responde a nivel de familia o de genero, o di que no se puede precisar.
- Si el parenquima no se distingue en la foto, NO adivines el grupo: dilo en limitaciones
  y responde con la confianza baja que corresponde.
- Si dudas entre varias, ponlas todas en alternativas con la confianza repartida.
- Si nada encaja, dilo y usa tu conocimiento general: la pieza puede ser importada.
- Los rangos numericos (um, poros/10mm2, radios/5mm) se midieron con lupa de 5-10 aumentos
  sobre corte lijado. En una foto de movil sin escala son orden de magnitud, no medida.

${cuerpo}

=== FIN DE LA CLAVE ===
`.trim();
