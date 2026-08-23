/**
 * Construye las listas oficiales que consulta el backend de BioScan.
 *
 * Por que existe este archivo: los datos legales y de conservacion NO se le preguntan
 * al modelo. Gemini no tiene base de datos; si le preguntas si una especie esta vedada
 * redacta la respuesta mas plausible y se inventa el numero de resolucion. Aqui se
 * descargan las fuentes oficiales y se destilan a JSON, y el modelo solo se usa para
 * mirar la foto y redactar lo que no es normativo.
 *
 * Ejecutar a mano cuando cambie alguna norma:
 *     node herramientas/construir-listas.js
 *
 * Fuentes (todas publicas, descarga directa, sin clave):
 *   - Resolucion 0126 de 2024 (MADS), que derogo la 1912 de 2017. Categorias CR/EN/VU
 *     de flora y fauna. Publicada por SiB Colombia. CC0.
 *   - Catalogo de Plantas y Liquenes de Colombia (Bernal, Gradstein & Celis). Origen
 *     nativa/endemica, departamentos, altitud, region biogeografica, CITES. CC BY.
 *   - Lista de plantas exoticas y trasplantadas de Colombia (Humboldt). CC BY-NC.
 *
 * Las vedas NO salen de aqui: no existe ninguna fuente legible por maquina. Estan
 * transcritas a mano en src/datos/vedas-colombia.json, con su norma citada.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { leerTsv, leerZip } from './zip.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, '..', 'src', 'datos');

const FUENTES = {
  amenazadas: 'https://ipt.biodiversidad.co/sib/archive.do?r=especies-amenazadas-mads-2024',
  catalogo: 'https://ipt.biodiversidad.co/sib/archive.do?r=catalogo_plantas_liquenes',
  exoticas: 'https://ipt.biodiversidad.co/iavh/archive.do?r=ls_colombia_plantaeexoticas_2021',
};

/**
 * Clave de busqueda de un nombre cientifico escrito por una persona.
 *
 * Unifica lo que el usuario teclea con lo que dicen las listas: quita tildes, autoria
 * ("Bonpl.", "(Andre) Rehder"), la equis de los hibridos y la puntuacion. Sin esto,
 * "Quercus humboldtii Bonpl." y "quercus humboldtii" serian dos especies distintas.
 *
 * Las tildes se quitan con \p{Diacritic} y no con un rango de caracteres. En este
 * proyecto ya se colo una vez un rango de diacriticos como bytes literales dentro de
 * un regex: funcionaba, pero el fuente quedaba intocable. Nada de aqui debe salirse
 * del ASCII.
 */
