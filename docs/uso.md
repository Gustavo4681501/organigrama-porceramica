# Guía de uso — Organigrama Porcerámica

## Arrancar

Abrí una terminal en la carpeta del proyecto y ejecutá:

```
node server.js
```

Después entrá a **http://localhost:3000**.

No hace falta `npm install`: el servidor usa sólo módulos que ya vienen con Node
(requiere Node 22.5 o superior; probado en Node 24).

> El archivo `organigrama.html` ya no funciona con doble clic. Los datos viven en
> una base SQLite y se leen del servidor. Si lo abrís suelto, la pantalla te avisa
> y te recuerda el comando.

## Navegar

- **Clic** en cualquier círculo, gajo o media luna para entrar en esa parte.
- **‹ Volver**, la tecla **Esc** o **Retroceso** para subir un nivel.
- Las **migas** de abajo muestran la ruta actual y la dotación de cada tramo;
  hacé clic en cualquiera para saltar directo.

## El numerito de dotación

Debajo del nombre de cada posición aparece una píldora con la cantidad de gente.
Hay dos estilos, y la diferencia importa:

| Aspecto | Significado |
|---|---|
| Píldora **oscura con borde blanco** | El número está **calculado**: es la gente de ese puesto más la de todos los que dependen de él. |
| Píldora **dorada sólida** | El número está **fijado a mano** e ignora el cálculo. |

El cálculo sube por toda la jerarquía: si cambiás el número de un asesor de ventas
de Coyol, se actualizan al instante Ventas, la sucursal Coyol y el total de la
empresa que aparece arriba a la izquierda.

### Los dos números de cada posición

Esta distinción es la que hace que los totales cierren bien:

- **Personas en este puesto** — sólo la gente que ocupa esa posición.
  Un departamento que únicamente agrupa a otros (BODEGA, VENTAS) va en **0**.
  Una jefatura va en **1** aunque tenga asistentes debajo.
- **Total mostrado** — lo que se ve en el círculo: las personas del puesto **más**
  la suma de todo lo que cuelga de él.

Así "BODEGA" muestra la suma de sus tres puestos, y "Jefatura de Importaciones"
muestra 2 (el jefe más su asistente), sin que un número tape al otro.

## Editar

Tocá **Editar** arriba a la derecha. Con el modo activo:

- **Un clic** selecciona una posición y abre el panel de la derecha.
- **Doble clic** navega hacia adentro, como siempre.

En el panel podés cambiar:

- **Nombre** — cada salto de línea es un renglón dentro del círculo.
- **Subtítulo** — el texto chico bajo el nombre (ej. "Administrador").
- **Personas en este puesto** — el numerito.
- **Total mostrado** — marcá *Fijar el total a mano* si querés congelar un número
  y que deje de calcularse.
- **Color** — de la paleta.

Los cambios se guardan solos al salir del campo o con **Enter**
(**Ctrl+Enter** en el nombre, que es multilínea). **Esc** descarta lo que estabas
escribiendo.

## Agregar posiciones

Seleccioná la posición que va a ser la superior y tocá **+ Agregar posición dentro**.
Te pide el nombre y la cantidad de gente.

Funciona en cualquier nivel, y el dibujo se reacomoda solo:

| Dónde la agregues | Qué aparece |
|---|---|
| Dentro de un puesto o departamento | Un círculo nuevo, colgando en abanico. |
| Dentro de un área del núcleo (las medias lunas) | Un gajo nuevo de la corona. Los gajos existentes se achican para repartirse el arco en partes iguales. |
| En la raíz, con tipo sucursal | Una sucursal nueva. Las sucursales se reparten los 360° del círculo. |

También podés **Duplicar** una posición, **Subir/Bajar** su orden entre hermanas y
**Eliminar** (avisa cuántas posiciones se llevaría por delante).

## Imprimir y compartir

**Imprimir todo** arma una única hoja A3 horizontal con toda la estructura, la
dotación de cada puesto y el total de la empresa. Desde el diálogo de impresión
podés elegir "Guardar como PDF" para mandarlo por correo.

## Respaldos

En la parte de abajo del panel de edición:

- **Descargar respaldo (JSON)** — baja un archivo con todo el organigrama.
- **Restaurar desde un respaldo** — lo vuelve a cargar desde ese archivo.
- **Volver a la estructura original** — descarta todo y regresa a la estructura
  con la que arrancó el proyecto.

Antes de cada operación destructiva el servidor guarda solo una copia del árbol en
la tabla `snapshots` de la base (conserva las 50 más recientes), así que un borrado
accidental se puede recuperar consultando la base.

El respaldo más simple de todos es copiar el archivo `data/organigrama.db`.
