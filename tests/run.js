/* Corre las dos suites y resume el resultado. Uso: node tests/run.js */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const suites = [
  ['API y base de datos', 'api.test.js'],
  ['Visor y geometria', 'visor.test.js'],
];

let failed = 0;
for (const [nombre, archivo] of suites) {
  console.log(`\n=== ${nombre} ===`);
  const r = spawnSync(process.execPath, [path.join(__dirname, archivo)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

console.log(failed ? `\n${failed} suite(s) con fallas` : '\nTodo pasa');
process.exit(failed ? 1 : 0);