export function sinTildes(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function clave(nombre) {
  const palabras = sinTildes(nombre)
    .replace(/[^a-z\s.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // La autoria queda como palabras abreviadas con punto ("bonpl.", "f."): fuera.
    // "sp." se conserva porque es parte del nombre cuando solo se llega al genero.
    .filter((p) => p === 'sp.' || !p.endsWith('.'))
    // La equis suelta de los hibridos ("Abelia x grandiflora") no es parte del nombre.
    .filter((p) => p !== 'x');

  return palabras.slice(0, 2).join(' ');
}

/**
 * Clave de un registro Darwin Core, a partir de las columnas estructuradas.
 *
 * Se usan genus y specificEpithet en vez de partir scientificName porque el nombre
 * completo lleva autoria y rango intercalados ("Quercus humboldtii var. foo Bonpl.")
 * y partirlo a ojo acaba mezclando variedades con su especie.
 */
function claveDeRegistro(t) {
  const genero = clave(t.genus);
  const epiteto = clave(t.specificEpithet);
  if (!genero) return null;
  return epiteto ? `${genero} ${epiteto}` : genero;
}

/**
 * Cuanto vale un registro frente a otro que caiga en la misma clave.
 *
 * En una misma especie conviven la especie aceptada, sus variedades y sus sinonimos.
 * Queremos que mande la especie aceptada, no la ultima variedad que aparezca en el
 * archivo, que es lo que pasaria dejando que se sobrescriban sin mas.
 */
function calidad(t) {
  let puntos = 0;
  if (/^Aceptado$/i.test(t.taxonomicStatus ?? '')) puntos += 4;
  if (/^Especie$/i.test(t.taxonRank ?? '')) puntos += 2;
  if (!t.infraspecificEpithet) puntos += 1;
  return puntos;
}

async function descargar(nombre, url) {
  process.stdout.write(`  descargando ${nombre}... `);
  const respuesta = await fetch(url, { redirect: 'follow' });
  if (!respuesta.ok) throw new Error(`${nombre}: HTTP ${respuesta.status}`);
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  console.log(`${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
  return leerZip(bytes);
}

/** Une varios valores descartando vacios y repetidos. */
function unir(valores) {
  return [...new Set(valores.filter(Boolean))].join(' | ');
}

/** Quita las claves con valor vacio para no engordar el JSON con nulos. */
function limpio(objeto) {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, v]) => v !== undefined && v !== '' && v !== false)
  );
}

function escribir(archivo, datos, descripcion) {
  const texto = JSON.stringify(datos);
  writeFileSync(join(DESTINO, archivo), texto + '\n');
  const entradas = Object.keys(datos.especies ?? datos).length;
  console.log(
    `  ${archivo.padEnd(28)} ${String(entradas.toLocaleString('es-CO')).padStart(7)} entradas  ` +
      `${(texto.length / 1024 / 1024).toFixed(2)} MB  (${descripcion})`
  );
}

/**
 * Recorre los taxones quedandose con el mejor registro por clave.
 * @param {(t: object) => object} construir  arma la entrada final del registro ganador.
 */
function indexar(taxones, construir) {
  const mejores = new Map();
  for (const t of taxones) {
    const k = claveDeRegistro(t);
    if (!k) continue;
    const anterior = mejores.get(k);
    if (!anterior || calidad(t) > calidad(anterior)) mejores.set(k, t);
  }

  const especies = {};
  for (const [k, t] of mejores) especies[k] = limpio(construir(t));
  return especies;
}

/* ------------------------------------------------------------------ amenazadas */

/** De menos a mas grave. Se usa para no perder la peor categoria de un grupo. */
const GRAVEDAD = { VU: 1, EN: 2, CR: 3 };

async function construirAmenazadas() {
  const archivos = await descargar('Resolucion 0126 de 2024', FUENTES.amenazadas);
  const taxones = leerTsv(archivos.get('taxon.txt'));
  const distribucion = leerTsv(archivos.get('distribution.txt'));

  const categoriaPorId = new Map(distribucion.map((d) => [d.id, d.threatStatus]));

  /**
   * La resolucion categoriza a veces la ESPECIE y a veces cada SUBESPECIE, y no siempre
   * con la misma categoria. La danta (Tapirus terrestris) figura como VU, pero su
   * subespecie colombiana esta en CR; Salvia sphacelioides tiene cuatro subespecies, de
   * VU a CR. Indexando por especie y quedandose con un registro cualquiera, la app
   * acababa diciendo VU de algo que en Colombia esta en peligro critico.
   *
   * Asi que la categoria de la especie es LA PEOR de su grupo, y el desglose se guarda
   * aparte para poder enseñarlo. Subestimar el riesgo es el error que mas daño hace en
   * esta app.
   */
  const grupos = new Map();
  for (const t of taxones) {
    const k = claveDeRegistro(t);
    if (!k) continue;
    const grupo = grupos.get(k) ?? [];
    grupo.push(t);
    grupos.set(k, grupo);
  }

  const especies = {};
  for (const [k, grupo] of grupos) {
    const cabeza = grupo.reduce((a, b) => (calidad(b) > calidad(a) ? b : a));

    const categorias = grupo.map((t) => categoriaPorId.get(t.id)).filter(Boolean);
    const peor = categorias.reduce(
      (a, b) => ((GRAVEDAD[b] ?? 0) > (GRAVEDAD[a] ?? 0) ? b : a),
      categorias[0]
    );

    // Solo interesa el desglose cuando aporta algo: varios registros que no coinciden.
    const desglose =
      new Set(categorias).size > 1
        ? grupo
            .map((t) => ({ nombre: t.scientificName, categoria: categoriaPorId.get(t.id) }))
            .filter((x) => x.categoria)
        : undefined;

    especies[k] = limpio({
      nombre: cabeza.scientificName,
      categoria: peor,
      reino: cabeza.kingdom,
      clase: cabeza.class,
      familia: cabeza.family,
      comunes: cabeza.vernacularName,
      desglose,
    });
  }

  return {
    norma: 'Resolucion 0126 de 2024',
    autoridad: 'Ministerio de Ambiente y Desarrollo Sostenible',
    nota: 'Derogo la Resolucion 1912 de 2017. Categorias CR (en peligro critico), EN (en peligro) y VU (vulnerable).',
    fuente: 'https://www.gbif.org/dataset/09174029-d182-442c-a12f-8013aee328d7',
    especies,
  };
}

/* -------------------------------------------------------------------- catalogo */

async function construirCatalogo() {
  const archivos = await descargar('Catalogo de Plantas y Liquenes', FUENTES.catalogo);
  const taxones = leerTsv(archivos.get('taxon.txt'));
  const distribucion = leerTsv(archivos.get('distribution.txt'));
  const descripciones = leerTsv(archivos.get('description.txt'));

  const distPorId = new Map(distribucion.map((d) => [d.id, d]));

  // description.txt trae tres hechos por especie, cada uno en su propia fila.
  const extrasPorId = new Map();
  for (const d of descripciones) {
    const extra = extrasPorId.get(d.id) ?? {};
    if (/altitudinal/i.test(d.type)) extra.altitud = d.description;
    else if (/biogeogr/i.test(d.type)) extra.regiones = d.description;
    else if (/global/i.test(d.type)) extra.global = d.description;
    extrasPorId.set(d.id, extra);
  }

  const especies = indexar(taxones, (t) => {
    const dist = distPorId.get(t.id) ?? {};
    const extra = extrasPorId.get(t.id) ?? {};
    const origen = dist.establishmentMeans ?? '';

    return {
      nombre: t.scientificName,
      autoria: t.scientificNameAuthorship,
      familia: t.family,
      reino: t.kingdom,
      // Hace falta para las vedas que cubren grupos enteros: la Resolucion 0213 de 1977
      // veda "musgos", que en el Catalogo son tres phyla distintos.
      phylum: t.phylum,
      origen,
      endemica: sinTildes(origen).includes('endemica') || undefined,
      departamentos: dist.locality === 'Desconocido' ? undefined : dist.locality,
      altitud: extra.altitud,
      regiones: extra.regiones,
      global: extra.global,
      cites: dist.appendixCITES,
      amenaza_catalogo: dist.threatStatus,
    };
  });

  return {
    fuente:
      'Bernal, R., S.R. Gradstein & M. Celis (eds.). Catalogo de plantas y liquenes de Colombia',
    url: 'https://catalogoplantasdecolombia.unal.edu.co',
    licencia: 'CC BY 4.0',
    nota: 'Solo flora y liquenes. La fauna NO esta cubierta por esta lista.',
    especies,
  };
}

/* -------------------------------------------------------------------- exoticas */

async function construirExoticas() {
  const archivos = await descargar('Plantas exoticas de Colombia', FUENTES.exoticas);
  const taxones = leerTsv(archivos.get('taxon.txt'));
  const descripciones = leerTsv(archivos.get('description.txt'));

  const porId = new Map();
  for (const d of descripciones) {
    const extra = porId.get(d.id) ?? { estatus: [], origen: [], invasividad: [] };
    if (/Estatus/i.test(d.type)) extra.estatus.push(d.description);
    else if (/^Origen/i.test(d.type)) extra.origen.push(d.description);
    else if (/Invasividad|Potencial de establecimiento/i.test(d.type)) {
      extra.invasividad.push(d.description);
    }
    porId.set(d.id, extra);
  }

  const especies = indexar(taxones, (t) => {
    const extra = porId.get(t.id) ?? { estatus: [], origen: [], invasividad: [] };
    return {
      nombre: t.scientificName,
      familia: t.family,
      estatus: unir(extra.estatus),
      origen: unir(extra.origen),
      invasividad: unir(extra.invasividad),
    };
  });

  return {
    fuente: 'Lista de especies de plantas exoticas y trasplantadas de Colombia (Instituto Humboldt)',
    licencia: 'CC BY-NC 4.0',
    nota: 'Estar en esta lista significa que la especie NO es nativa de Colombia.',
    especies,
  };
}

/* ------------------------------------------------------------- nombres comunes */

/**
 * Indice de nombre comun -> claves cientificas.
 *
 * Es lo que permite escribir "roble" en vez de "Quercus humboldtii". Un mismo nombre
 * comun designa especies distintas segun la region (el "cedro" de aqui no es el cedro
 * del Libano), asi que el valor es una lista y la app tiene que hacer elegir.
 */
function construirNombresComunes(...listas) {
  const indice = {};

  for (const lista of listas) {
    for (const [k, especie] of Object.entries(lista.especies)) {
      if (!especie.comunes) continue;
      for (const bruto of especie.comunes.split(/[|,;]/)) {
        const comun = clave(bruto);
        if (!comun || comun.length < 3) continue;
        indice[comun] ??= [];
        if (!indice[comun].includes(k)) indice[comun].push(k);
      }
    }
  }

  return indice;
}

/* ------------------------------------------------------------------------ main */

async function principal() {
  mkdirSync(DESTINO, { recursive: true });
  console.log('\nConstruyendo las listas oficiales de BioScan\n');

  const amenazadas = await construirAmenazadas();
  const catalogo = await construirCatalogo();
  const exoticas = await construirExoticas();
  const comunes = construirNombresComunes(amenazadas);

  console.log('');
  escribir('amenazadas-colombia.json', amenazadas, 'Res. 0126 de 2024');
  escribir('flora-colombia.json', catalogo, 'origen, endemismo, distribucion, CITES');
  escribir('exoticas-colombia.json', exoticas, 'plantas no nativas');
  escribir('nombres-comunes.json', comunes, 'nombre comun -> cientifico');

  const endemicas = Object.values(catalogo.especies).filter((e) => e.endemica).length;
  console.log(`\n  De control: ${endemicas.toLocaleString('es-CO')} especies endemicas de Colombia.`);
  console.log('  Revisa el diff antes de subir: un cambio de norma se ve ahi.\n');
}

principal().catch((error) => {
  console.error(`\n  Fallo: ${error.message}\n`);
  process.exit(1);
});
