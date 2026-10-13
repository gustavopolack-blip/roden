# Constructor 3D del Estimador (rødën OS)

Permite armar en 3D cada amoblamiento con los **mismos módulos que se cotizan**, ver el
despiece explotado para el taller y exportar la maqueta a **FBX** (3ds Max) u **OBJ/MTL**.

## Dónde está

| Pieza | Archivo |
|---|---|
| Motor del estimador (despiece, cantidades, costos) — extraído sin cambios de `CostEstimator.tsx` | `utils/estimatorEngine.ts` |
| Geometría: ubicación de piezas, composición, validaciones, despiece explotado | `utils/furniture3d/geometry.ts` |
| Exportación FBX 7.4 ASCII y OBJ/MTL | `utils/furniture3d/exporters.ts` |
| Interfaz (carga bajo demanda) | `components/estimator3d/Builder3D.tsx`, `Viewer3D.tsx` |
| Pruebas | `tests/*.test.ts` (`npm test`) |

## Cómo se usa

- **Módulos → Módulos Pendientes → botón `3D`**: arma el mueble antes de crear el ítem.
- **Módulos → Items Generados → `3D`**: edita un ítem; al aplicar se recalculan sus precios con el
  mismo motor que al crearlo.
- **Historial → tarjeta → `Modelo 3D`**: solo lectura (presupuestos guardados / aprobados).

En el constructor:

- Elegí un módulo en la lista para editar medidas, puertas, cajones, abatibles, alto de frentes
  combinados, apertura (bisagra) y posición X/Y/Z (mm) y giro (0/90/180/270°).
- Se abre a pantalla completa. Dos vistas: **Ítem completo** (todos los módulos) y **Módulo**
  (el seleccionado en la lista, solo), cada una **Ensamblada** o en **Despiece** con control de
  separación. Al cambiar de vista la cámara encuadra todo lo visible según la proporción del visor.
- Clic en una pieza: nombre, placa, medidas y veta (las mismas del despiece y la planilla de cortes).
- La validación marca módulos superpuestos, separaciones chicas (≤ 5 mm), medidas inválidas,
  frentes que no entran y piezas que chocan por reglas pendientes. Con errores no se puede aplicar.

La posición (`layout3d`) y el sentido de apertura (`doorHingeSide`) se guardan dentro del módulo
(JSON `items` de `saved_estimates`). No hizo falta migración ni cambios de RLS. Los módulos sin
posición (todos los anteriores) se ubican automáticamente en fila sobre el piso.

## Exportar e importar en 3ds Max

1. En el constructor: **FBX ensamblado** (o **FBX despiece** para el explotado).
2. En 3ds Max: *File → Import → Import…* → elegir el `.fbx`.
3. En el diálogo del importador FBX, sección *Units*: dejar **Automatic** (el archivo declara
   milímetros) o fijar *File units = Millimeters*. Ejes: el archivo es Y-arriba; el importador
   lo convierte a Z-arriba (*Axis Conversion → Y-up*).
4. Jerarquía resultante: `Amoblamiento_<nombre>` → `M01_<módulo>` → `M01_<módulo>_<pieza>`.
   Cada pieza tiene un material por tipo de placa (colores de referencia, para reemplazar por los
   materiales reales) y UV en metros con la U siguiendo la veta. En *Object Properties → User
   Defined* quedan pieza, placa, medidas, veta y bisagra.

**No se genera un `.max` nativo**: el sistema no tiene integración con 3ds Max; se exporta un
archivo importable. Alternativa: **OBJ + MTL** (sin jerarquía real; los nombres de grupo la
conservan; unidades mm).

Verificación realizada: el FBX se relee en las pruebas con el `FBXLoader` de three.js y se
validó además con **assimp** (Open Asset Import Library): jerarquía, nombres, materiales,
posiciones, rotaciones y medidas en mm coinciden. **No se probó la importación en 3ds Max**
(no disponible en el entorno de desarrollo): conviene una prueba real antes de usarlo en producción.

## Cobertura de módulos

| Ubicación 3D | Módulos |
|---|---|
| Completa | Estándar (puertas, cajones, abatibles, combinados), Bajo mesada, Bajo mesada esquinero recto, Alacena (sin posición: colgada a 1460 mm), Módulo horno empotrado, Microondas de empotrar, Columna, Bajo mesada para horno, Bajo mesada esquinero en L, Módulo abierto, Biblioteca, Botinero con estantes extraíbles, Estante 18mm, Puerta, Lateral aplicado, Divisor vertical, Ajuste, Zócalo aplicado, Tapa horizontal (18/36), Estante 36mm (las ménsulas ocultas no se dibujan) |
| Aproximada | Botinero con bandejas fijas inclinadas (bandejas a 30° dibujadas horizontales) |
| Sin ubicar (volumen + despiece en grilla) | Módulo horizontal, Bajo mesada y esquinero recto anteriores a la ficha (plantillas legacy),  Panel de revestimiento liso, Panel de revestimiento enlistonado, Zócalo estructural |
| Sin geometría | Módulos manuales (solo costo) |

Para sumar una plantilla: agregar su id a `MODULE_PLACERS` en `utils/furniture3d/geometry.ts`
(reusando un ubicador o escribiendo uno). La prueba de correspondencia verifica que cada pieza del
despiece aparezca con sus medidas.

## Reglas del taller y pendientes

El **módulo estándar** se dibuja según su ficha constructiva (`CATALOGO_PIEZAS.md`, definida con
Gustavo el 13/10/2026): frentes superpuestos separados 3 mm de la caja (profundidad total D + 21)
o embutidos al ras, luces de 2 mm al borde y 4 mm entre frentes, fondo de 3 mm en ranura a 18 mm
de atrás, de 5,5 mm en rebaje y de 18 mm dentro de la caja, laterales enteros opcionales, estantes
equidistantes a 10 mm del frente, caja de cajón según el alto del frente, apertura según la
posición del módulo en el mueble (1 puerta), izquierda/derecha/derecha (3) o en pares, y patas
redondas Ø 40 × 100 mm (centro a 40 mm de costados, frente y atrás; 6 con más de 900 de ancho,
el par extra centrado). Las patas son herraje: se dibujan y se exportan (cilindro "Pata regulable")
pero no salen del despiece. Un **zócalo aplicado** sin posición guardada se ubica solo delante de
las patas del primer módulo con patas apoyado en el piso; si no hay ninguno, sigue la fila.

Pendientes (la app los lista en *Validación → Supuestos de dibujo*):

- Plantillas especiales: todavía usan sus medidas de fondo y frentes anteriores a la ficha.
- Banquina y zócalo estructural: el módulo se eleva pero la base no se dibuja.
- Bandejas inclinadas del botinero: dibujadas horizontales.
- Geometría de Módulo horizontal, Bajo mesada, esquineros y paneles.
