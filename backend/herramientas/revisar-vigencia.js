import { readFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ¿Sigue siendo cierto lo que la app dice de las normas?
 *
 * Las listas se regeneran solas cada mes, pero las vedas y los apendices CITES estan
 * curados a mano y nadie los vigila. Asi es como el cedro estuvo cuatro anos en el
 * Apendice equivocado: no fallo nada, simplemente nadie miro, y un dato que envejece no
 * hace ruido. Este script es el ruido.
 *
 * Corre al final del workflow mensual y SALE CON CODIGO 1 cuando la comprobacion se ha
 * pasado de plazo, para que la ejecucion salga en rojo. Va despues de guardar los datos,
 * asi que ponerse en rojo no impide que las listas se actualicen.
 *
 *   node herramientas/revisar-vigencia.js
 */

const DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'datos');
const vigencia = JSON.parse(readFileSync(join(DATOS, 'vigencia-normas.json'), 'utf8'));

const MES = 30 * 24 * 60 * 60 * 1000;
const meses = (fecha) => Math.floor((Date.now() - Date.parse(`${fecha}T00:00:00Z`)) / MES);

const limite = vigencia.meses_para_revisar ?? 12;
const desdeNormas = meses(vigencia.comprobado);
const desdeCites = meses(vigencia.cites?.comprobado ?? vigencia.comprobado);

const lineas = [
  `Normas de veda y amenaza: comprobadas hace ${desdeNormas} meses (${vigencia.comprobado}).`,
  `Apendices CITES: revisados hasta la ${vigencia.cites?.ultima_reunion_revisada ?? 'reunion sin anotar'}, hace ${desdeCites} meses.`,
  `Plazo acordado: ${limite} meses.`,
];

const vencidas = [];
if (desdeNormas >= limite) {
  vencidas.push(
    'Toca revisar las VEDAS y la resolucion de especies amenazadas. Buscar derogatorias ' +
      'posteriores a cada norma de vedas-colombia.json y confirmar que la Resolucion 0126 ' +
      'de 2024 sigue siendo la vigente. Despues, actualizar la fecha en vigencia-normas.json.'
  );
}
if (desdeCites >= limite) {
  vencidas.push(
    'Toca revisar los APENDICES CITES. Mirar si ha habido CoP nueva en cites.org y, si la ' +
      'hubo, que cambio para las maderas colombianas —Cedrela, Dipteryx, Handroanthus, ' +
      'Tabebuia, Roseodendron, Dalbergia, Swietenia—. Los cambios entran en vigor 90 dias ' +
      'despues de la reunion. Actualizar cites-actualizaciones.json y vigencia-normas.json.'
  );
}

for (const l of lineas) console.log(l);
for (const v of vencidas) console.log(`\nPENDIENTE: ${v}`);
if (vencidas.length === 0) console.log('\nAl dia. Nada que revisar todavia.');

// GitHub lo pinta en el resumen de la ejecucion, que es donde se lee sin abrir los logs.
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = vencidas.length
    ? [
        '### ⚠️ Hay normas que toca volver a comprobar',
        '',
        ...lineas.map((l) => `- ${l}`),
        '',
        ...vencidas.map((v) => `> ${v}`),
      ]
    : ['### Vigencia de las normas: al día', '', ...lineas.map((l) => `- ${l}`)];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
}

process.exit(vencidas.length > 0 ? 1 : 0);
