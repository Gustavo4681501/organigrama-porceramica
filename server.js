/* Servidor del organigrama — HTTP nativo, sin dependencias de npm.

   Arranque:   node server.js
   Con clave:  ORG_EDIT_KEY=miclave node server.js
   Otro puerto: PORT=8080 node server.js

   Ver siempre es libre. Editar pide la clave sólo si ORG_EDIT_KEY está definida,
   así el uso local no cambia y el despliegue en un servidor queda protegido. */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./src/db.js');

const PORT = Number(process.env.PORT) || 3000;
const EDIT_KEY = process.env.ORG_EDIT_KEY || null;
const ROOT_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5e6) { reject(Object.assign(new Error('Cuerpo demasiado grande'), { status: 413 })); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

/* Sólo se exige la clave si el operador la configuró. */
function requireEdit(req) {
  if (!EDIT_KEY) return;
  const given = req.headers['x-edit-key'];
  if (given !== EDIT_KEY) {
    throw Object.assign(new Error('Clave de edición incorrecta'), { status: 401 });
  }
}

/* ---------- archivos estáticos ---------- */

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/organigrama.html' : decodeURIComponent(urlPath);
  const filePath = path.join(ROOT_DIR, rel);

  // nunca servir fuera de la carpeta del proyecto, ni la base de datos
  const normalized = path.resolve(filePath);
  if (!normalized.startsWith(path.resolve(ROOT_DIR)) ||
      normalized.includes(`${path.sep}data${path.sep}`) ||
      normalized.includes(`${path.sep}.git${path.sep}`)) {
    return send(res, 403, { error: 'Acceso denegado' });
  }

  fs.readFile(normalized, (err, buf) => {
    if (err) return send(res, 404, { error: 'No encontrado' });
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(normalized).toLowerCase()] || 'application/octet-stream' });
  });
}

/* ---------- API ---------- */

async function api(req, res, urlPath) {
  const method = req.method;

  if (urlPath === '/api/config' && method === 'GET') {
    return send(res, 200, { requiresKey: Boolean(EDIT_KEY) });
  }

  if (urlPath === '/api/tree' && method === 'GET') {
    return send(res, 200, { tree: D.buildTree() });
  }

  if (urlPath === '/api/summary' && method === 'GET') {
    return send(res, 200, D.headcountSummary());
  }

  if (urlPath === '/api/export' && method === 'GET') {
    return send(res, 200, { tree: D.buildTree(), exportedAt: new Date().toISOString() }, {
      'Content-Disposition': 'attachment; filename="organigrama.json"',
    });
  }

  if (urlPath === '/api/nodes' && method === 'POST') {
    requireEdit(req);
    const body = await readBody(req);
    const node = D.createNode(body);
    return send(res, 201, { node, tree: D.buildTree() });
  }

  const nodeMatch = urlPath.match(/^\/api\/nodes\/([^/]+)$/);
  if (nodeMatch) {
    const id = decodeURIComponent(nodeMatch[1]);
    if (method === 'PATCH' || method === 'PUT') {
      requireEdit(req);
      const body = await readBody(req);
      const node = D.updateNode(id, body);
      return send(res, 200, { node, tree: D.buildTree() });
    }
    if (method === 'DELETE') {
      requireEdit(req);
      D.deleteNode(id);
      return send(res, 200, { tree: D.buildTree() });
    }
  }

  const moveMatch = urlPath.match(/^\/api\/nodes\/([^/]+)\/move$/);
  if (moveMatch && method === 'POST') {
    requireEdit(req);
    const body = await readBody(req);
    D.reorderNode(decodeURIComponent(moveMatch[1]), Number(body.delta) || 1);
    return send(res, 200, { tree: D.buildTree() });
  }

  if (urlPath === '/api/import' && method === 'POST') {
    requireEdit(req);
    const body = await readBody(req);
    const tree = D.replaceTree(body.tree || body, 'importación');
    return send(res, 200, { tree });
  }

  if (urlPath === '/api/reset' && method === 'POST') {
    requireEdit(req);
    return send(res, 200, { tree: D.resetToSeed() });
  }

  return send(res, 404, { error: `Ruta no encontrada: ${method} ${urlPath}` });
}

/* ---------- servidor ---------- */

const server = http.createServer(async (req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'OPTIONS') {
    return send(res, 204, '', {
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Edit-Key',
    });
  }

  try {
    if (urlPath.startsWith('/api/')) return await api(req, res, urlPath);
    return serveStatic(req, res, urlPath);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    send(res, status, { error: err.message || 'Error interno' });
  }
});

const seeded = D.ensureSeeded();
server.listen(PORT, () => {
  const s = D.headcountSummary();
  console.log('');
  console.log('  PORCERAMICA · ORGANIGRAMA');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Abrir en:    http://localhost:${PORT}`);
  console.log(`  Base:        ${D.DB_PATH}`);
  if (seeded) console.log('  Estado:      base creada y sembrada con la estructura inicial');
  console.log(`  Dotación:    ${s.total} personas registradas`);
  console.log(`  Edición:     ${EDIT_KEY ? 'protegida con ORG_EDIT_KEY' : 'libre (sin clave)'}`);
  console.log('  ─────────────────────────────────────────────');
  console.log('');
});
