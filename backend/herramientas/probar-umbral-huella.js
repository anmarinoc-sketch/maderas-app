// Mide si el umbral de la huella aguanta con FOTOS REALES de madera.
//
// La prueba original se hizo con ruido aleatorio y dio muchisimo margen: piezas
// distintas a 27 bits. Pero el ruido aleatorio no se parece a nada, y dos cortes de
// madera si se parecen entre si: mismo encuadre, misma luz, mismo patron de vetas
// verticales. Aqui se calcula la huella de las 29 laminas de la guia -29 especies
// DISTINTAS- y se miran todas las parejas. Cualquier pareja por debajo del umbral es
// un falso positivo: dos maderas distintas que el sistema daria por la misma pieza.
import jpeg from 'jpeg-js';
import fs from 'node:fs';
import path from 'node:path';

const carpeta = process.argv[2] || 'banco2';
const UMBRAL = Number(process.argv[3] || 8);

// Misma logica que Imagenes.kt: rejilla 9x8 en gris, comparar vecinos de cada fila.
function huellaDe(ruta) {
  const img = jpeg.decode(fs.readFileSync(ruta), { useTArray: true });
  const { width: W, height: H, data } = img;
  const gris = (x, y) => {
    const i = (y * W + x) * 4;
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  };
  // Escalado por promedio de bloque, que es lo que hace un filtro bilineal agresivo.
  const rej = [];
  for (let ry = 0; ry < 8; ry++) {
    for (let rx = 0; rx < 9; rx++) {
      const x0 = Math.floor((rx * W) / 9);
      const x1 = Math.max(x0 + 1, Math.floor(((rx + 1) * W) / 9));
      const y0 = Math.floor((ry * H) / 8);
      const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) * H) / 8));
      let s = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { s += gris(x, y); n++; }
      rej.push(s / n);
    }
  }
  let bits = 0n;
  let p = 0n;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      if (rej[y * 9 + x] > rej[y * 9 + x + 1]) bits |= 1n << p;
      p += 1n;
    }
  return bits.toString(16).padStart(16, '0');
}

const dist = (a, b) => {
  let n = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { n += x & 1; x >>= 1; }
  }
  return n;
};

const archivos = fs.readdirSync(carpeta).filter((f) => f.endsWith('.jpg'));
const huellas = archivos.map((f) => ({
  especie: f.split('__')[0],
  h: huellaDe(path.join(carpeta, f)),
}));

console.log(`laminas: ${huellas.length} (una por especie, todas DISTINTAS)`);
console.log(`umbral actual: ${UMBRAL} bits\n`);

const pares = [];
for (let i = 0; i < huellas.length; i++)
  for (let j = i + 1; j < huellas.length; j++)
    pares.push({ a: huellas[i].especie, b: huellas[j].especie, d: dist(huellas[i].h, huellas[j].h) });

pares.sort((x, y) => x.d - y.d);
const falsos = pares.filter((p) => p.d <= UMBRAL);

console.log(`parejas comparadas: ${pares.length}`);
console.log(`FALSOS POSITIVOS con umbral ${UMBRAL}: ${falsos.length}`);
if (falsos.length) {
  console.log('\nEspecies DISTINTAS que el sistema daria por la MISMA pieza:');
  falsos.forEach((p) => console.log(`  ${String(p.d).padStart(2)} bits   ${p.a}  =  ${p.b}`));
}

console.log('\nlas 8 parejas mas parecidas:');
pares.slice(0, 8).forEach((p) => console.log(`  ${String(p.d).padStart(2)} bits   ${p.a} / ${p.b}`));

const media = (pares.reduce((s, p) => s + p.d, 0) / pares.length).toFixed(1);
console.log(`\ndistancia media entre especies distintas: ${media} bits`);
console.log(`minima: ${pares[0].d} bits`);

console.log('\numbral seguro sugerido: por debajo de la minima observada');
for (const u of [4, 5, 6, 8, 10, 12]) {
  const n = pares.filter((p) => p.d <= u).length;
  console.log(`  umbral ${String(u).padStart(2)}: ${n} falsos positivos`);
}
