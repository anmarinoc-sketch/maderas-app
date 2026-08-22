import { createHash } from 'node:crypto';

/**
 * Huellas de imagen: como reconocer que dos fotos son la misma pieza.
 *
 * Hacen falta dos, porque cubren casos distintos:
 *
 *   - La EXACTA (sha256 de los bytes recibidos) la calcula este servidor. Solo casa si el
 *     archivo llega identico byte a byte, cosa que ocurre al reenviar la misma foto de la
 *     galeria: la app la prepara de forma determinista y produce siempre el mismo JPEG.
 *
 *   - La PERCEPTUAL (dHash de 64 bits) la calcula la app, que es quien tiene el bitmap ya
 *     decodificado; aqui no hay decodificador de JPEG ni conviene anadir uno nativo a un
 *     despliegue que funciona. Casa aunque cambien los bytes: recorte leve, recompresion,
 *     otra toma de la misma tabla desde casi el mismo punto.
 *
 * La perceptual es opcional: las versiones antiguas de la app no la mandan y todo sigue
 * funcionando, solo que reconociendo unicamente la copia exacta.
 */

/** Distancia de Hamming maxima para dar dos fotos por la misma pieza. */
export const UMBRAL = 8;

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Acepta la huella de la app solo si son 16 digitos hex (64 bits). */
export function normalizar(valor) {
  const limpia = String(valor ?? '').trim().toLowerCase();
  return /^[0-9a-f]{16}$/.test(limpia) ? limpia : null;
}

/** Bits distintos entre dos huellas de 64 bits. */
export function distancia(a, b) {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x || !y) return null;

  let bits = 0;
  for (let i = 0; i < 16; i += 1) {
    let nibble = parseInt(x[i], 16) ^ parseInt(y[i], 16);
    while (nibble) {
      bits += nibble & 1;
      nibble >>= 1;
    }
  }
  return bits;
}

/**
 * Busca en el registro la verificacion que corresponde a esta imagen.
 *
 * Prioridad: primero la coincidencia exacta, y entre las parecidas la mas cercana. A
 * igual distancia gana la mas reciente, que es la ultima palabra del usuario sobre la
 * pieza; si un dia se corrige a si mismo, vale la correccion nueva.
 */
export function buscarCoincidencia(registro, { sha256: exacta, huella }) {
  const perceptual = normalizar(huella);

  const porFecha = [...registro].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const exactaEncontrada = exacta && porFecha.find((r) => r.sha256 === exacta);
  if (exactaEncontrada) return { verificacion: exactaEncontrada, distancia: 0, exacta: true };

  if (!perceptual) return null;

  let mejor = null;
  for (const r of porFecha) {
    const d = distancia(perceptual, r.huella);
    if (d === null || d > UMBRAL) continue;
    if (!mejor || d < mejor.distancia) mejor = { verificacion: r, distancia: d, exacta: false };
  }
  return mejor;
}
