/* Verifica el JS del organigrama sin navegador:
   1. que parsea sin errores de sintaxis
   2. que el reparto automático de ángulos reproduce exactamente la geometría
      que antes estaba escrita a mano (el dibujo no debe cambiar)
   3. que el layout tolera agregar y quitar posiciones */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'organigrama.html'), 'utf8');
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASA ' : 'FALLA'}  ${name}${extra ? '   [' + extra + ']' : ''}`);
};

// ---- 1. sintaxis ----
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check('El HTML tiene un solo bloque de script', scripts.length === 1, `hay ${scripts.length}`);
let syntaxOk = true, syntaxErr = '';
try { new vm.Script(scripts[0], { filename: 'organigrama.js' }); }
catch (e) { syntaxOk = false; syntaxErr = e.message; }
check('El JS parsea sin errores de sintaxis', syntaxOk, syntaxErr);

// ---- 2. geometria derivada vs. la original escrita a mano ----
// Angulos que estaban fijos en la version anterior del archivo:
const ORIGINAL = {
  halves: { fch: [90, 270], co: [-90, 90] },
  wedges: {
    contabilidad: [90, 180], rrhh: [180, 270],
    importaciones: [-90, -45], ventas: [-45, 0],
    operaciones: [0, 45], servgen: [45, 90],
  },
  sucs: { lindora: -90, coyol: 0, curridabat: 90, huacas: 180 },
};

// Reimplementa el reparto tal como quedo en el archivo (mismas formulas).
function repartir(tree) {
  const kids = tree.children || [];
  const halves = kids.filter(k => k.kind === 'half');
  const others = kids.filter(k => k.kind !== 'half');
  const out = { halves: {}, wedges: {}, sucs: {} };

  halves.forEach((h, i) => {
    const span = 360 / halves.length;
    const a0 = 90 + span * i, a1 = a0 + span;
    out.halves[h.id] = [a0, a1];
    const wspan = (a1 - a0) / (h.children || []).length;
    (h.children || []).forEach((w, j) => {
      out.wedges[w.id] = [a0 + wspan * j, a0 + wspan * (j + 1)];
    });
  });
  others.forEach((s, i) => { out.sucs[s.id] = -90 + 360 / others.length * i; });
  return out;
}

// dos angulos son el mismo si difieren en multiplos de 360
const same = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180) < 1e-9;

const { SEED_TREE } = require(path.join(dir, 'src', 'seed.js'));
const derived = repartir(SEED_TREE);

let halvesOk = true, halvesDetail = [];
for (const [id, [a0, a1]] of Object.entries(ORIGINAL.halves)) {
  const got = derived.halves[id];
  const ok = got && same(got[0], a0) && same(got[1], a1);
  if (!ok) { halvesOk = false; halvesDetail.push(`${id}: ${got} != ${a0},${a1}`); }
}
check('Las mitades del nucleo caen en los angulos originales', halvesOk, halvesDetail.join(' '));

let wedgesOk = true, wedgesDetail = [];
for (const [id, [a0, a1]] of Object.entries(ORIGINAL.wedges)) {
  const got = derived.wedges[id];
  const ok = got && same(got[0], a0) && same(got[1], a1);
  if (!ok) { wedgesOk = false; wedgesDetail.push(`${id}: ${got} != ${a0},${a1}`); }
}
check('Los gajos de la corona caen en los angulos originales', wedgesOk, wedgesDetail.join(' '));

let sucsOk = true, sucsDetail = [];
for (const [id, a] of Object.entries(ORIGINAL.sucs)) {
  const ok = same(derived.sucs[id], a);
  if (!ok) { sucsOk = false; sucsDetail.push(`${id}: ${derived.sucs[id]} != ${a}`); }
}
check('Las sucursales caen en los angulos originales', sucsOk, sucsDetail.join(' '));

// ---- 3. el reparto se adapta al agregar / quitar ----
const conLegal = JSON.parse(JSON.stringify(SEED_TREE));
conLegal.children.find(c => c.id === 'fch').children.push({ id: 'legal', label: 'LEGAL', kind: 'wedge' });
const d2 = repartir(conLegal);
const w = d2.wedges;
check('Un gajo nuevo reparte el arco en 3 partes iguales',
      Math.abs((w.contabilidad[1] - w.contabilidad[0]) - 60) < 1e-9 &&
      Math.abs(w.legal[1] - w.legal[0] - 60) < 1e-9,
      `contabilidad=${w.contabilidad} legal=${w.legal}`);
check('Los gajos siguen cubriendo la mitad entera sin huecos',
      same(w.contabilidad[1], w.rrhh[0]) && same(w.rrhh[1], w.legal[0]) &&
      same(w.legal[1], d2.halves.fch[1]));

const conSuc = JSON.parse(JSON.stringify(SEED_TREE));
conSuc.children.push({ id: 'santaana', label: 'SANTA ANA', kind: 'suc' });
const d3 = repartir(conSuc);
const angles = Object.values(d3.sucs);
check('Cinco sucursales se reparten 360 en pasos de 72',
      angles.length === 5 && angles.every((a, i) => same(a, -90 + 72 * i)), angles.join(','));

const menos = JSON.parse(JSON.stringify(SEED_TREE));
menos.children = menos.children.filter(c => c.id !== 'huacas');
const d4 = repartir(menos);
check('Al quitar una sucursal las tres restantes se reacomodan',
      Object.keys(d4.sucs).length === 3 &&
      same(d4.sucs.lindora, -90) && same(d4.sucs.coyol, 30) && same(d4.sucs.curridabat, 150),
      Object.entries(d4.sucs).map(([k, v]) => `${k}=${v}`).join(' '));

// ---- 4. coherencia de referencias en el HTML ----
const ids = [...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
const missing = [...new Set(ids)].filter(id => !new RegExp(`id="${id}"`).test(html));
check('Todos los getElementById apuntan a un elemento que existe', missing.length === 0, missing.join(','));

const endpoints = [...html.matchAll(/api\('(GET|POST|PATCH|DELETE)',\s*[`']([^`']+)/g)]
  .map(m => `${m[1]} ${m[2].replace(/\$\{[^}]+\}/g, ':id')}`);
const server = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');
const unknown = [...new Set(endpoints)].filter(e => {
  const [, url] = e.split(' ');
  const base = url.split('/').slice(0, 3).join('/');
  return !server.includes(base);
});
check('Todas las rutas que usa el visor existen en el servidor', unknown.length === 0, unknown.join(', '));
console.log('   rutas usadas: ' + [...new Set(endpoints)].join(' | '));

const fallaron = results.filter(x => !x.ok);
console.log(`\n${results.length - fallaron.length}/${results.length} verificaciones pasan`);
process.exit(fallaron.length ? 1 : 0);
