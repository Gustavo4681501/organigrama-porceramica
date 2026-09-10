/* Capa de acceso a datos — SQLite mediante el módulo nativo node:sqlite.
   Requiere Node 22.5+ (probado en Node 24). No hay dependencias de npm. */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { SEED_TREE } = require('./seed.js');

const DB_PATH = process.env.ORG_DB || path.join(__dirname, '..', 'data', 'organigrama.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

/* WAL permite que una lectura no bloquee a una escritura: con dos personas
   editando al mismo tiempo nadie ve un error de "database is locked". */
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS nodes (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    sub         TEXT,
    color       TEXT NOT NULL DEFAULT '#5b8fc7',
    kind        TEXT NOT NULL DEFAULT 'node',
    headcount   INTEGER,           -- personas en ESTE puesto (NULL = ninguna propia)
    total_override INTEGER,        -- fija el total mostrado; NULL = se calcula solo
    radius      REAL,              -- NULL = lo decide el visor según el nivel
    sort_order  INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id, sort_order);

  -- Respaldo del árbol completo antes de cada operación destructiva.
  CREATE TABLE IF NOT EXISTS snapshots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    reason     TEXT NOT NULL,
    tree_json  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* Migraciones: CREATE TABLE IF NOT EXISTS no agrega columnas nuevas a una base
   que ya existía, así que las que se sumen con el tiempo se aplican acá. */
(function migrate() {
  const cols = new Set(db.prepare('PRAGMA table_info(nodes)').all().map(c => c.name));
  const pending = [
    ['total_override', 'ALTER TABLE nodes ADD COLUMN total_override INTEGER'],
  ];
  pending.forEach(([col, sql]) => { if (!cols.has(col)) db.exec(sql); });
})();

/* ---------- lectura ---------- */

function allRows() {
  return db.prepare('SELECT * FROM nodes ORDER BY sort_order, rowid').all();
}

function getNode(id) {
  return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) || null;
}

/* Arma el árbol y resuelve la dotación de cada nodo.

   Se manejan dos números distintos, que es lo que hace que el conteo cierre bien
   tanto en un puesto suelto como en una jefatura con subordinados:

     headcount       personas que ocupan ESE puesto. Un departamento contenedor
                     como BODEGA normalmente va en NULL (no tiene gente propia);
                     una jefatura va en 1 aunque tenga asistentes debajo.
     total           lo que se muestra en el círculo = headcount propio + la suma
                     de los totales de los hijos.
     total_override  si se completa, congela el total mostrado e ignora el cálculo.

   Así "BODEGA" muestra la suma de sus 3 puestos, y "Jefatura de Importaciones"
   muestra 1 (el jefe) + 1 (su asistente) = 2, sin que uno tape al otro. */
function buildTree() {
  const rows = allRows();
  const byId = new Map();
  rows.forEach(r => byId.set(r.id, {
    id: r.id,
    parent: r.parent_id,
    label: r.label,
    sub: r.sub || undefined,
    color: r.color,
    kind: r.kind,
    headcount: r.headcount,            // personas propias del puesto (o null)
    totalOverride: r.total_override,   // total fijado a mano (o null)
    radius: r.radius,
    sortOrder: r.sort_order,
    children: [],
  }));

  let root = null;
  rows.forEach(r => {
    const node = byId.get(r.id);
    if (r.parent_id == null) { root = node; return; }
    const parent = byId.get(r.parent_id);
    if (parent) parent.children.push(node);
  });
  if (!root) return null;

  (function resolve(n) {
    n.children.forEach(resolve);
    n.own = n.headcount ?? 0;
    n.childrenTotal = n.children.reduce((acc, k) => acc + k.total, 0);
    n.autoTotal = n.own + n.childrenTotal;
    n.isManual = n.totalOverride != null;
    n.total = n.isManual ? n.totalOverride : n.autoTotal;
  })(root);

  return root;
}

/* ---------- escritura ---------- */

function nextSortOrder(parentId) {
  const row = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM nodes WHERE parent_id IS ?'
  ).get(parentId);
  return row.next;
}

/* Genera un id legible y único a partir del nombre: "Asesores de Ventas" -> "asesores-de-ventas". */
function makeId(label, parentId) {
  const base = String(label || 'puesto')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // saca acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'puesto';
  const prefix = parentId ? `${parentId}.` : '';
  let id = prefix + base;
  let n = 2;
  while (getNode(id)) id = `${prefix}${base}-${n++}`;
  return id;
}

