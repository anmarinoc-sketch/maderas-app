// USO: node herramientas/evaluar-acierto.js <carpeta-del-banco>
// La carpeta debe traer el mapa.json que escribe construir-banco-guia.js.
// Gasta una peticion de cuota por lamina: 29 laminas son 29 de las ~160 diarias.
// Mide el acierto de XiloScan contra el banco de laminas de la guia de la UNAL.
//
// Se cuentan dos cosas por separado, que es como hay que leerlo:
//   - ACIERTO DE ESPECIE: dio el binomio correcto.
//   - ACIERTO DE GENERO: dio el genero correcto, aunque errara la especie.
// La distincion importa porque en 6 de las 34 fichas los propios anatomistas de la
// UNAL no pasaron del genero: ahi el genero ES la respuesta correcta.
import fs from 'node:fs';
import path from 'node:path';

const carpeta = process.argv[2] || 'banco2';
const URL = 'https://madera-backend.onrender.com/api/identificar-madera';
const mapa = JSON.parse(fs.readFileSync(path.join(carpeta, 'mapa.json'), 'utf8'));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const generoDe = (s) => String(s || '').trim().split(/\s+/)[0].toLowerCase();

const resultados = [];
console.log(`evaluando ${mapa.length} laminas contra ${URL}\n`);

for (const [i, caso] of mapa.entries()) {
  const form = new FormData();
  form.append(
    'imagen',
    new Blob([fs.readFileSync(path.join(carpeta, caso.archivo))], { type: 'image/jpeg' }),
    'corte.jpg'
  );

  let fila;
  try {
    const r = await fetch(URL, { method: 'POST', body: form });
    const j = await r.json();

    if (!j.ok) {
      fila = { ...caso, error: j.error?.codigo ?? `HTTP_${r.status}` };
      console.log(`${String(i + 1).padStart(2)}/${mapa.length}  ERROR  ${fila.error}  (${caso.comun})`);
    } else {
      const dicho = j.resultado?.nombre_cientifico ?? '';
      const especieOk = generoDe(dicho) === generoDe(caso.especie) &&
        dicho.toLowerCase().includes(caso.especie.split(' ')[1].toLowerCase());
      const generoOk = generoDe(dicho) === generoDe(caso.especie);

      fila = {
        ...caso,
        dicho,
        confianza: j.resultado?.confianza ?? null,
        origen: j.resultado?.origen_identificacion ?? null,
        calidad: j.resultado?.calidad_imagen ?? null,
        especieOk,
        generoOk,
        alternativas: (j.resultado?.alternativas ?? []).map((a) => a.nombre_cientifico),
      };

      const marca = especieOk ? 'ESPECIE' : generoOk ? 'genero ' : 'fallo  ';
      console.log(
        `${String(i + 1).padStart(2)}/${mapa.length}  ${marca}  ` +
          `esperado ${caso.especie.padEnd(28)} dijo ${String(dicho).slice(0, 34).padEnd(34)} ` +
          `conf ${fila.confianza}`
      );
    }
  } catch (e) {
    fila = { ...caso, error: String(e.message).slice(0, 80) };
    console.log(`${String(i + 1).padStart(2)}/${mapa.length}  EXCEPCION  ${fila.error}`);
  }

  resultados.push(fila);
  fs.writeFileSync(path.join(carpeta, 'resultados.json'), JSON.stringify(resultados, null, 2));

  // Un respiro entre peticiones: el limite por minuto se agota antes que el diario.
  if (i < mapa.length - 1) await dormir(4000);
}

const validos = resultados.filter((r) => !r.error);
const esp = validos.filter((r) => r.especieOk).length;
const gen = validos.filter((r) => r.generoOk).length;

console.log('\n================ RESUMEN ================');
console.log(`laminas evaluadas: ${validos.length} de ${mapa.length}`);
console.log(`errores de red o cuota: ${resultados.length - validos.length}`);
console.log(`ACIERTO DE ESPECIE: ${esp}/${validos.length}  (${Math.round((esp / validos.length) * 100)} %)`);
console.log(`ACIERTO DE GENERO:  ${gen}/${validos.length}  (${Math.round((gen / validos.length) * 100)} %)`);

const enAlternativas = validos.filter(
  (r) => !r.generoOk && r.alternativas.some((a) => generoDe(a) === generoDe(r.especie))
).length;
console.log(`fallo pero la acerto en las alternativas: ${enAlternativas}`);

console.log('\n--- los fallos ---');
validos.filter((r) => !r.generoOk).forEach((r) =>
  console.log(`  ${r.comun.padEnd(14)} ${r.especie.padEnd(26)} -> ${r.dicho}  (conf ${r.confianza})`)
);
