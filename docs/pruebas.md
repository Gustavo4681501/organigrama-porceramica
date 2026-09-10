# Pruebas

```
npm test          # o: node tests/run.js
```

No hace falta tener el servidor levantado: las pruebas arrancan uno propio en el
puerto 3987 con una base descartable (`data/test-api.db`) y lo apagan al terminar.
Tu base real no se toca.

## `tests/api.test.js` — API y base de datos

40 comprobaciones sobre un servidor real, con SQLite real. Las que importan:

**Conteos.** Que un departamento sume a sus puestos, que una jefatura cuente su
propio puesto *más* sus subordinados (el caso que rompía el diseño inicial: si el
número manual pisaba la suma, "Jefatura de Importaciones" mostraba 1 e ignoraba a
su asistente), y que el total suba correctamente hasta la raíz.

**Altas.** Que el id generado sea legible, que un nombre repetido no pise al
anterior, que la posición nueva herede el color del departamento, y que los totales
de todos los niveles superiores se actualicen solos.

**Ediciones.** Renombrar, cambiar la cantidad, fijar el total a mano y volver al
cálculo automático. Que un nombre vacío se rechace con 400 y una cantidad negativa
se limite a cero.

**Bajas.** Que borrar arrastre a los subordinados, que el total vuelva a su valor
anterior, y que no se pueda borrar la raíz.

**Geometría.** Que un departamento agregado en el núcleo nazca como gajo y que se
pueda agregar una sucursal nueva.

**Persistencia real.** Se crea una posición, se mata el proceso del servidor, se
levanta de nuevo y se verifica que siga ahí — y que el sembrado inicial no se
vuelva a ejecutar encima de datos existentes.

**Respaldos.** Exportar, ensuciar el árbol, importar y confirmar que quedó como
estaba.

**Clave de edición.** Con `ORG_EDIT_KEY` definida: ver sigue siendo libre, escribir
sin la clave da 401, y con la clave correcta funciona.

## `tests/visor.test.js` — Visor y geometría

11 comprobaciones estáticas sobre `organigrama.html`, sin navegador:

- Que el JS parsea sin errores de sintaxis.
- **Que el reparto automático de ángulos reproduce exactamente los ángulos que
  antes estaban escritos a mano.** Esta es la comprobación clave del refactor: el
  dibujo no debía cambiar al pasar de coordenadas fijas a coordenadas derivadas.
- Que agregar un gajo reparte el arco en partes iguales sin dejar huecos, que
  cinco sucursales se reparten en pasos de 72°, y que quitar una las reacomoda.
- Que todos los `getElementById` apuntan a un elemento que existe.
- Que todas las rutas que llama el visor existen en el servidor.

## Lo que estas pruebas no cubren

Son pruebas de lógica y de datos. **La apariencia hay que mirarla.** Después de un
cambio en el dibujo conviene abrir el organigrama y revisar a ojo que el texto
entre en los círculos, que las píldoras de dotación no se superpongan con los
nombres, y que la hoja de impresión siga entrando en una sola A3.
