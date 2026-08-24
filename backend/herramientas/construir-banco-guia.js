// USO: node herramientas/construir-banco-guia.js <guia.pdf> <carpeta-destino>
// Requiere: npm i pdfjs-dist   (no es dependencia del backend, solo de esta herramienta)
// El PDF de la guia es el del usuario: no se versiona, esta en su Escritorio.
// Banco de pruebas de la guia de la UNAL, esta vez emparejado por numero de objeto.
//
// El intento anterior repartio las laminas por orden de aparicion y salio mal: las
// paginas referencian mas imagenes de las que se extraen, y el desfase corre la
// asignacion. Aqui se lee de cada pagina su diccionario /Resources /XObject, que dice
// exactamente que objetos usa, y se cruza con los objetos JPEG del archivo.
//
// La comprobacion de que el mapeo es correcto no es que el programa no falle: es que
// las dos coniferas de la guia (pino patula y cipres) salgan SIN POROS. Si una lamina
// etiquetada como conifera tiene poros, el mapeo esta corrido.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const archivo = process.argv[2];
const destino = process.argv[3] || 'banco2';
const buf = fs.readFileSync(archivo);
const crudo = buf.toString('latin1');
if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });

// ---------- 1. Objetos JPEG, indexados por su numero de objeto ----------
const imagenes = new Map();
{
  let i = 0;
  while (true) {
    const ini = buf.indexOf('stream', i);
    if (ini < 0) break;
    const cab = buf.subarray(Math.max(0, ini - 900), ini).toString('latin1');
    let s = ini + 6;
    if (buf[s] === 13) s++;
    if (buf[s] === 10) s++;
    const fin = buf.indexOf('endstream', s);
    if (fin < 0) break;

    if (/DCTDecode/.test(cab)) {
      const datos = buf.subarray(s, fin);
      if (datos[0] === 0xff && datos[1] === 0xd8) {
        const objs = [...cab.matchAll(/(\d+)\s+0\s+obj/g)];
        const numero = objs.length ? Number(objs[objs.length - 1][1]) : null;
        const ancho = Number((cab.match(/\/Width\s+(\d+)/) || [])[1] || 0);
        const alto = Number((cab.match(/\/Height\s+(\d+)/) || [])[1] || 0);
        if (numero !== null) imagenes.set(numero, { datos, ancho, alto });
      }
    }
    i = fin + 9;
  }
}

// ---------- 2. Cuerpo de cada objeto, para poder resolver referencias ----------
function cuerpoDe(numero) {
  const re = new RegExp(`(?:^|[^0-9])${numero}\\s+0\\s+obj([\\s\\S]{0,4000}?)endobj`);
  const m = crudo.match(re);
  return m ? m[1] : null;
}

// ---------- 3. Paginas en orden, con los objetos de imagen que usa cada una ----------
const paginas = [];
for (const m of crudo.matchAll(/(\d+)\s+0\s+obj([\s\S]{0,3000}?)endobj/g)) {
  const cuerpo = m[2];
  if (!/\/Type\s*\/Page[^s]/.test(cuerpo)) continue;

  // /Resources puede ir en linea o como referencia a otro objeto.
  let recursos = cuerpo;
  const ref = cuerpo.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (ref) recursos = cuerpoDe(Number(ref[1])) ?? '';

  // Lo mismo con /XObject.
  let xobj = recursos;
  const refX = recursos.match(/\/XObject\s+(\d+)\s+0\s+R/);
  if (refX) xobj = cuerpoDe(Number(refX[1])) ?? '';

  const zona = xobj.match(/\/XObject\s*<<([\s\S]*?)>>/);
  const usados = zona
    ? [...zona[1].matchAll(/\/\w+\s+(\d+)\s+0\s+R/g)].map((x) => Number(x[1]))
    : [];

  paginas.push({ objeto: Number(m[1]), usados });
}

console.log(`objetos de pagina hallados: ${paginas.length}`);
console.log(`objetos JPEG hallados: ${imagenes.size}`);

// ---------- 4. Especie de cada pagina, con pdf.js ----------
const doc = await getDocument({
  data: new Uint8Array(buf),
  useSystemFonts: true,
  standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/',
}).promise;

const fichas = new Map();
for (let n = 1; n <= doc.numPages; n += 1) {
  const pagina = await doc.getPage(n);
  const items = (await pagina.getTextContent()).items;
  const texto = items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
  const m = texto.match(/Nombre bot[aá]nico:\s*([A-Z][a-z]+\s+[a-z-]+)/);
  if (!m) continue;
  const antes = texto.slice(0, texto.indexOf('Nombre bot'));
  const comun = ((antes.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,30})\s*$/) || [])[1] || '')
    .replace(/\s+/g, ' ')
    .trim();
  fichas.set(n, { especie: m[1], comun });
}

// ---------- 5. Cruce ----------
const mapa = [];
let sinLamina = 0;
for (const [numeroPagina, ficha] of fichas) {
  const pagina = paginas[numeroPagina - 1];
  if (!pagina) continue;

  const laminas = pagina.usados
    .map((o) => ({ o, img: imagenes.get(o) }))
    .filter((x) => x.img && x.img.ancho >= 400 && x.img.alto >= 400);

  if (laminas.length === 0) {
    sinLamina += 1;
    continue;
  }

  const slug = ficha.especie.toLowerCase().replace(/[^a-z]+/g, '-');
  laminas.forEach((l, k) => {
    const nombre = `${slug}__${k + 1}__obj${l.o}_${l.img.ancho}x${l.img.alto}.jpg`;
    fs.writeFileSync(path.join(destino, nombre), l.img.datos);
    mapa.push({
      archivo: nombre,
      especie: ficha.especie,
      comun: ficha.comun,
      pagina: numeroPagina,
      objeto: l.o,
    });
  });
}

fs.writeFileSync(path.join(destino, 'mapa.json'), JSON.stringify(mapa, null, 2));
console.log(`\nlaminas escritas: ${mapa.length}`);
console.log(`especies con lamina: ${new Set(mapa.map((m) => m.especie)).size}`);
console.log(`fichas sin lamina: ${sinLamina}`);
console.log('\n--- las coniferas, que deben salir SIN POROS ---');
mapa.filter((m) => /pinus|cupressus/i.test(m.especie)).forEach((m) => console.log('  ' + m.archivo));
