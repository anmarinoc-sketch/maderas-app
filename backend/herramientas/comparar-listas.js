/**
 * Cuenta las entradas de cada lista, y compara con una cuenta anterior.
 *
 * Lo usa el workflow que regenera las listas cada mes. Vive en un archivo y no dentro
 * del YAML a proposito: los `node -e` incrustados en YAML pasan por dos capas de
 * escapado (la del YAML y la del shell) y en este proyecto eso ya se ha comido comillas
 * y barras invertidas mas de una vez. Aqui ademas se puede probar antes de subirlo.
 *
 *   node herramientas/comparar-listas.js contar  > antes.json
 *   node herramientas/comparar-listas.js comparar antes.json resumen.md
 *
 * `comparar` sale con codigo 1 si alguna lista ha encogido mas de un 20 %.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'datos');

/** Cuantas entradas tiene cada archivo de datos. */
function contar() {
  const conteo = {};
  for (const archivo of readdirSync(DATOS)) {
    if (!archivo.endsWith('.json')) continue;
    const datos = JSON.parse(readFileSync(join(DATOS, archivo), 'utf8'));
    // Unas listas son { especies: {...} } y otras un objeto plano; ambas cuentan igual.
    conteo[archivo] = Object.keys(datos.especies ?? datos.normas ?? datos).length;
  }
  return conteo;
}

/**
 * Una lista oficial puede crecer o encoger un poco cuando se revisa. Perder mas de una
 * quinta parte no es una revision: es una descarga a medias. Subirla dejaria la app
 * afirmando que especies reales no existen, que es peor que no actualizar nada.
 */
const CAIDA_MAXIMA = 0.8;

function comparar(rutaAntes, rutaResumen) {
  const antes = JSON.parse(readFileSync(rutaAntes, 'utf8'));
  const ahora = contar();

  const filas = ['| Lista | Antes | Ahora | Cambio |', '|---|---|---|---|'];
  let sospechoso = false;

  for (const [archivo, cuenta] of Object.entries(ahora)) {
    const previo = antes[archivo];

    if (previo === undefined) {
      filas.push(`| ${archivo} | — | ${cuenta} | nueva |`);
      continue;
    }

    const delta = cuenta - previo;
    filas.push(`| ${archivo} | ${previo} | ${cuenta} | ${delta >= 0 ? '+' : ''}${delta} |`);

    if (previo > 0 && cuenta < previo * CAIDA_MAXIMA) {
      console.error(`::error::${archivo} paso de ${previo} a ${cuenta}. Descarga sospechosa.`);
      sospechoso = true;
    }
  }

  const resumen = filas.join('\n') + '\n';
  if (rutaResumen) writeFileSync(rutaResumen, resumen);
  console.log(resumen);

  return sospechoso ? 1 : 0;
}

const orden = process.argv[2];

if (orden === 'contar') {
  console.log(JSON.stringify(contar(), null, 2));
} else if (orden === 'comparar') {
  process.exit(comparar(process.argv[3], process.argv[4]));
} else {
  console.error('\n  Uso: comparar-listas.js contar | comparar <antes.json> [resumen.md]\n');
  process.exit(1);
}
