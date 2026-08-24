/**
 * Cuanto cubren de verdad las listas, grupo por grupo.
 *
 * Conviene pasarlo despues de cada actualizacion mensual y siempre que se anada una
 * fuente. Fue lo que destapo el hueco de reptiles y anfibios: la app parecia completa
 * hasta que se miro por grupos y resulto que de esos dos solo estaban los amenazados,
 * en el segundo pais del mundo en anfibios.
 *
 *     node herramientas/auditar-cobertura.js
 *
 * No hace falta red ni cuota: todo sale de los archivos en disco.
 */
import { consultarPorNombreCientifico, estaEnColombia } from '../src/lib/especies.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'datos');
const leer = (f) => JSON.parse(readFileSync(join(DATOS, f), 'utf8'));

/* ------------------------------------------------------------- lo que hay en disco */

const flora = leer('flora-colombia.json');
const fauna = leer('fauna-colombia.json');
const herpeto = leer('herpetofauna-colombia.json');

console.log('\n=== EN DISCO');
console.log('  flora y liquenes  :', Object.keys(flora.especies).length.toLocaleString('es-CO'));

const porClase = {};
for (const e of [...Object.values(fauna.especies), ...Object.values(herpeto.especies)]) {
  const clase = e.clase || e.grupo || '?';
  porClase[clase] = (porClase[clase] || 0) + 1;
}
for (const [clase, n] of Object.entries(porClase).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${clase.padEnd(18)}:`, n.toLocaleString('es-CO'));
}

/* ------------------------------------------------------------------------ muestra */

/**
 * Especies colombianas conocidas de cada grupo. Lo que importa no es que la app diga
 * algo, sino que lo diga desde una lista y no desde el modelo.
 */
const MUESTRA = [
  ['flora', 'Quercus humboldtii'], ['flora', 'Cedrela odorata'], ['flora', 'Ceroxylon quindiuense'],
  ['flora', 'Espeletia grandiflora'], ['flora', 'Victoria amazonica'], ['flora', 'Theobroma cacao'],
  ['aves', 'Amazona ochrocephala'], ['aves', 'Crax alberti'], ['aves', 'Ramphastos ambiguus'],
  ['aves', 'Vultur gryphus'], ['aves', 'Eriocnemis mirabilis'],
  ['mamiferos', 'Tremarctos ornatus'], ['mamiferos', 'Panthera onca'],
  ['mamiferos', 'Tapirus pinchaque'], ['mamiferos', 'Inia geoffrensis'],
  ['reptiles', 'Bothrops asper'], ['reptiles', 'Crocodylus acutus'], ['reptiles', 'Iguana iguana'],
  ['reptiles', 'Lachesis muta'],
  ['anfibios', 'Dendrobates truncatus'], ['anfibios', 'Phyllobates terribilis'],
  ['anfibios', 'Atelopus varius'],
  ['peces', 'Prochilodus magdalenae'], ['peces', 'Pseudoplatystoma magdaleniatum'],
  ['insectos', 'Danaus plexippus'], ['insectos', 'Morpho helenor'],
];

console.log('\n=== MUESTRA');
const huecos = {};

for (const [grupo, nombre] of MUESTRA) {
  const local = estaEnColombia(nombre);
  const f = consultarPorNombreCientifico(nombre);

  const tiene = [
    f.origen.valor !== 'desconocido' ? 'origen' : null,
    f.endemica.valor !== null ? 'endemismo' : null,
    f.amenaza.nacional ? 'amenaza' : null,
    f.distribucion.departamentos ? 'deptos' : null,
    f.nombres_comunes ? 'comunes' : null,
  ].filter(Boolean);

  if (!local) huecos[grupo] = (huecos[grupo] || 0) + 1;

  console.log(
    `  ${grupo.padEnd(10)} ${nombre.padEnd(32)} ${local ? 'EN LISTA' : 'NO ESTA '} ` +
      `${tiene.join(', ') || '(sin datos locales)'}`
  );
}

console.log('\n=== HUECOS');
const entradas = Object.entries(huecos);
if (entradas.length === 0) {
  console.log('  ninguno en la muestra');
} else {
  for (const [g, n] of entradas) console.log(`  ${g}: ${n} sin lista local`);
  console.log('\n  Lo que no esta en lista lo resuelve GBIF en caliente, pero sin origen');
  console.log('  ni endemismo oficial. Ver "Huecos conocidos" en la skill.');
}
console.log('');
