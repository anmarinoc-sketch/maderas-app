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

  const cuenta = new Map();
  for (const f of fallos) {
    const clave = `${nombreCanonico(f.real)}|${nombreCanonico(f.dicho)}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  const lineas = [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([clave, veces]) => {
      const [real, dicho] = clave.split('|');
      return `- Era ${real} y se dijo ${dicho}${veces > 1 ? ` (${veces} veces)` : ''}.`;
    });

  const aciertos = registro.filter((r) => r.acierto && r.real).length;

  return `
=== ERRORES YA CONFIRMADOS POR EL USUARIO ===
Un profesional del sector verifico estas identificaciones sobre piezas reales de esta
misma zona. Son fallos comprobados, no hipotesis. Antes de decidir, comprueba si el caso
que tienes delante se parece a alguno y, si es asi, contrasta con especial cuidado los
caracteres que separan a esas dos especies.

${lineas.join('\n')}

(Verificaciones acumuladas: ${aciertos} aciertos y ${fallos.length} fallos.)
=== FIN DE LOS ERRORES CONFIRMADOS ===
`.trim();
}
