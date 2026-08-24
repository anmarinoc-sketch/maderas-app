import { readFileSync } from 'node:fs';

import { separacionesFinas } from './confusiones.js';

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


/**
 * Cuantos poros hay y de que tamano, sacados de la prosa de la ficha.
 *
 * Son los dos numeros que de verdad separan dentro de un grupo, y los unicos que se
 * pueden estimar en una foto sin escala: el tamano por comparacion con los radios, y la
 * cantidad contandolos. Se leen 32 de 34 tamanos y 28 de 34 densidades; lo que falta
 * queda como "?" en la tabla, que es informacion util: avisa de que ahi no se puede
 * separar por este camino.
 */
function porosDe(e) {
  const seg =
    e.macroscopicos.split(/;\s*/).find((x) => /poros en el plano transversal/i.test(x)) ?? '';
  const um = seg.match(/de (\d+) a (\d+)\s*[μu]m/);
  const den = seg.match(/de (\d+) a (\d+) en 10\s*mm2/);
  return {
    um: um ? `${um[1]}-${um[2]}` : '?',
    den: den ? `${den[1]}-${den[2]}` : '?',
    orden: den ? Number(den[1]) : 9999,
  };
}

/**
 * Tabla de separacion de un grupo, ordenada por cuantos poros hay.
 *
 * Existe porque la medicion del 24-08-2026 mostro que el modelo acierta el grupo el 64%
 * de las veces pero la especie solo el 14%: elegia el grupo bien y luego respondia la
 * PRIMERA ficha de la lista. Diez de veintinueve respuestas fueron Hymenaea courbaril,
 * que encabeza el grupo A, y cinco Cariniana pyriformis, que encabeza el C. Con la tabla
 * delante puede situar lo que midio en vez de tirar por la primera.
 */
function tablaDe(miembros) {
  const datos = miembros.map(porosDe);
  const utiles = datos.filter((d) => d.den !== '?' || d.um !== '?').length;
  // Sin al menos dos especies con numeros, la tabla no separa nada.
  if (miembros.length < 2 || utiles < 2) return null;

  const filas = miembros
    .map((e) => ({ e, ...porosDe(e) }))
    .sort((a, b) => a.orden - b.orden)
    .map(
      ({ e, um, den }) =>
        `  ${den.padEnd(8)} ${um.padEnd(9)} ${e.botanico.split(/\s+/).slice(0, 2).join(' ')} (${e.nombres[0].toLowerCase()})`
    );
  return ['  poros/10mm2  tamano-um  especie', ...filas].join('\n');
}
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
      (tablaDe(g.miembros)
        ? `SEPARACION DE ESTE GRUPO — situa aqui lo que mediste antes de elegir:\n${tablaDe(g.miembros)}\n\n`
        : '') +
      g.miembros.map(comoLinea).join('\n\n')
  )
  .join('\n\n');

/**
 * Especies que la propia guia NO separa: su ficha se queda en el genero.
 *
 * No es un descuido de la ficha. Los anatomistas del laboratorio, con la pieza en la
 * mano y microscopio, escribieron "Virola spp" porque la anatomia no distingue esas
 * especies entre si. Pedirle al modelo que afine mas que la fuente es pedirle que
 * invente: para estas, el genero ES la respuesta correcta.
 */
const SIN_SEPARAR = especies.filter((e) => /\b(spp?|sp)\.?$/i.test(e.botanico.trim()));

export const AVISO_NIVEL = SIN_SEPARAR.length
  ? `
ESTAS NO SE SEPARAN POR ANATOMIA, Y NO PASA NADA:
${SIN_SEPARAR.map((e) => `  - ${e.botanico}  (${e.nombres[0].toLowerCase()})`).join('\n')}
La guia se queda en el genero porque las especies de cada uno de esos generos no se
distinguen entre si en el corte. Si tu candidata es una de ellas, responde con el
genero y ya esta: es la respuesta correcta y completa. NO te inventes un epiteto
especifico para que suene mas preciso.`.trim()
  : '';

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

