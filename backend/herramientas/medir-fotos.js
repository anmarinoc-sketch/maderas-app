/**
 * Mide cuanto acierta la identificacion por foto.
 *
 * Es la comprobacion mas importante que le queda al proyecto y la que mas cuesta hacer,
 * porque exige fotos de especies conocidas. Esto automatiza la version barata: baja una
 * foto de Wikipedia por cada especie del banco, la pasa por el endpoint real y compara
 * con la especie verdadera.
 *
 *     node herramientas/medir-fotos.js
 *     node herramientas/medir-fotos.js https://otro-servidor
 *
 * OJO CON LO QUE MIDE. Las fotos de Wikipedia son FACILES: bien encuadradas, con buena
 * luz y tomadas por alguien que sabia que estaba fotografiando y enseño lo que habia que
 * enseñar. El resultado es el techo, no lo que se ve en campo. En la primera medicion
 * (24-08-2026) salieron 5 especies exactas y 1 genero de 6 fotos, sin fallos.
 *
 * Cuesta una consulta de Gemini por foto, de las ~160 diarias.
 *
 * Para medir de verdad hacen falta fotos del usuario, de cosas que el sepa que son. Para
 * eso, dejar los archivos en una carpeta y cambiar `cargarBanco` por una lectura de disco.
 */
import { writeFileSync } from 'node:fs';

const SERVIDOR = process.argv[2] ?? 'https://madera-backend.onrender.com';

/** Especies colombianas conocidas, repartidas entre grupos y dificultades. */
const BANCO = [
  { real: 'Quercus humboldtii', grupo: 'flora' },
  { real: 'Cecropia peltata', grupo: 'flora' },
  { real: 'Cattleya trianae', grupo: 'flora' },
  { real: 'Ceroxylon quindiuense', grupo: 'flora' },
  { real: 'Cedrela odorata', grupo: 'flora' },
  { real: 'Tabebuia rosea', grupo: 'flora' },
  { real: 'Tremarctos ornatus', grupo: 'fauna' },
  { real: 'Tapirus terrestris', grupo: 'fauna' },
  { real: 'Bradypus variegatus', grupo: 'fauna' },
  { real: 'Crax alberti', grupo: 'fauna' },
  { real: 'Amazona ochrocephala', grupo: 'fauna' },
  { real: 'Bothrops asper', grupo: 'fauna' },
];

const AGENTE = 'BioScan-medicion/1.0 (https://github.com/anmarinoc-sketch/maderas-app)';

/** Foto de Wikipedia por nombre cientifico, primero en espanol y luego en ingles. */
async function fotoDe(especie) {
  for (const idioma of ['es', 'en']) {
    const url = new URL(`https://${idioma}.wikipedia.org/w/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('prop', 'pageimages');
    url.searchParams.set('piprop', 'thumbnail');
    url.searchParams.set('pithumbsize', '900');
    url.searchParams.set('redirects', '1');
    url.searchParams.set('titles', especie);

    const r = await fetch(url, { headers: { 'User-Agent': AGENTE } });
    if (!r.ok) continue;

    const j = await r.json();
    const fuente = Object.values(j?.query?.pages ?? {}).find((p) => p?.thumbnail?.source);
    if (!fuente) continue;

    // Wikimedia rechaza los User-Agent genericos: sin uno propio responde 403.
    const img = await fetch(fuente.thumbnail.source, { headers: { 'User-Agent': AGENTE } });
    if (!img.ok) continue;

    const bytes = Buffer.from(await img.arrayBuffer());
    if (bytes.length > 20 * 1024) return bytes;
  }
  return null;
}

const genero = (n) => String(n ?? '').trim().split(/\s+/)[0].toLowerCase();
const empiezaPor = (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase());

async function principal() {
  console.log(`\nMidiendo contra ${SERVIDOR}\n`);
  const filas = [];

  for (const caso of BANCO) {
    const bytes = await fotoDe(caso.real);
    if (!bytes) {
      console.log(`${caso.real.padEnd(26)} sin foto en Wikipedia, se salta`);
      continue;
    }

    const form = new FormData();
    form.append('imagen', new Blob([bytes], { type: 'image/jpeg' }), 'foto.jpg');

    let j;
    try {
      const r = await fetch(`${SERVIDOR}/api/identificar-especie`, { method: 'POST', body: form });
      j = await r.json();
    } catch (error) {
      console.log(`${caso.real.padEnd(26)} fallo de red: ${error.message}`);
      continue;
    }

    if (!j.identificacion) {
      console.log(`${caso.real.padEnd(26)} ${j.error?.codigo}: ${j.error?.mensaje}`);
      continue;
    }

    const id = j.identificacion;
    const dicho = id.nombre_cientifico ?? '';
    const alternativas = (id.alternativas ?? []).map((a) => a.nombre_cientifico);

    const acierto = empiezaPor(dicho, caso.real)
      ? 'ESPECIE'
      : genero(dicho) === genero(caso.real)
        ? 'genero'
        : alternativas.some((a) => empiezaPor(a, caso.real))
          ? 'en alternativas'
          : 'FALLO';

    filas.push({ ...caso, dicho, confianza: id.confianza, nivel: id.nivel_alcanzado, acierto });
    console.log(`${caso.real.padEnd(26)} -> ${String(dicho).padEnd(26)} ${acierto}`);
  }

  writeFileSync('medicion.json', JSON.stringify(filas, null, 2) + '\n');

  const n = filas.length;
  const cuenta = (q) => filas.filter((f) => f.acierto === q).length;
  const media = (lista) =>
    lista.length ? (lista.reduce((a, b) => a + (b.confianza ?? 0), 0) / lista.length).toFixed(2) : '—';

  console.log(`\n===== ${n} fotos`);
  console.log(`  especie exacta : ${cuenta('ESPECIE')}`);
  console.log(`  solo genero    : ${cuenta('genero')}`);
  console.log(`  en alternativas: ${cuenta('en alternativas')}`);
  console.log(`  fallos         : ${cuenta('FALLO')}`);
  console.log(`  confianza al acertar: ${media(filas.filter((f) => f.acierto === 'ESPECIE'))}`);
  console.log(`  confianza al fallar : ${media(filas.filter((f) => f.acierto === 'FALLO'))}`);
  console.log('\n  Detalle en medicion.json. Recuerda: fotos de Wikipedia, o sea faciles.\n');
}

principal();
