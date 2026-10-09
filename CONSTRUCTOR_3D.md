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

- **Arrastrar con el mouse** (vista Ensamblado): clic sostenido sobre un módulo y mover. El módulo
  salta al hueco más cercano y los demás de la fila se corren para hacerle lugar (los huecos que
  había entre otros módulos, p. ej. heladera, se conservan). Arrastrando hacia arriba o abajo pasa a
  la otra fila (bajos ↔ alacenas). Fila = módulos sin girar apoyados a la misma altura; los girados
  (alas de una L) se ubican con X/Y/Z. Para crear una fila nueva (primera alacena) se carga su Y.
  Lógica: `layoutRows` / `planReorder` en `geometry.ts` (pruebas en `tests/reorder3d.test.ts`).
- Elegí un módulo en la lista para editar medidas, puertas, cajones, abatibles, alto de frentes
  combinados, apertura (bisagra) y posición X/Y/Z (mm) y giro (0/90/180/270°).
- **Ensamblado / Despiece del mueble / Despiece del módulo** y control de separación.
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
| Completa | Estándar (puertas, cajones, abatibles, combinados), Módulo Abierto, Biblioteca, Botinero c/ Extraíbles, Estante 18mm, Puerta 18mm, Lateral Aplicado, Divisor Vertical, Ajuste, Zócalo Aplicado, Tapa Horizontal (18/36), Estante Flotante |
| Aproximada | Botinero c/ Bandejas Fijas (bandejas a 30° dibujadas horizontales) |
| Sin ubicar (volumen + despiece en grilla) | Módulo Horizontal, Bajo Mesada, Esquinero, Esquinero en L, Panel Liso, Panel Enlistonado, Zócalo Estructural |
| Sin geometría | Módulos manuales (solo costo) |

Para sumar una plantilla: agregar su id a `MODULE_PLACERS` en `utils/furniture3d/geometry.ts`
(reusando un ubicador o escribiendo uno). La prueba de correspondencia verifica que cada pieza del
despiece aparezca con sus medidas.

## Reglas pendientes de validar con el taller

Son supuestos **solo de dibujo** (no cambian medidas ni costos); la app los lista en
*Validación → Supuestos de dibujo*:

- Frentes delante de la profundidad D (¿D incluye el frente?).
- Orden vertical de frentes combinados: abatibles, cajones, puertas.
- Separación de estantes (equidistantes) y su posición en profundidad.
- Posición de la ranura del fondo 3mm y de la ranura del fondo de cajón.
- Alto de caja de cajón (120mm fijo en el despiece actual) y su posición vertical.
- **Fondo 5,5mm y fondo estructural 18mm**: el despiece los mide H − 18, incoherente con tapas
  sobre laterales (alto interior H − 36); el 3D muestra el choque como aviso.
- Sentido de apertura por defecto (1 puerta: izquierda; 2+: hacia afuera).
- Geometría de Módulo Horizontal (frentes de ancho de columna a alto completo), Bajo Mesada
  (fajas), Esquineros y Paneles.