PASO 4 — Separar DENTRO del grupo. AQUI ES DONDE SE FALLA.
  Acertar el grupo es la mitad del trabajo, y la mas facil. Cada grupo trae delante una
  tabla con cuantos poros tiene cada especie y de que tamano. Usala asi, sin saltarte pasos:
  a) Estima en la foto cuantos poros hay por cada 10mm2 y como de gruesos son. El tamano
     se estima comparando con el grosor de los radios, no a ojo absoluto.
  b) Busca en la tabla del grupo que especies caen en esos dos rangos.
  c) DESCARTA las que no encajan y di por que las descartas. Escribelo, no lo pienses solo.
  d) Si aun quedan varias, separalas por los contenidos de los poros, por el color de
     albura y duramen, y por la finura y numero de radios.
  e) Si despues de eso siguen quedando varias, NO elijas: responde a nivel de genero o de
     grupo y dilo en nivel_identificacion. Es una respuesta correcta, no una rendicion.

  REGLA CONTRA EL SESGO DE LA LISTA, y es la mas importante de todas:
  NUNCA elijas una especie por ser la primera de su grupo. Si tu unica razon para nombrarla
  es que encabeza la lista, entonces no tienes razon: lo que tienes es el grupo, no la
  especie, y eso es lo que debes responder. El orden dentro de cada grupo es por cantidad de
  poros, no por probabilidad: la primera no es la mas comun ni la mas probable.

REGLAS QUE NO PUEDES SALTARTE:
- Describe primero lo que ves; solo despues mires a que grupo pertenece.
- Elige una especie unicamente si coincide en TRES O MAS caracteres independientes.
  Con dos o menos, responde a nivel de familia o de genero, o di que no se puede precisar.
- Si el parenquima no se distingue en la foto, NO adivines el grupo: dilo en limitaciones
  y responde con la confianza baja que corresponde.
- Si dudas entre varias, ponlas todas en alternativas con la confianza repartida.
- Si nada encaja, dilo y usa tu conocimiento general: la pieza puede ser importada.
- Los rangos numericos (um, poros/10mm2, radios/5mm) se midieron con lupa de 5-10 aumentos
  sobre corte hecho con bisturi y humedecido. En una foto de movil sin escala son orden de magnitud, no medida.

${cuerpo}

${separacionesFinas()}

${AVISO_NIVEL}

=== FIN DE LA CLAVE ===
`.trim();


/**
 * Emparejamiento de nombres escritos a mano con las fichas de la guia.
 *
 * Cuando el usuario corrige una identificacion escribe lo que dice en el patio:
 * "chingale", "Es teca", "Balso". Sin esto, "Chingale" y "Jacaranda copaia" quedan
 * registrados como dos maderas distintas y los avisos de error se reparten entre las
 * dos, justo en la especie que mas ha fallado. Con esto, todo aterriza en su ficha.
 */

/** Minusculas, sin tildes y sin las palabras que el usuario intercala al escribir. */
function llave(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\b(es|era|un|una|el|la|los|las|de|del|madera|palo|tipo|creo que|parece)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Indice nombre -> ficha. El binomio entra tambien sin el autor: "Tectona grandis L. f.". */
const PORNOMBRE = new Map();
for (const e of especies) {
  const candidatos = [
    ...e.nombres,
    ...(e.otros_nombres ?? []),
    e.comercial,
    e.botanico,
    // Genero + epiteto: la app devuelve el binomio con autor y el usuario lo copia tal cual.
    e.botanico.split(/\s+/).slice(0, 2).join(' '),
    // Solo el genero, util cuando la identificacion no paso de ahi.
    e.botanico.split(/\s+/)[0],
  ];
  for (const c of candidatos) {
    const k = llave(c);
    // El genero suelto puede repetirse entre fichas: no se pisa la primera.
    if (k && !PORNOMBRE.has(k)) PORNOMBRE.set(k, e);
  }
}

/** Ficha de la guia que corresponde a un texto libre, o null si no es de las 34. */
export function buscarEspecie(texto) {
  const k = llave(texto);
  if (!k) return null;
  if (PORNOMBRE.has(k)) return PORNOMBRE.get(k);

  // "es teca" -> "teca": se prueba palabra por palabra antes de darla por desconocida.
  const palabras = k.split(' ');
  for (let i = 0; i < palabras.length; i += 1) {
    const par = palabras.slice(i, i + 2).join(' ');
    if (par && PORNOMBRE.has(par)) return PORNOMBRE.get(par);
    if (PORNOMBRE.has(palabras[i])) return PORNOMBRE.get(palabras[i]);
  }
  return null;
}

/**
 * Nombre canonico para el registro y los avisos: binomio y nombre comun juntos, para
 * que el modelo lo reconozca venga como venga y el usuario lo lea como lo dice.
 * Si no es una de las 34, se devuelve lo que escribio el usuario, limpio.
 */
export function nombreCanonico(texto) {
  const e = buscarEspecie(texto);
  if (!e) return String(texto ?? '').trim();
  return `${e.botanico} (${e.nombres[0].toLowerCase()})`;
}