function insertNode({ id, parent_id, label, sub, color, kind, headcount, total_override, radius, sort_order }) {
  db.prepare(`
    INSERT INTO nodes (id, parent_id, label, sub, color, kind, headcount, total_override, radius, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    parent_id ?? null,
    label,
    sub ?? null,
    color == null || color === '' ? '#5b8fc7' : safeColor(color),
    kind || 'node',
    headcount ?? null,
    total_override ?? null,
    radius ?? null,
    sort_order ?? 0
  );
  return getNode(id);
}

function createNode({ parentId, label, sub, color, kind, headcount }) {
  const parent = getNode(parentId);
  if (!parent) throw httpError(404, `No existe el nodo padre "${parentId}"`);
  const name = (label || 'Nuevo puesto').trim();
  if (!name) throw httpError(400, 'El nombre no puede quedar vacío');

  /* El tipo depende de dónde cuelgue: lo que nace de la casa matriz es una
     sucursal, lo que nace de un área del núcleo es un gajo de la corona, y todo
     lo demás es un círculo. El visor reparte los ángulos y los radios solo. */
  const inferredKind = kind || (
    parent.kind === 'core' ? 'suc' :
    parent.kind === 'half' ? 'wedge' : 'node'
  );

  return insertNode({
    id: makeId(name, parentId),
    parent_id: parentId,
    label: name,
    sub,
    color: color || parent.color,
    kind: inferredKind,
    headcount: headcount ?? null,
    sort_order: nextSortOrder(parentId),
  });
}

const toCount = v => (v == null || v === '' ? null : Math.max(0, Math.round(Number(v))));

/* El color termina interpolado dentro del HTML de la hoja de impresión, así que
   sólo se acepta un color hexadecimal real. Sin esto, un valor como
   `" onload="…` guardado desde la API se ejecutaría en el navegador de todos los
   que abran el organigrama. */
const HEX = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(v) {
  const s = String(v ?? '').trim();
  if (!HEX.test(s)) throw httpError(400, `Color inválido: se espera un hexadecimal como #5b8fc7`);
  return s;
}

const EDITABLE = {
  label: v => String(v),
  sub: v => (v == null || v === '' ? null : String(v)),
  color: safeColor,
  headcount: toCount,
  total_override: toCount,
  sort_order: v => Math.round(Number(v)),
};

function updateNode(id, patch) {
  const node = getNode(id);
  if (!node) throw httpError(404, `No existe el nodo "${id}"`);

  const sets = [], values = [];
  for (const [key, cast] of Object.entries(EDITABLE)) {
    if (!(key in patch)) continue;
    const value = cast(patch[key]);
    if (key === 'label' && !String(value).trim()) {
      throw httpError(400, 'El nombre no puede quedar vacío');
    }
    if ((key === 'headcount' || key === 'total_override') && value != null && !Number.isFinite(value)) {
      throw httpError(400, 'La cantidad debe ser un número');
    }
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (!sets.length) return node;

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  return getNode(id);
}

function deleteNode(id) {
  const node = getNode(id);
  if (!node) throw httpError(404, `No existe el nodo "${id}"`);
  if (node.parent_id == null) throw httpError(400, 'No se puede eliminar la raíz del organigrama');
  snapshot(`eliminar ${id}`);
  db.prepare('DELETE FROM nodes WHERE id = ?').run(id);   // ON DELETE CASCADE limpia la descendencia
  return { deleted: id };
}

/* Mueve un nodo dentro de sus hermanos. delta -1 = antes, +1 = después. */
function reorderNode(id, delta) {
  const node = getNode(id);
  if (!node) throw httpError(404, `No existe el nodo "${id}"`);
  const siblings = db.prepare(
    'SELECT id FROM nodes WHERE parent_id IS ? ORDER BY sort_order, rowid'
  ).all(node.parent_id).map(r => r.id);

  const i = siblings.indexOf(id);
  const j = i + (delta < 0 ? -1 : 1);
  if (j < 0 || j >= siblings.length) return { moved: false };

  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  const stmt = db.prepare('UPDATE nodes SET sort_order = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    siblings.forEach((sid, k) => stmt.run(k, sid));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { moved: true };
}

/* ---------- árbol completo ---------- */

function snapshot(reason) {
  const tree = buildTree();
  if (!tree) return;
  db.prepare('INSERT INTO snapshots (reason, tree_json) VALUES (?, ?)')
    .run(reason, JSON.stringify(tree));
  // conserva los 50 respaldos más recientes
  db.exec(`DELETE FROM snapshots WHERE id NOT IN
           (SELECT id FROM snapshots ORDER BY id DESC LIMIT 50)`);
}

/* Reemplaza todo el árbol. Se usa para el sembrado inicial, /api/reset e /api/import. */
function replaceTree(tree, reason) {
  if (!tree || !tree.id || !tree.label) throw httpError(400, 'El árbol recibido no tiene forma válida');
  if (db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n > 0) snapshot(reason);

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM nodes');
    (function walk(node, parentId, order) {
      insertNode({
        id: node.id,
        parent_id: parentId,
        label: node.label,
        sub: node.sub,
        color: node.color,
        kind: node.kind || 'node',
        headcount: node.headcount ?? null,
        total_override: node.totalOverride ?? node.total_override ?? null,
        radius: node.radius ?? null,
        sort_order: order,
      });
      (node.children || []).forEach((k, i) => walk(k, node.id, i));
    })(tree, null, 0);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }

  return buildTree();
}

function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n === 0;
}

/* Siembra la estructura original la primera vez que se arranca. */
function ensureSeeded() {
  if (!isEmpty()) return false;
  replaceTree(SEED_TREE, 'sembrado inicial');
  return true;
}

function resetToSeed() {
  return replaceTree(SEED_TREE, 'reset a la estructura original');
}

/* Resumen de dotación por sucursal y por área — el tipo de consulta que motivó
   usar una base de datos y no un archivo plano. */
function headcountSummary() {
  const tree = buildTree();
  if (!tree) return { total: 0, breakdown: [] };
  return {
    total: tree.total,
    breakdown: (tree.children || []).map(c => ({
      id: c.id,
      label: c.label.replace(/\n/g, ' '),
      kind: c.kind,
      total: c.total,
      areas: (c.children || []).map(a => ({
        id: a.id, label: a.label.replace(/\n/g, ' '), total: a.total,
      })),
    })),
  };
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = {
  DB_PATH, db, buildTree, getNode, createNode, updateNode, deleteNode,
  reorderNode, replaceTree, resetToSeed, ensureSeeded, headcountSummary, httpError,
};
