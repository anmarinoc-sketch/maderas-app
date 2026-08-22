import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Registro de verificaciones del usuario.
 *
 * IMPORTANTE, y conviene no enganarse: Gemini no aprende de esto. Cada peticion parte
 * de cero. Lo que hacemos es acumular los aciertos y errores confirmados y volcarlos
 * en la instruccion de sistema, de modo que el modelo llegue avisado de las confusiones
 * que ya ha cometido con esta flora. No es entrenamiento; es memoria prestada.
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
 * Convierte los fallos confirmados en avisos para el prompt.
 *
 * Solo entran las confusiones repetidas o recientes, y se limita el bloque: si creciera
 * sin control se comeria el presupuesto de tokens que necesita la clave de determinacion.
 */
export function notasDeCorreccion() {
  const fallos = todas().filter((r) => !r.acierto && r.dicho && r.real);
  if (fallos.length === 0) return '';

  const cuenta = new Map();
  for (const f of fallos) {
    const clave = `${f.real}|${f.dicho}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }

  const lineas = [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([clave, veces]) => {
      const [real, dicho] = clave.split('|');
      return `- ${real}: ya se confundio con ${dicho}${veces > 1 ? ` (${veces} veces)` : ''}.`;
    });

  const aciertos = todas().filter((r) => r.acierto && r.real).length;

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
