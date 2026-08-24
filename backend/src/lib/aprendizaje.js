import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buscarCoincidencia, normalizar as normalizarHuella } from './huella.js';
import { nombreCanonico } from './referencia.js';

/**
 * Registro de verificaciones del usuario.
 *
 * IMPORTANTE, y conviene no enganarse: Gemini no aprende de esto. Cada peticion parte
 * de cero. Lo que hacemos es acumular los aciertos y errores confirmados y volcarlos
 * en la instruccion de sistema, de modo que el modelo llegue avisado de las confusiones
 * que ya ha cometido con esta flora. No es entrenamiento; es memoria prestada.
 *
 * Cada verificacion guarda ademas la huella de la foto sobre la que se hizo. Sin ella el
 * aviso era generico ("el cedro ya se confundio con la teca") y el modelo no tenia forma
 * de saber que la imagen que estaba mirando era justo la que el usuario ya habia
 * corregido: podia cargar la misma foto diez veces y fallar las diez.
 *
 * OJO CON COMO SE INYECTA. Al principio este registro se volcaba como "era X y se dijo
 * Y", es decir, una lista de especies etiquetadas como la respuesta correcta. Con un
 * modelo que tiene sesgo de anclaje demostrado, eso funciona de cebo: el usuario corregia
 * una foto y en la siguiente le salia esa misma especie. Ahora se listan solo parejas, en
 * orden alfabetico, sin decir cual era la correcta.
 *
 * El disco de Render es efimero: al redesplegar se pierde. Por eso existe
 * GET /api/aprendizaje, que devuelve todo el registro para poder guardarlo en el
 * repositorio y que sobreviva.
 */
const CARPETA = fileURLToPath(new URL('../datos/aprendizaje/', import.meta.url));
const ARCHIVO = `${CARPETA}registro.json`;

/** Semilla versionada en el repositorio: lo aprendido que ya se decidio conservar. */
const SEMILLA = fileURLToPath(new URL('../datos/verificaciones.json', import.meta.url));

function leerArchivo(ruta) {
  try {
    return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : [];
  } catch {
    return [];
  }
}

/**
 * Registro completo: lo versionado mas lo acumulado desde el ultimo despliegue.
 *
 * Se quitan duplicados porque el respaldo automatico copia lo acumulado a la semilla:
 * entre ese respaldo y el siguiente redespliegue, la misma verificacion esta en los dos
 * sitios y contaria doble al medir que confusiones se repiten.
 */
function todas() {
  const vistas = new Set();
  return [...leerArchivo(SEMILLA), ...leerArchivo(ARCHIVO)].filter((r) => {
    const clave = `${r.fecha}|${r.dicho}|${r.real}`;
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

export function registrar(entrada) {
  const limpia = {
    fecha: new Date().toISOString(),
    acierto: Boolean(entrada.acierto),
    dicho: String(entrada.dicho ?? '').slice(0, 120),
    real: String(entrada.real ?? '').slice(0, 120),
    confianza: Number(entrada.confianza) || null,
    nota: String(entrada.nota ?? '').slice(0, 300) || null,
    // Huellas de la foto verificada. Se guarda lo que el usuario escribio, sin
    // normalizar: su palabra es el dato original y la ficha se busca al leer.
    sha256: /^[0-9a-f]{64}$/.test(String(entrada.sha256 ?? '')) ? entrada.sha256 : null,
    huella: normalizarHuella(entrada.huella),
  };

  if (!existsSync(CARPETA)) mkdirSync(dirname(ARCHIVO), { recursive: true });

  const acumuladas = leerArchivo(ARCHIVO);
  acumuladas.push(limpia);
  writeFileSync(ARCHIVO, JSON.stringify(acumuladas, null, 2));

  return limpia;
}

export function exportar() {
  const registro = todas();
  const aciertos = registro.filter((r) => r.acierto).length;
  return {
    total: registro.length,
    aciertos,
    fallos: registro.length - aciertos,
    acierto_pct: registro.length ? Math.round((aciertos / registro.length) * 100) : null,
    registro,
  };
}

/**
 * Que dijo el usuario sobre ESTA foto, si es que la vio antes.
 *
 * Solo devuelve verificaciones con especie real conocida: un acierto sin nombre o un
 * fallo sin correccion no dicen que es la pieza.
 */
export function verificacionDeImagen({ sha256, huella }) {
  const utiles = todas().filter((r) => (r.sha256 || r.huella) && String(r.real ?? '').trim());
  const coincidencia = buscarCoincidencia(utiles, { sha256, huella });
  if (!coincidencia) return null;

  return {
    especie: nombreCanonico(coincidencia.verificacion.real),
    fecha: coincidencia.verificacion.fecha,
    exacta: coincidencia.exacta,
    distancia: coincidencia.distancia,
  };
}

/**
 * Convierte los fallos confirmados en avisos para el prompt.
 *
 * Los nombres pasan por la clave de la guia: el usuario escribe "chingale" unas veces y
 * "Jacaranda copaia" otras, y sin unificarlos el mismo error se contaba como dos
 * distintos y ninguno llegaba a pesar.
 *
 * Solo entran las confusiones repetidas o recientes, y se limita el bloque: si creciera
 * sin control se comeria el presupuesto de tokens que necesita la clave de determinacion.
 */
export function notasDeCorreccion() {
  const registro = todas();
  const fallos = registro.filter((r) => !r.acierto && r.dicho && r.real);
  if (fallos.length === 0) return '';

  // Se listan PAREJAS, no respuestas. El orden dentro de cada pareja se fija alfabetico
  // a proposito, para que no se pueda leer cual era la correcta y cual el error.
  const pares = new Set();
  for (const f of fallos) {
    const a = nombreCanonico(f.real);
    const b = nombreCanonico(f.dicho);
    if (a && b && a !== b) pares.add([a, b].sort().join('  <->  '));
  }
  if (pares.size === 0) return '';

  const lineas = [...pares].slice(0, 12).map((p) => `- ${p}`);

  return `
=== PAREJAS QUE SE HAN CONFUNDIDO EN CAMPO ===
Estas parejas de especies se han confundido de verdad, sobre piezas reales de esta zona.
No se dice cual era la correcta en cada caso, y es deliberado: lo util aqui es saber que
esas dos se parecen lo bastante como para equivocarse, no cual salio en un caso concreto.

Si tu candidata aparece en alguna pareja, ve al PASO 5 de la clave y comprueba el caracter
que las separa antes de decidir. Si no puedes comprobarlo en esta foto, baja el nivel de
la respuesta en vez de elegir una de las dos.

${lineas.join('\n')}
=== FIN DE LAS PAREJAS ===
`.trim();
}
