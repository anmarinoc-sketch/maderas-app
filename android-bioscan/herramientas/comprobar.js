/**
 * Comprobaciones baratas antes de subir Kotlin.
 *
 * En este equipo NO se puede compilar Android: no hay JDK 17 ni SDK, y la unica forma de
 * saber si algo compila es subirlo y esperar a la CI, que tarda unos minutos. Estas dos
 * comprobaciones cazan los dos fallos que mas veces han costado una vuelta entera:
 * llaves sin cerrar e imports olvidados.
 *
 *     node herramientas/comprobar.js
 *
 * No sustituye al compilador y no lo pretende. Si pasa esto, todavia puede fallar por un
 * nombre de icono inexistente, un tipo mal puesto o una API que no existe en la version
 * de Compose. Pero si NO pasa esto, seguro que falla.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FUENTES = join(AQUI, '..', 'app', 'src', 'main', 'java');

/** Todos los .kt del modulo, recorriendo carpetas. */
function kotlin(carpeta) {
  const salida = [];
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...kotlin(ruta));
    else if (entrada.endsWith('.kt')) salida.push(ruta);
  }
  return salida;
}

const archivos = kotlin(FUENTES);
console.log(`Comprobando ${archivos.length} archivos Kotlin\n`);

let fallos = 0;

for (const comprobacion of ['balance.js', 'imports.js']) {
  console.log(`--- ${comprobacion}`);
  const r = spawnSync(process.execPath, [join(AQUI, comprobacion), ...archivos], {
    stdio: 'inherit',
  });
  if (r.status !== 0) fallos += 1;
  console.log('');
}

if (fallos) {
  console.error('Hay avisos. Revisa si son reales antes de subir.\n');
  process.exit(1);
}
console.log('Todo cuadra. Puede subirse.\n');
