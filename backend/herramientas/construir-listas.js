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
  invasoras: 'https://ipt.biodiversidad.co/sib/archive.do?r=resolucion0067-2023invasoras-mads',
  avesEndemicas: 'http://ipt.biodiversidad.co/iavh/archive.do?r=biota_v14_n2_09',

  // Fauna de Colombia, por grupos. Sin esto la app conocia 407 aves de las casi 2.000
  // del pais: buscar una lora comun no devolvia nada.
  aves: 'https://ipt.biodiversidad.co/sib/archive.do?r=aco_listaavescolombia2017',
  mamiferos: 'https://ipt.biodiversidad.co/sib/archive.do?r=mamiferos_col',
  peces: 'https://ipt.biodiversidad.co/sib/archive.do?r=ictiofauna_colombiana_dulceacuicola',
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
  if (/^(Aceptado|V.lido|Accepted)$/i.test(t.taxonomicStatus ?? '')) puntos += 4;
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

/* -------------------------------------------------------------------- invasoras */

/**
 * Especies exoticas DECLARADAS INVASORAS por el Estado colombiano.
 *
 * No es lo mismo que el analisis de riesgo del Humboldt, y la diferencia tiene
 * consecuencias. El Humboldt dice que una planta PODRIA invadir: es un pronostico
 * tecnico. La Resolucion 0067 de 2023, que modifica el articulo 1 de la 848 de 2008,
 * dice que el pais YA la declaro invasora, con obligacion de prevenir, manejar y
 * controlar. Una opina y la otra manda.
 *
 * Son 26 nombres —25 especies y un genero—, de los que seis son flora. Ahi esta la
 * Paulownia tomentosa, que se ha vendido en Colombia como madera de crecimiento rapido y
 * desde 2023 esta declarada invasora: exactamente lo que alguien del sector necesita
 * saber ANTES de plantar. Y ahi esta tambien el hipopotamo.
 *
 * La resolucion nombra varias especies por sinonimos ya superados (Eichornia crassipes,
 * Teline monspessulana, Achatina fulica). El archivo del SiB los conserva en
 * `taxonRemarks`, y aqui se indexan TAMBIEN por ese nombre: quien busca lo que dice el
 * papel tiene que encontrarlo.
 */
