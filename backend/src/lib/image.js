import { config } from '../config.js';
import { errores } from './errors.js';

/**
 * Detecta el tipo real de la imagen por sus magic bytes.
 * No confiamos en el Content-Type que declara el cliente: la app podria
 * enviar un JPEG etiquetado como PNG, o directamente un archivo que no es imagen.
 */
export function detectarMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  // HEIC/HEIF (comun en camaras Android/iOS): "....ftyp<marca>"
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const marca = buffer.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'heim', 'heis'].includes(marca)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(marca)) return 'image/heif';
  }

  return null;
}

/** Valida tamano + tipo real y devuelve { buffer, mimeType, bytes }. */
export function validarImagen(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw errores.imagenInvalida('El contenido recibido esta vacio.');
  }
  if (buffer.length > config.maxImageBytes) {
    throw errores.imagenMuyGrande(config.maxImageBytes);
  }

  const mimeType = detectarMime(buffer);
  if (!mimeType) {
    throw errores.imagenInvalida(
      'No se reconocio ninguna cabecera de imagen (JPEG, PNG, WEBP o HEIC/HEIF).'
    );
  }
  if (!config.mimesPermitidos.includes(mimeType)) {
    throw errores.formatoNoSoportado(mimeType, config.mimesPermitidos);
  }

  return { buffer, mimeType, bytes: buffer.length };
}

/** Acepta base64 puro o data URL (`data:image/jpeg;base64,....`). */
export function bufferDesdeBase64(entrada) {
  if (typeof entrada !== 'string' || entrada.trim() === '') {
    throw errores.imagenInvalida('El campo "imagen_base64" debe ser una cadena no vacia.');
  }

  const limpio = entrada.trim().replace(/^data:[^;,]+;base64,/, '').replace(/\s/g, '');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpio)) {
    throw errores.imagenInvalida('La cadena recibida no es base64 valido.');
  }

  // Corte temprano: evita decodificar payloads enormes en memoria.
  if ((limpio.length * 3) / 4 > config.maxImageBytes) {
    throw errores.imagenMuyGrande(config.maxImageBytes);
  }

  return Buffer.from(limpio, 'base64');
}
