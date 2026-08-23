/**
 * Transcribe un acuerdo o resolucion escaneado a las tablas de especies que lleva dentro.
 *
 * Existe por el Acuerdo 404 de 2020 de Cornare, que veda especies del Oriente antioqueno
 * y solo esta publicado como PDF escaneado: sus paginas son imagenes en JBIG2, sin capa
 * de texto. Ninguna herramienta del proyecto puede leerlo. Gemini si.
 *
 * La logica esta en src/lib/transcribir.js y aqui solo queda la linea de comandos. Antes
 * este archivo tenia su propia copia del prompt y del esquema, y se quedo con la version
 * que APLANABA las tablas de la norma en una sola lista: eso mezclaba las vedas propias
 * de la corporacion con las nacionales que la norma solo recopila, que es un error grave
 * porque no tienen el mismo efecto juridico. Una sola copia, y en la biblioteca.
 *
 * Uso (la clave no se escribe en ningun archivo, se pasa en la misma linea):
 *
 *     $env:GEMINI_API_KEY="..."; node herramientas/transcribir-acuerdo.js acuerdo.pdf
 *
 * Imprime el JSON por pantalla y NO escribe nada. La transcripcion de una norma se
 * revisa antes de darle valor de dato legal:
 *
 *   1. Cotejar contra el original lo que se pueda leer.
 *   2. Buscar un grupo de control: si la norma recopila otra que ya tengamos transcrita,
 *      comparar esas especies dice cuanto fiarse del resto.
 *   3. Pasar los nombres por el Catalogo y por GBIF. Los que no resuelvan seran grafias
 *      antiguas de la norma o erratas de lectura, y hay que distinguirlo caso por caso.
 *   4. Contar. Si la norma dice cuantas especies son y no cuadran, faltan: dejarlo
 *      anotado en `listado_incompleto` en vez de dar la lista por buena.
 */
import { readFileSync } from 'node:fs';

import { transcribirPdf } from '../src/lib/transcribir.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error(
    '\n  Falta la ruta del PDF.\n' +
      '  Uso: node herramientas/transcribir-acuerdo.js acuerdo.pdf\n'
  );
  process.exit(1);
}

const { resultado, modelo } = await transcribirPdf(readFileSync(ruta));

console.log(JSON.stringify(resultado, null, 2));

const grupos = resultado.grupos ?? [];
const total = grupos.reduce((n, g) => n + (g.especies?.length ?? 0), 0);

console.error(`\n  Modelo: ${modelo}`);
console.error(`  ${grupos.length} tablas, ${total} filas en total:`);
for (const g of grupos) {
  console.error(`    - [${g.ambito}] ${g.especies?.length ?? 0}: ${(g.titulo ?? '').slice(0, 70)}`);
}
console.error('\n  REVISALO antes de usarlo. Las cuatro comprobaciones estan en la cabecera.\n');