async function construirInvasoras() {
  const archivos = await descargar('Resolucion 0067 de 2023, invasoras', FUENTES.invasoras);
  const taxones = leerTsv(archivos.get('taxon.txt'));

  const especies = {};
  for (const t of taxones) {
    const k = claveDeRegistro(t);
    if (!k) continue;

    // "Nombre original en la resolucion: Eichornia crassipes (sinonimo). Nombre aceptado: ..."
    // Se corta en el primer punto o parentesis, que es donde acaba el nombre.
    const enLaNorma = /Nombre original en la resoluci.n:\s*([^.(]+)/i.exec(t.taxonRemarks ?? '');
    const comoLaLlamaLaNorma = enLaNorma?.[1]?.trim();

    const entrada = limpio({
      nombre: t.scientificName,
      familia: t.family,
      reino: t.kingdom,
      clase: t.class,
      comun: t.vernacularName,
      rango: t.taxonRank,
      nombre_en_la_norma: comoLaLlamaLaNorma,
    });

    especies[k] = entrada;

    const kNorma = clave(comoLaLlamaLaNorma);
    if (kNorma && kNorma !== k) especies[kNorma] = entrada;
  }

  return {
    norma: 'Resolucion 0067 de 2023',
    autoridad: 'Ministerio de Ambiente y Desarrollo Sostenible',
    modifica: 'Articulo 1 de la Resolucion 848 de 2008',
    efecto:
      'Declarada especie exotica invasora en Colombia. La declaratoria obliga a prevenir ' +
      'su propagacion y a manejarla y controlarla, y restringe su introduccion y ' +
      'movilizacion. Antes de plantarla, moverla o comercializarla, consulta a la ' +
      'autoridad ambiental.',
    fuente: 'Lista de especies exoticas declaradas como invasoras en Colombia (MADS), publicada en el SiB',
    url: 'https://ipt.biodiversidad.co/sib/resource?r=resolucion0067-2023invasoras-mads',
    especies,
  };
}

/* -------------------------------------------------------------- aves endemicas */

/**
 * Aves endemicas y casi-endemicas de Colombia.
 *
 * Hace falta porque el Catalogo de Plantas, que es de donde sale el endemismo de todo
 * lo demas, solo cubre flora. Sin esta lista la app decia "el endemismo no consta" del
 * pauji colombiano (Crax alberti), que es endemico y ademas uno de los casos mas
 * conocidos del pais. Quedar mudo ante un dato asi hace dudar de todo lo demas.
 *
 * Cubre aves y nada mas. Mamiferos, reptiles y anfibios siguen sin fuente de endemismo.
 */
async function construirAvesEndemicas() {
  const archivos = await descargar('Aves endemicas de Colombia', FUENTES.avesEndemicas);
  const taxones = leerTsv(archivos.get('taxon.txt'));
  const descripciones = leerTsv(archivos.get('description.txt'));
  const vernaculos = leerTsv(archivos.get('vernacularname.txt'));
  const distribucion = leerTsv(archivos.get('distribution.txt'));

  // Solo interesan las dos categorias reales; el resto del campo son citas bibliograficas.
  const CATEGORIAS = new Map([
    ['endemica', 'Endémica'],
    ['casi endemica', 'Casi endémica'],
  ]);

  const categoriaPorId = new Map();
  for (const d of descripciones) {
    const cat = CATEGORIAS.get(sinTildes(d.description).trim());
    if (cat) categoriaPorId.set(d.id, cat);
  }

  const comunesPorId = new Map();
  for (const v of vernaculos) {
    if (v.language && v.language.toUpperCase() !== 'ES') continue;
    const lista = comunesPorId.get(v.id) ?? [];
    if (v.vernacularName) lista.push(v.vernacularName);
    comunesPorId.set(v.id, lista);
  }

  const dondePorId = new Map(distribucion.map((d) => [d.id, d.occurrenceRemarks || d.locality]));

  const especies = {};
  for (const t of taxones) {
    const categoria = categoriaPorId.get(t.id);
    if (!categoria) continue;

    const k = claveDeRegistro(t);
    if (!k) continue;

    especies[k] = limpio({
      nombre: t.scientificName,
      categoria,
      familia: t.family,
      orden: t.order,
      comunes: unir(comunesPorId.get(t.id) ?? []),
      donde: (dondePorId.get(t.id) ?? '').slice(0, 400),
    });
  }

  return {
    fuente: 'Listado actualizado de las aves endemicas y casi-endemicas de Colombia (Instituto Humboldt, Biota Colombiana)',
    licencia: 'CC BY-NC 4.0',
    nota: 'Solo aves. Endemica = solo vive en Colombia. Casi endemica = su distribucion desborda poco las fronteras.',
    especies,
  };
}

/* ----------------------------------------------------------------------- fauna */

/**
 * Fauna de Colombia: aves, mamiferos y peces de agua dulce.
 *
 * Hasta que existio este archivo, la app conocia 407 aves de las casi 2.000 del pais
 * -solo las amenazadas y las endemicas- y ni un mamifero que no estuviera amenazado.
 * Buscar "lora" no devolvia el ave sino unas cuantas Passiflora, porque el filtro de
 * "esto existe en Colombia" no reconocia a Amazona ochrocephala y la descartaba.
 *
 * Los tres archivos tienen forma distinta: las aves traen el nombre comun dentro de
 * taxon.txt y en ingles, los mamiferos lo traen aparte y en espanol, y los peces no lo
 * traen. Por eso la lectura es generica y todo lo que falte se omite.
 */
async function construirFauna() {
  const grupos = [
    { clave: 'aves', nombre: 'Aves', url: FUENTES.aves },
    { clave: 'mamiferos', nombre: 'Mamiferos', url: FUENTES.mamiferos },
    { clave: 'peces', nombre: 'Peces de agua dulce', url: FUENTES.peces },
  ];

  const especies = {};

  for (const grupo of grupos) {
    const archivos = await descargar(`${grupo.nombre} de Colombia`, grupo.url);
    const taxones = leerTsv(archivos.get('taxon.txt'));

    const dist = archivos.has('distribution.txt')
      ? new Map(leerTsv(archivos.get('distribution.txt')).map((d) => [d.id, d]))
      : new Map();

    // Los mamiferos traen los nombres comunes en su propio archivo, y varios por especie.
    const comunesPorId = new Map();
    if (archivos.has('vernacularname.txt')) {
      for (const v of leerTsv(archivos.get('vernacularname.txt'))) {
        if (v.language && !/^es/i.test(v.language)) continue;
        const lista = comunesPorId.get(v.id) ?? [];
        if (v.vernacularName) lista.push(v.vernacularName);
        comunesPorId.set(v.id, lista);
      }
    }

    for (const t of taxones) {
      const k = claveDeRegistro(t);
      if (!k) continue;

      const d = dist.get(t.id) ?? {};
      const origen = d.establishmentMeans ?? '';

      const entrada = limpio({
        nombre: t.scientificName,
        grupo: grupo.clave,
        clase: t.class,
        orden: t.order,
        familia: t.family,
        comunes: unir([...(comunesPorId.get(t.id) ?? []), t.vernacularName]),
        // En una lista nacional, lo que no esta marcado como exotico es de aqui.
        origen: origen || 'Nativa',
        endemica: /End[eé]mica/i.test(origen) || undefined,
        departamentos: d.locality || undefined,
        amenaza_lista: d.threatStatus || undefined,
        cites: d.appendixCITES || undefined,
      });

      // Si ya estaba por otro grupo, gana el registro con mas datos.
      const previa = especies[k];
      if (!previa || Object.keys(entrada).length > Object.keys(previa).length) {
        especies[k] = entrada;
      }
    }
  }

  return {
    fuente:
      'Lista de referencia de especies de aves de Colombia (ACO), Mamiferos de Colombia y ' +
      'Lista de peces de agua dulce de Colombia, publicadas por SiB Colombia',
    licencia: 'CC BY 4.0',
    nota:
      'Aves, mamiferos y peces de agua dulce. Reptiles, anfibios e invertebrados NO estan ' +
      'cubiertos: para esos, la app recurre a GBIF en caliente.',
    especies,
  };
}

/* --------------------------------------------------------------- herpetofauna */

/**
 * Reptiles y anfibios de Colombia, deducidos de los registros de GBIF.
 *
 * No hay lista nacional publicada de estos dos grupos: en GBIF solo existen listados
 * departamentales y de reservas. Y el hueco importaba, porque Colombia es el segundo
 * pais del mundo en anfibios y la app no reconocia ni la iguana ni la mapana ni las
 * ranas venenosas: sin estar en ninguna lista, el filtro de "esto existe en Colombia"
 * las descartaba y ni siquiera aparecian al buscar por nombre comun.
 *
 * Asi que la lista se arma con lo que hay: las especies con registros verificados EN
 * Colombia. NO es un catalogo oficial y no se presenta como tal; es un indice de "esto
 * se ha encontrado aqui", que es justo lo que hace falta para no descartar una especie
 * real. Los datos de conservacion siguen saliendo de la Resolucion 0126 de 2024.
 *
 * GBIF ya no agrupa los reptiles bajo una sola clase: Squamata, Testudines y Crocodylia
 * van por separado, y buscar por "Reptilia" devuelve cero.
 */
const CLASES_HERPETO = [
  { clave: 131, nombre: 'Amphibia' },
  { clave: 11592253, nombre: 'Squamata' },
  { clave: 11418114, nombre: 'Testudines' },
  { clave: 11493978, nombre: 'Crocodylia' },
];

/** Lanza las peticiones de a poco: GBIF es generoso, pero no hay que abusar. */
async function enTandas(elementos, tanda, tarea) {
  const salida = [];
  for (let i = 0; i < elementos.length; i += tanda) {
    salida.push(...(await Promise.all(elementos.slice(i, i + tanda).map(tarea))));
    process.stdout.write(`\r  resolviendo nombres... ${Math.min(i + tanda, elementos.length)}/${elementos.length}`);
  }
  console.log('');
  return salida;
}

async function construirHerpetofauna() {
  const claves = new Set();

  for (const clase of CLASES_HERPETO) {
    const url =
      'https://api.gbif.org/v1/occurrence/search?country=CO&limit=0&facetMincount=1' +
      `&taxonKey=${clase.clave}&facet=speciesKey&facetLimit=2000`;
    const respuesta = await fetch(url);
    const datos = await respuesta.json();
    const cuentas = datos?.facets?.[0]?.counts ?? [];
    cuentas.forEach((c) => claves.add(c.name));
    console.log(`  ${clase.nombre.padEnd(12)} ${cuentas.length} especies con registros en Colombia`);
  }

  const fichas = await enTandas([...claves], 12, async (clave) => {
    try {
      const r = await fetch(`https://api.gbif.org/v1/species/${clave}`);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  });

  const especies = {};
  for (const t of fichas) {
    if (!t?.species || t.rank !== 'SPECIES') continue;
    const k = clave(t.species);
    if (!k) continue;
    especies[k] = limpio({
      nombre: t.species,
      grupo: 'herpetofauna',
      clase: t.class,
      orden: t.order,
      familia: t.family,
    });
  }

  return {
    fuente: 'GBIF: especies de anfibios y reptiles con registros verificados en Colombia',
    nota:
      'NO es un catalogo oficial: no existe lista nacional publicada de estos grupos. Es un ' +
      'indice de especies registradas en el pais, para no descartar una especie real. Los ' +
      'datos de amenaza siguen saliendo de la Resolucion 0126 de 2024.',
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

/**
 * Listas que se pueden regenerar sueltas:
 *   node herramientas/construir-listas.js invasoras
 *
 * Sirve para anadir o corregir una sin bajar el Catalogo entero, que son 44.000 especies
 * y varios minutos, y sobre todo para que el diff del commit enseñe solo lo que se toco.
 *
 * Solo estan las que no alimentan a ninguna otra. El Catalogo, las amenazadas, las aves
 * y la fauna NO pueden ir aqui: de ellas sale el indice de nombres comunes, y regenerar
 * una sin rehacer el indice lo dejaria descuadrado sin que nada avisara.
 */
const SUELTAS = {
  invasoras: {
    archivo: 'invasoras-colombia.json',
    descripcion: 'Res. 0067 de 2023',
    construir: construirInvasoras,
  },
};

async function principal() {
  mkdirSync(DESTINO, { recursive: true });

  const solo = process.argv[2];
  if (solo) {
    const lista = SUELTAS[solo];
    if (!lista) {
      throw new Error(
        `No se puede construir "${solo}" por separado. Sueltas: ${Object.keys(SUELTAS).join(', ')}`
      );
    }
    console.log(`\nConstruyendo solo ${solo}\n`);
    escribir(lista.archivo, await lista.construir(), lista.descripcion);
    console.log('');
    return;
  }

  console.log('\nConstruyendo las listas oficiales de BioScan\n');

  const amenazadas = await construirAmenazadas();
  const catalogo = await construirCatalogo();
  const exoticas = await construirExoticas();
  const invasoras = await construirInvasoras();
  const aves = await construirAvesEndemicas();
  const fauna = await construirFauna();
  const herpeto = await construirHerpetofauna();
  const comunes = construirNombresComunes(amenazadas, aves, fauna);

  console.log('');
  escribir('amenazadas-colombia.json', amenazadas, 'Res. 0126 de 2024');
  escribir('flora-colombia.json', catalogo, 'origen, endemismo, distribucion, CITES');
  escribir('exoticas-colombia.json', exoticas, 'plantas no nativas');
  escribir('invasoras-colombia.json', invasoras, 'Res. 0067 de 2023');
  escribir('aves-endemicas-colombia.json', aves, 'endemismo de aves');
  escribir('fauna-colombia.json', fauna, 'aves, mamiferos y peces');
  escribir('herpetofauna-colombia.json', herpeto, 'reptiles y anfibios, via GBIF');
  escribir('nombres-comunes.json', comunes, 'nombre comun -> cientifico');

  const endemicas = Object.values(catalogo.especies).filter((e) => e.endemica).length;
  console.log(`\n  De control: ${endemicas.toLocaleString('es-CO')} especies endemicas de Colombia.`);
  console.log('  Revisa el diff antes de subir: un cambio de norma se ve ahi.\n');
}

principal().catch((error) => {
  console.error(`\n  Fallo: ${error.message}\n`);
  process.exit(1);
});
