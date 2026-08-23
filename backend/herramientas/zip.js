import { inflateRawSync } from 'node:zlib';

/**
 * Lector minimo de ZIP, suficiente para los archivos Darwin Core de SiB Colombia.
 *
 * Node no trae ningun lector de ZIP y no merece la pena añadir una dependencia al
 * backend por una herramienta que se ejecuta a mano cada varios meses. Los archivos
 * de SiB usan solo los dos metodos estandar (almacenado y deflate), asi que con leer
 * el directorio central basta.
 *
 * @param {Buffer} zip
 * @returns {Map<string, Buffer>} nombre de archivo -> contenido descomprimido
 */
export function leerZip(zip) {
  const fin = localizarFinDelDirectorio(zip);
  const total = zip.readUInt16LE(fin + 10);
  let cursor = zip.readUInt32LE(fin + 16);

  const archivos = new Map();

  for (let i = 0; i < total; i += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`Entrada ${i} del directorio central corrupta.`);
    }

    const metodo = zip.readUInt16LE(cursor + 10);
    const comprimido = zip.readUInt32LE(cursor + 20);
    const nombreLargo = zip.readUInt16LE(cursor + 28);
    const extraLargo = zip.readUInt16LE(cursor + 30);
    const comentarioLargo = zip.readUInt16LE(cursor + 32);
    const desplazamiento = zip.readUInt32LE(cursor + 42);
    const nombre = zip.subarray(cursor + 46, cursor + 46 + nombreLargo).toString('utf8');

    // La cabecera local repite los tamaños de nombre y extra, y NO tienen por que
    // coincidir con los del directorio central: hay que releerlos de ahi.
    if (zip.readUInt32LE(desplazamiento) !== 0x04034b50) {
      throw new Error(`Cabecera local de ${nombre} corrupta.`);
    }
    const inicio =
      desplazamiento +
      30 +
      zip.readUInt16LE(desplazamiento + 26) +
      zip.readUInt16LE(desplazamiento + 28);

    const datos = zip.subarray(inicio, inicio + comprimido);
    if (!nombre.endsWith('/')) {
      archivos.set(nombre, metodo === 0 ? Buffer.from(datos) : inflateRawSync(datos));
    }

    cursor += 46 + nombreLargo + extraLargo + comentarioLargo;
  }

  return archivos;
}

/** El fin del directorio central esta al final, tras un comentario de longitud variable. */
function localizarFinDelDirectorio(zip) {
  const minimo = Math.max(0, zip.length - 65_557);
  for (let i = zip.length - 22; i >= minimo; i -= 1) {
    if (zip.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('No parece un ZIP: falta el fin del directorio central.');
}

/**
 * Convierte un archivo de texto Darwin Core (TSV con cabecera) en objetos.
 * Los archivos de SiB no usan comillas de escape, asi que partir por tabulador basta.
 */
export function leerTsv(buffer) {
  const lineas = buffer.toString('utf8').split(/\r?\n/);
  const cabecera = lineas[0].split('\t');

  const filas = [];
  for (let i = 1; i < lineas.length; i += 1) {
    if (!lineas[i]) continue;
    const celdas = lineas[i].split('\t');
    const fila = {};
    for (let c = 0; c < cabecera.length; c += 1) fila[cabecera[c]] = celdas[c] ?? '';
    filas.push(fila);
  }
  return filas;
}
