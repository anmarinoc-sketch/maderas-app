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

export const REFERENCIA_REGIONAL = `
=== CLAVE: ${NUMERO_ESPECIES} MADERAS COMERCIALES DEL VALLE DE ABURRA ===
Fuente: Universidad Nacional de Colombia - Sede Medellin, Laboratorio de Productos
Forestales "Hector Anaya Lopez" (2011). Solo se listan caracteres visibles en el
corte transversal.

COMO USAR ESTA CLAVE:
1. PRIMERO describe lo que ves en la foto, sin mirar la lista. Anota porosidad, tamano
   y agrupacion de poros, tipo de parenquima, finura de radios y anillos.
2. DESPUES busca que fichas son compatibles con esa descripcion.
3. Elige una especie solo si coincide en TRES O MAS caracteres independientes. Con dos
   o menos, responde al nivel de familia o de genero, o admite que no se puede precisar.
4. Prohibido elegir una ficha por descarte perezoso o porque "suene probable". Si dudas
   entre varias, ponlas todas en alternativas con confianza repartida.
5. Si la anatomia no encaja con ninguna, dilo y usa tu conocimiento general: la pieza
   puede ser importada o no estar en esta lista.
6. Los rangos numericos (um, poros/10mm2, radios/5mm) se midieron con lupa de 5-10
   aumentos sobre corte lijado y humedecido. En una foto de movil sin escala no puedes
   medirlos: usalos como orden de magnitud (grandes/pequenos, muchos/pocos), nunca como
   dato exacto.

${especies.map(comoLinea).join('\n\n')}

=== FIN DE LA CLAVE ===
`.trim();
