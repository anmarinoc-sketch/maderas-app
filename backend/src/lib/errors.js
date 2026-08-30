/** Error de dominio con codigo estable para que la app Android lo interprete. */
export class AppError extends Error {
  constructor(status, codigo, mensaje, detalle) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

export const errores = {
  sinImagen: () =>
    new AppError(
      400,
      'SIN_IMAGEN',
      'No se recibio ninguna imagen. Envia el campo "imagen" (multipart/form-data) o "imagen_base64" (JSON).'
    ),
  imagenInvalida: (detalle) =>
    new AppError(400, 'IMAGEN_INVALIDA', 'El archivo recibido no es una imagen valida.', detalle),
  formatoNoSoportado: (mime, permitidos) =>
    new AppError(
      415,
      'FORMATO_NO_SOPORTADO',
      `Formato de imagen no soportado${mime ? `: ${mime}` : ''}.`,
      `Formatos aceptados: ${permitidos.join(', ')}.`
    ),
  imagenMuyGrande: (maxBytes) =>
    new AppError(
      413,
      'IMAGEN_MUY_GRANDE',
      `La imagen supera el limite de ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`,
      'Reduce la resolucion o la calidad de compresion antes de enviarla.'
    ),
  datosIncompletos: (detalle) =>
    new AppError(400, 'DATOS_INCOMPLETOS', 'Faltan datos en la peticion.', detalle),
  noAutorizado: () =>
    new AppError(401, 'NO_AUTORIZADO', 'Cabecera X-App-Key ausente o incorrecta.'),
  demasiadasSolicitudes: (segundos) =>
    new AppError(
      429,
      'DEMASIADAS_SOLICITUDES',
      'Has superado el limite de peticiones de este servidor.',
      `Vuelve a intentarlo en ${segundos} s.`
    ),
};
