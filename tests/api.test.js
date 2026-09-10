/* Prueba de humo de la API del organigrama: levanta el servidor en un puerto
   aparte con una base descartable, corre el ciclo completo y lo apaga. */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const dir = process.argv[2] || path.join(__dirname, '..');
const dbPath = path.join(dir, 'data', 'test-api.db');
[dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(f => { try { fs.unlinkSync(f); } catch {} });

const { SEED_TREE } = require(path.join(dir, 'src', 'seed.js'));

// Valores esperados calculados desde la semilla, no escritos a mano.
const expected = (function () {
  let nodes = 0;
  const totalOf = n => {
    nodes++;
    return (n.headcount ?? 0) + (n.children || []).reduce((a, k) => a + totalOf(k), 0);
  };
  const total = totalOf(SEED_TREE);
  const byId = {};
  (function walk(n) { byId[n.id] = n; (n.children || []).forEach(walk); })(SEED_TREE);
  const sub = id => {
    const t = n => (n.headcount ?? 0) + (n.children || []).reduce((a, k) => a + t(k), 0);
    return t(byId[id]);
  };
  return { nodes, total, sub };
})();

const PORT = 3987;
const base = `http://localhost:${PORT}`;
let srv;

function start() {
  srv = spawn(process.execPath, [path.join(dir, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ORG_DB: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  return waitUp();
}
async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { await fetch(base + '/api/config'); return; } catch { await new Promise(r => setTimeout(r, 120)); }
  }
  throw new Error('el servidor no levanto');
}
async function stop(p) { p.kill(); await new Promise(r => p.on('exit', r)); }

const call = async (method, url, body, headers = {}) => {
  const r = await fetch(base + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json() };
};
const find = (n, id) => (n.id === id ? n : (n.children || []).reduce((a, k) => a || find(k, id), null));

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASA ' : 'FALLA'}  ${name}${extra ? '   [' + extra + ']' : ''}`);
};

(async () => {
  await start();

  let { json } = await call('GET', '/api/tree');
  const tree = json.tree;
  check('El arbol se siembra solo al arrancar', tree && tree.id === 'center');

  let count = 0; (function w(n) { count++; (n.children || []).forEach(w); })(tree);
  check('Se sembraron todos los nodos', count === expected.nodes, `${count} de ${expected.nodes}`);

  // --- conteos ---
  const linBod = find(tree, 'lin-bod');
  check('Departamento suma a sus puestos', linBod.total === expected.sub('lin-bod'), `total=${linBod.total}`);
  check('Departamento no tiene gente propia', linBod.own === 0 && !linBod.isManual);

  const imp1 = find(tree, 'imp1');
  check('Jefatura cuenta su puesto MAS sus subordinados', imp1.total === 2 && imp1.own === 1,
        `own=${imp1.own} total=${imp1.total}`);

  check('Sucursal suma a sus departamentos', find(tree, 'lindora').total === expected.sub('lindora'),
        `total=${find(tree, 'lindora').total}`);
  check('La raiz da el total de la empresa', tree.total === expected.total, `total=${tree.total}`);

  // --- alta ---
  let r = await call('POST', '/api/nodes', { parentId: 'lin-bod', label: 'Ayudante\nde Bodega', headcount: 4 });
  check('Crear posicion responde 201', r.status === 201, `status=${r.status}`);
  const nuevoId = r.json.node.id;
  check('El id generado es legible', nuevoId === 'lin-bod.ayudante-de-bodega', nuevoId);
  check('Hereda el color del departamento', r.json.node.color === '#5fa85f', r.json.node.color);

  let t = r.json.tree;
  check('El total del departamento sube solo', find(t, 'lin-bod').total === expected.sub('lin-bod') + 4);
  check('El total sube hasta la sucursal', find(t, 'lindora').total === expected.sub('lindora') + 4);
  check('El total sube hasta la raiz', t.total === expected.total + 4, `total=${t.total}`);

  r = await call('POST', '/api/nodes', { parentId: 'lin-bod', label: 'Ayudante de Bodega' });
  check('Un nombre repetido no pisa el id anterior', r.json.node.id === 'lin-bod.ayudante-de-bodega-2', r.json.node.id);
  const dupId = r.json.node.id;
  check('Sin cantidad, el puesto arranca en cero', find(r.json.tree, dupId).total === 0);

  // --- edicion del numerito ---
  r = await call('PATCH', `/api/nodes/${nuevoId}`, { headcount: 9 });
  check('Editar la cantidad del puesto', find(r.json.tree, nuevoId).total === 9);
  check('El padre recalcula al instante', find(r.json.tree, 'lin-bod').total === expected.sub('lin-bod') + 9);

  r = await call('PATCH', '/api/nodes/lin-bod', { total_override: 30 });
  let lb = find(r.json.tree, 'lin-bod');
  check('Fijar el total a mano pisa al calculado', lb.total === 30 && lb.isManual, `total=${lb.total}`);
  check('El calculo sigue disponible aparte', lb.autoTotal === expected.sub('lin-bod') + 9, `auto=${lb.autoTotal}`);
  check('El total fijado es el que sube al padre', find(r.json.tree, 'lindora').total ===
        expected.sub('lindora') - expected.sub('lin-bod') + 30);

  r = await call('PATCH', '/api/nodes/lin-bod', { total_override: null });
  lb = find(r.json.tree, 'lin-bod');
  check('Volver al calculo automatico', lb.total === expected.sub('lin-bod') + 9 && !lb.isManual);

  r = await call('PATCH', `/api/nodes/${nuevoId}`, { label: 'Ayudante\nGeneral' });
  check('Renombrar un puesto', find(r.json.tree, nuevoId).label === 'Ayudante\nGeneral');

  r = await call('PATCH', `/api/nodes/${nuevoId}`, { label: '   ' });
  check('Rechaza un nombre vacio', r.status === 400, `status=${r.status}`);

  r = await call('PATCH', `/api/nodes/${nuevoId}`, { headcount: -5 });
  check('Una cantidad negativa se limita a cero', find(r.json.tree, nuevoId).own === 0);
  await call('PATCH', `/api/nodes/${nuevoId}`, { headcount: 9 });

  // --- orden ---
  const antes = find((await call('GET', '/api/tree')).json.tree, 'lin-bod').children.map(c => c.id);
  r = await call('POST', `/api/nodes/${nuevoId}/move`, { delta: -1 });
  const despues = find(r.json.tree, 'lin-bod').children.map(c => c.id);
  check('Reordenar entre hermanos', antes.indexOf(nuevoId) - 1 === despues.indexOf(nuevoId),
        `${antes.indexOf(nuevoId)} -> ${despues.indexOf(nuevoId)}`);

  // --- baja en cascada ---
  await call('POST', '/api/nodes', { parentId: nuevoId, label: 'Sub puesto', headcount: 2 });
  r = await call('DELETE', `/api/nodes/${nuevoId}`);
  check('Borrar arrastra a los subordinados',
        find(r.json.tree, nuevoId) === null && !JSON.stringify(r.json.tree).includes('Sub puesto'));

  await call('DELETE', `/api/nodes/${dupId}`);
  r = await call('GET', '/api/tree');
  check('El total vuelve al original tras borrar', r.json.tree.total === expected.total, `total=${r.json.tree.total}`);

  r = await call('DELETE', '/api/nodes/center');
  check('No deja borrar la raiz', r.status === 400, `status=${r.status}`);

  r = await call('PATCH', '/api/nodes/no-existe', { label: 'x' });
  check('Editar un id inexistente da 404', r.status === 404, `status=${r.status}`);

  // --- el color no puede transportar HTML ---
  // La hoja de impresion se arma con innerHTML, asi que un color con comillas
  // seria XSS almacenado para todo el que abra el organigrama.
  r = await call('PATCH', '/api/nodes/lin-bod', { color: '" onload="alert(1)' });
  check('Rechaza un color con comillas', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/nodes/lin-bod', { color: 'red; background:url(javascript:0)' });
  check('Rechaza un color que no sea hexadecimal', r.status === 400, `status=${r.status}`);
  r = await call('POST', '/api/nodes', { parentId: 'lin-bod', label: 'X', color: '<script>' });
  check('Tampoco al crear una posicion', r.status === 400, `status=${r.status}`);
  r = await call('PATCH', '/api/nodes/lin-bod', { color: '#5fa85f' });
  check('Un hexadecimal valido si se acepta', r.status === 200 && find(r.json.tree, 'lin-bod').color === '#5fa85f');

  // --- geometria derivada ---
  r = await call('POST', '/api/nodes', { parentId: 'fch', label: 'LEGAL' });
  check('Un departamento nuevo en el nucleo nace como gajo', r.json.node.kind === 'wedge', r.json.node.kind);
  await call('DELETE', `/api/nodes/${r.json.node.id}`);

  r = await call('POST', '/api/nodes', { parentId: 'center', label: 'SANTA ANA', kind: 'suc', sub: 'Administrador' });
  check('Se puede agregar una sucursal nueva', r.json.node.kind === 'suc');
  await call('DELETE', `/api/nodes/${r.json.node.id}`);

  // --- resumen ---
  r = await call('GET', '/api/summary');
  check('Resumen de dotacion', r.json.total === expected.total && r.json.breakdown.length === 6,
        r.json.breakdown.map(b => `${b.label}=${b.total}`).join(' '));

  // --- persistencia real entre reinicios ---
  r = await call('POST', '/api/nodes', { parentId: 'hua-ven', label: 'Prueba persistencia', headcount: 5 });
  const persistId = r.json.node.id;
  await stop(srv);
  await start();

  r = await call('GET', '/api/tree');
  const sobrevivio = find(r.json.tree, persistId);
  check('Los datos sobreviven al reinicio del servidor', sobrevivio && sobrevivio.total === 5);
  check('No se re-siembra encima de datos existentes', r.json.tree.total === expected.total + 5,
        `total=${r.json.tree.total}`);

  r = await call('POST', '/api/reset');
  check('Reset vuelve a la estructura original',
        r.json.tree.total === expected.total && find(r.json.tree, persistId) === null);

  // --- export / import ---
  const exported = (await call('GET', '/api/export')).json;
  await call('POST', '/api/nodes', { parentId: 'hua-con', label: 'Temporal', headcount: 3 });
  r = await call('POST', '/api/import', { tree: exported.tree });
  check('Importar restaura el arbol exportado',
        r.json.tree.total === expected.total && !JSON.stringify(r.json.tree).includes('Temporal'));

  await stop(srv);

  // --- clave de edicion ---
  srv = spawn(process.execPath, [path.join(dir, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ORG_DB: dbPath, ORG_EDIT_KEY: 'secreta' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitUp();

  r = await call('GET', '/api/tree');
  check('Con clave activa, ver sigue siendo libre', r.status === 200);
  r = await call('POST', '/api/nodes', { parentId: 'hua-con', label: 'Intruso' });
  check('Sin la clave, no deja editar', r.status === 401, `status=${r.status}`);
  r = await call('POST', '/api/nodes', { parentId: 'hua-con', label: 'Autorizado' }, { 'X-Edit-Key': 'secreta' });
  check('Con la clave correcta, edita', r.status === 201, `status=${r.status}`);
  r = await call('GET', '/api/config');
  check('El visor puede saber si hace falta clave', r.json.requiresKey === true);

  await stop(srv);

  const fallaron = results.filter(x => !x.ok);
  console.log(`\n${results.length - fallaron.length}/${results.length} pruebas pasan`);
  if (fallaron.length) console.log('Fallaron: ' + fallaron.map(f => f.name).join(' | '));
  process.exit(fallaron.length ? 1 : 0);
})().catch(async e => {
  console.error('ERROR EN LA PRUEBA:', e);
  try { await stop(srv); } catch {}
  process.exit(1);
});
