# Despliegue en tu servidor

## Qué copiar

```
server.js
package.json
src/
organigrama.html
```

`data/` no se copia: la base se crea sola en el primer arranque y se siembra con la
estructura inicial. Si querés llevarte los datos que ya cargaste, copiá también
`data/organigrama.db` (junto con los archivos `-wal` y `-shm` si existen).

## Arrancar

```
node server.js
```

Variables de entorno disponibles:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto de escucha. |
| `ORG_EDIT_KEY` | *(sin definir)* | Si la definís, editar exige esa clave. Ver seguridad. |
| `ORG_DB` | `data/organigrama.db` | Ruta de la base. |

Ejemplo para el servidor:

```
PORT=8080 ORG_EDIT_KEY=una-clave-larga node server.js
```

## Seguridad

Sin `ORG_EDIT_KEY`, **cualquiera que abra la URL puede modificar el organigrama**.
Eso está bien en tu máquina, pero no en un servidor accesible.

Con la variable definida:

- Ver el organigrama sigue siendo libre para todos.
- La primera vez que alguien intente editar, el visor le pide la clave y la guarda
  para el resto de la sesión del navegador.

La clave viaja en un header, así que **serví el sitio por HTTPS** si va a estar
expuesto a internet. Detrás de un proxy como Nginx alcanza con algo así:

```nginx
location /organigrama/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Si preferís no manejar claves en la aplicación, podés dejar `ORG_EDIT_KEY` sin
definir y proteger todo el sitio con la autenticación del proxy.

### Validación de lo que se guarda

Los colores se validan contra un patrón hexadecimal antes de guardarse, y se
vuelven a filtrar antes de dibujar la hoja de impresión. Es la única parte del
dato que termina dentro de HTML concatenado, y sin esa validación alguien con
acceso de edición podría guardar un color que ejecute código en el navegador de
quien abra el organigrama. Si agregás campos nuevos que se muestren en la hoja de
impresión, pasalos por `esc()`.

## Que siga corriendo

El servidor es un proceso Node común. En Linux, con systemd:

```ini
[Unit]
Description=Organigrama Porceramica
After=network.target

[Service]
WorkingDirectory=/ruta/al/organigrama
Environment=PORT=8080
Environment=ORG_EDIT_KEY=una-clave-larga
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

En Windows sirve cualquier envoltorio de servicios (NSSM, por ejemplo) o el
Programador de tareas con inicio al arrancar.

## Respaldos

La base es un solo archivo. Un respaldo diario alcanza con copiarlo:

```
sqlite3 data/organigrama.db ".backup respaldos/organigrama-$(date +%F).db"
```

`.backup` es preferible a copiar el archivo a mano porque toma una copia
consistente aunque alguien esté escribiendo en ese momento. Si no tenés el
cliente `sqlite3` instalado, `GET /api/export` baja el mismo contenido en JSON.

## Actualizar

Reemplazá los archivos de código y reiniciá el proceso. La base no se toca: el
sembrado sólo corre si la tabla está vacía, y los cambios de esquema se aplican
solos en `src/db.js` (función `migrate`).

## Migrar a Postgres o Supabase más adelante

El esquema ya es relacional y las consultas son SQL estándar. Para migrar habría
que reemplazar en `src/db.js` el `DatabaseSync` de `node:sqlite` por el cliente
correspondiente y pasar las llamadas `.get()/.all()/.run()` a su equivalente
asíncrono. La API REST y el visor no cambian.
