import { readFileSync } from 'node:fs';

/**
 * Claves de determinacion de las maderas comerciales del Valle de Aburra.
 *
 * Datos extraidos del curso "Anatomia e identificacion de maderas" (2011),
 * Laboratorio de Productos Forestales "Hector Anaya Lopez", Departamento de
 * Ciencias Forestales, Universidad Nacional de Colombia - Sede Medellin;
 * Angela Maria Vasquez Correa y Alejandra Maria Ramirez Arango. Descripciones
 * segun IAWA 1989/2004 y Coradin & Bolzon 1992.
 *
 * Se cargan una sola vez al arrancar y se inyectan en la instruccion de sistema.
 */
const especies = JSON.parse(
  readFileSync(new URL('../datos/maderas-valle-aburra.json', import.meta.url), 'utf8')
);

function comoFicha(e) {
  const lineas = [
    `### ${e.nombres.join(' / ')} — ${e.botanico} (${e.familia})`,
  ];
  if (e.otros_nombres.length) lineas.push(`Otros nombres: ${e.otros_nombres.join(', ')}.`);
  if (e.comercial) lineas.push(`Nombre comercial internacional: ${e.comercial}.`);
  if (e.amenaza) lineas.push(`Nivel de amenaza: ${e.amenaza}.`);
  lineas.push(`Organolepticos: ${e.organolepticos}`);
  lineas.push(`Macroscopicos: ${e.macroscopicos}`);
  return lineas.join('\n');
}

export const NUMERO_ESPECIES = especies.length;

/** Indice compacto, util para recordar el conjunto de un vistazo. */
export const INDICE_ESPECIES = especies
  .map((e) => `${e.nombres.join('/')} (${e.botanico})`)
  .join('; ');

export const REFERENCIA_REGIONAL = `
=== CLAVE DE REFERENCIA: ${NUMERO_ESPECIES} MADERAS COMERCIALES DEL VALLE DE ABURRA ===

Fuente: curso de Anatomia e Identificacion de Maderas, Laboratorio de Productos
Forestales "Hector Anaya Lopez", Universidad Nacional de Colombia - Sede Medellin (2011).

COMO USAR ESTA CLAVE:
- Los usuarios de esta aplicacion trabajan en el comercio maderero del area de Medellin,
  asi que la muestra fotografiada pertenece muy probablemente a una de estas ${NUMERO_ESPECIES} especies.
  Considera este conjunto ANTES que maderas europeas o asiaticas.
- Contrasta lo que observas en la foto con estas descripciones y razona por descarte.
- NO fuerces la coincidencia. Si la anatomia observada contradice a todas las fichas,
  dilo abiertamente y responde con tu conocimiento general: una identificacion inventada
  para encajar en la lista es peor que admitir que la pieza esta fuera de ella.
- Los datos cuantitativos (diametro de poros en um, poros por 10 mm2, radios por 5 mm)
  se midieron con lupa de 5-10 aumentos sobre corte lijado y humedecido. Una foto de movil
  sin escala rara vez permite medirlos: usalos como apoyo cualitativo (poros grandes o
  pequenos, muchos o pocos), nunca como si pudieras contarlos con precision.
- Los nombres comunes cambian entre regiones: prioriza los que aparecen en estas fichas,
  que son los usados en el comercio local.

${especies.map(comoFicha).join('\n\n')}

=== FIN DE LA CLAVE DE REFERENCIA ===
`.trim();
