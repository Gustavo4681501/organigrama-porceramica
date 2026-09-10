# Arquitectura y datos

## Panorama

```
organigrama porce/
├── server.js            HTTP nativo: API REST + archivos estáticos
├── package.json         sin dependencias; sólo el script "start"
├── src/
│   ├── db.js            esquema, migraciones y acceso a SQLite
│   └── seed.js          estructura inicial de la organización
├── data/
│   └── organigrama.db   la base (se crea sola en el primer arranque)
├── organigrama.html     visor + editor, en un solo archivo
├── docs/                esta documentación
└── planning/            decisiones de diseño
```

**Cero dependencias de npm.** Node 22.5+ trae `node:sqlite` incorporado, así que no
hay módulos nativos que compilar ni `node_modules` que sincronizar. Desplegar es
copiar los archivos y ejecutar `node server.js`.

## Base de datos

### Tabla `nodes`

El organigrama es un árbol guardado como lista de adyacencia: cada posición apunta
a la que tiene encima.

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | TEXT PK | Identificador estable. Los originales son legibles (`lin-bod`, `con1`); los nuevos se generan del nombre (`lin-bod.ayudante-de-bodega`). |
| `parent_id` | TEXT FK | La posición superior. NULL sólo en la raíz. `ON DELETE CASCADE`, así que borrar una jefatura se lleva a sus subordinados. |
| `label` | TEXT | Nombre. `\n` marca los renglones del círculo. |
| `sub` | TEXT | Subtítulo opcional. |
| `color` | TEXT | Color del nodo. |
| `kind` | TEXT | `core`, `half` (área del núcleo), `wedge` (gajo), `suc` (sucursal) o `node`. |
| `headcount` | INTEGER | Personas en **ese** puesto. NULL = ninguna propia. |
| `total_override` | INTEGER | Congela el total mostrado. NULL = se calcula. |
| `radius` | REAL | Radio manual. NULL = lo decide el visor según el nivel. |
| `sort_order` | INTEGER | Orden entre hermanas. |
| `updated_at` | TEXT | Última modificación. |

### Tabla `snapshots`

Copia del árbol completo en JSON antes de cada operación destructiva (borrar,
importar, resetear). Se conservan las 50 más recientes. Para recuperar una:

```sql
SELECT reason, created_at FROM snapshots ORDER BY id DESC LIMIT 10;
SELECT tree_json FROM snapshots WHERE id = 42;
```

y ese JSON se puede volver a cargar con `POST /api/import`.

### Cómo se calculan los totales

En `buildTree()`, para cada nodo de abajo hacia arriba:

```
own           = headcount ?? 0
childrenTotal = suma de los total de los hijos
autoTotal     = own + childrenTotal
total         = total_override ?? autoTotal
```

Se devuelven los cuatro valores para que el visor pueda mostrar el total y, al
mismo tiempo, decirte cuánto daría el cálculo si desactivaras el número fijo.

### Consultas útiles

```sql
-- dotación por sucursal
SELECT n.label, COUNT(*) FROM nodes n WHERE n.parent_id IS NULL;

-- puestos sin gente asignada
SELECT id, label FROM nodes WHERE headcount IS NULL AND id NOT IN (SELECT parent_id FROM nodes WHERE parent_id IS NOT NULL);

-- posiciones tocadas en la última semana
SELECT label, updated_at FROM nodes WHERE updated_at > datetime('now','-7 days');
```

También está `GET /api/summary`, que devuelve el total de la empresa y el desglose
por área y sucursal ya calculado.

## API

Leer nunca pide clave. Escribir la pide sólo si `ORG_EDIT_KEY` está definida
(header `X-Edit-Key`).

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/config` | Dice si el servidor exige clave de edición. |
| GET | `/api/tree` | Árbol completo con los totales resueltos. |
| GET | `/api/summary` | Total de la empresa y desglose por área/sucursal. |
| GET | `/api/export` | El árbol como descarga JSON. |
| POST | `/api/nodes` | Crea una posición. Body: `parentId`, `label`, `headcount`, `color`, `sub`, `kind`. |
| PATCH | `/api/nodes/:id` | Edita `label`, `sub`, `color`, `headcount`, `total_override`. |
| DELETE | `/api/nodes/:id` | Borra la posición y su descendencia. |
| POST | `/api/nodes/:id/move` | Reordena entre hermanas. Body: `delta` −1 o 1. |
| POST | `/api/import` | Reemplaza el árbol completo. Body: `{ tree }`. |
| POST | `/api/reset` | Vuelve a la estructura semilla. |

Toda escritura devuelve `{ tree }` con el árbol ya recalculado, para que el visor
se redibuje sin pedir los datos otra vez.

## Geometría derivada

En la versión anterior los ángulos estaban escritos a mano dentro del HTML
(`a0:90, a1:180`, `angle:-90`…). Eso hacía imposible agregar un departamento sin
recalcular a mano todos los ángulos vecinos.

Ahora cada grupo de hermanas se reparte su espacio angular:

- Las **medias lunas** del núcleo se reparten 360° arrancando en 90°.
- Los **gajos** se reparten el arco de su media luna.
- Las **sucursales** se reparten 360° arrancando en −90°.
- Los **círculos** se abren en abanico hacia afuera de su superior, con el paso
  mínimo necesario para que no se toquen.

Con la estructura original (2 medias lunas, 2+4 gajos, 4 sucursales) el reparto da
exactamente los mismos ángulos que estaban fijos, así que el dibujo no cambió.
Hay una verificación automática de esto en `docs/pruebas.md`.

Los radios también son derivados: dependen del tipo de nodo y de la profundidad
dentro de su rama (núcleo o sucursal). La columna `radius` permite forzar uno.

## Frontend

`organigrama.html` es un solo archivo, sin build ni dependencias externas.

- `layout()` recorre el árbol y asigna `x`, `y`, `r` y ángulos.
- `render()` vacía los grupos SVG y redibuja todo.
- `rebuild()` encadena layout + render + navegación + hoja de impresión, y es lo
  que se llama después de cada cambio. Esto es lo que reemplazó al render de una
  sola pasada que tenía la versión anterior.
- `mutate()` envuelve cada escritura: pide la clave si el servidor responde 401,
  avisa el resultado y redibuja con el árbol que devolvió la API.
