// Comprobacion barata antes de gastar una vuelta de CI: llaves y parentesis balanceados.
//
// El orden importa. Quitando primero los comentarios de linea, una URL dentro de una
// cadena ("https://...") se parte en el "//" y deja la comilla sin cerrar, y a partir de
// ahi el recuento es basura: daba por rotos archivos que compilaban perfectamente.
// Primero las cadenas, luego los comentarios.
const fs = require('fs');

const archivos = process.argv.slice(2);
let mal = 0;

for (const f of archivos) {
  const s = fs
    .readFileSync(f, 'utf8')
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  let llaves = 0;
  let parentesis = 0;
  for (const c of s) {
    if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    else if (c === '(') parentesis += 1;
    else if (c === ')') parentesis -= 1;
  }

  const ok = llaves === 0 && parentesis === 0;
  if (!ok) mal += 1;
  console.log(
    `${f.split(/[\\/]/).pop().padEnd(22)} llaves: ${String(llaves).padStart(3)}  ` +
      `parentesis: ${String(parentesis).padStart(3)}  ${ok ? 'OK' : 'DESBALANCEADO'}`
  );
}

process.exit(mal ? 1 : 0);
