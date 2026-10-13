# Catálogo de piezas tipo — BORRADOR para validar

> Estado: **propuesta, sin código**. Paso 1 del plan "módulos y piezas tipo".
> Cuando Gustavo lo valide: los términos pasan a `GLOSSARY.md` y el paso 2 agrega el tipo a cada
> pieza **sin cambiar ningún cálculo** (la foto `tests/fixtures/engine.baseline.json` tiene que
> dar idéntica).

## Cómo se armó

No es una lectura a ojo: se ejecutó el despiece real de
- las 19 plantillas de `utils/specialModules.ts`, con **todas** sus opciones y tres medidas
  (600×720×580, 900×2300×600, 1800×400×350), y
- los módulos estándar de la matriz de pruebas (`tests/fixtures/moduleMatrix.mjs`) más uno alto
  (estantes) y uno con abatible.

Resultado: **91 nombres de pieza distintos**. Varios son la misma pieza con otro nombre o con la
cantidad pegada al nombre (`Estante fijo (×7)`). Se agrupan en **27 piezas tipo**.

## Por qué hace falta

Hoy la pieza se identifica **por su nombre escrito**, y el costo y el 3D deciden cosas buscando
texto en ese nombre:

| Regla | Dónde | Qué decide |
|---|---|---|
| Nombre empieza con `Frente` o `Puerta` | `isVisibleFrontPiece()` — `utils/estimatorEngine.ts:300` | Tapacanto 45 mm en los 4 cantos; core y color de frente |
| Nombre empieza con `Fondo` | `visibleEdgeLength()` — `estimatorEngine.ts:313` | Sin tapacanto |
| Material contiene `15mm` | `visibleEdgeLength()` | Tapacanto solo en el canto superior |
| Resto | `visibleEdgeLength()` | Tapacanto 22 mm en el canto frontal, según la veta |
| `^Tapa superior`, `^Lateral$`, `^Fondo`, `^(Estante\|Bandeja)`, `^Puerta`… | `utils/furniture3d/geometry.ts` | Dónde se dibuja cada pieza en 3D |

Renombrar una pieza (o escribirla distinto en una plantilla nueva) cambia el costo sin que nada
avise. Ya pasó: `Contra/Frente Cajón` se cobraba como frente visible.

## Piezas tipo propuestas

Columnas "hoy": lo que el código hace **actualmente** con esos nombres (no lo que debería).
Material: rol de placa (estructura / frente / fondo / cajón), que el motor resuelve al material real.

### Caja (estructura)

| Tipo propuesto | Nombres de hoy | Placa | Veta hoy | Tapacanto hoy |
|---|---|---|---|---|
| `TAPA` | Tapa superior · Tapa (zócalo estructural) | estructura 18 | horizontal | 22 mm, canto frontal |
| `BASE` | Base inferior · Base (zócalo estructural) · Piso · Piso brazo 1/2 | estructura 18 | horizontal | 22 mm, canto frontal |
| `LATERAL` | Lateral · Lateral de esquina 560mm | estructura 18 | vertical | 22 mm, canto frontal |
| `FAJA` | Faja frontal · Faja trasera · Faja frontal brazo 1/2 | estructura 18 | horizontal | 22 mm, canto frontal |
| `FONDO` | Fondo 3mm · Fondo 3mm Blanco · Fondo 3mm brazo 1/2 · Fondo 5.5mm Color · Fondo 18mm Estructura · Fondo Estructural 18mm | fondo 3 / 5,5 · estructura 18 | vertical | ninguno |
| `ESTANTE` | Estante Interno · Estante interno · Estante fijo (×n) · Estante regulable | estructura 18 | horizontal | 22 mm, canto frontal |
| `DIVISOR` | Divisor vertical (×n) | estructura 18 | vertical | 22 mm, canto frontal |
| `REFUERZO` | Refuerzo interno (×n) (zócalo estructural) | estructura 18 | vertical | 22 mm, canto frontal |

### Frentes

| Tipo propuesto | Nombres de hoy | Placa | Veta hoy | Tapacanto hoy |
|---|---|---|---|---|
| `PUERTA` | Puerta · Puerta 18mm · Puerta abatible (×n) · Puerta esquinero | frente 18 | **horizontal** (estándar) / **vertical** (especiales) | 45 mm, 4 cantos |
| `FRENTE_CAJON` | Frente Cajón · Frente exterior cajón (×n) | frente 18 | **horizontal** (estándar) / **vertical** (especiales) | 45 mm, 4 cantos |
| `FRENTE_ABATIBLE` | Frente Abatible | frente 18 | horizontal | 45 mm, 4 cantos |
| `PANEL_FIJO` | Panel fijo 620mm (esquinero) | frente 18 | vertical | **22 mm, 1 canto** |
| `FRENTIN` | Frentín bandeja 50mm (botinero fijo) | frente 18 | horizontal | **22 mm, 1 canto** |

### Caja de cajón

| Tipo propuesto | Nombres de hoy | Placa | Veta hoy | Tapacanto hoy |
|---|---|---|---|---|
| `LATERAL_CAJON` | Lateral Cajón · Lateral caja cajón 15mm (×n) | cajón 15 | **libre** (estándar) / **horizontal** (especiales) | canto superior |
| `TESTA_CAJON` | Contra/Frente Cajón · Testa cajón 15mm (×n) · Testa cajón 15mm — frente+trasero (×n) | cajón 15 | **libre** / **horizontal** | canto superior |
| `FONDO_CAJON` | Fondo Cajón · Fondo caja cajón 3mm (×n) | fondo 3 | **libre** / **horizontal** | ninguno |
| `BANDEJA` | Bandeja extraíble (×n) · Bandeja fija inclinada (×n) | estructura 18 | horizontal | 22 mm, canto frontal |

### Piezas sueltas y aplicadas

| Tipo propuesto | Nombres de hoy | Placa | Veta hoy | Tapacanto hoy |
|---|---|---|---|---|
| `TAPA_HORIZONTAL` | Tapa horizontal 18mm · Estante — cara superior / inferior (estante flotante) | estructura 18 | horizontal | 22 mm, canto frontal |
| `FAJA_REGRUESO` | Faja regrueso — largo (×2) · Faja regrueso — profundidad (×2) | estructura 18 | horizontal | 22 mm, canto frontal |
| `ESTANTE_SUELTO` | Estante 18mm | estructura 18 | horizontal | 22 mm, canto frontal |
| `DIVISOR_SUELTO` | Divisor vertical 18mm | estructura 18 | vertical | 22 mm, canto frontal |
| `LATERAL_APLICADO` | Lateral aplicado 18mm | estructura 18 | vertical | 22 mm, canto frontal |
| `AJUSTE` | Ajuste 18mm × 100mm | estructura 18 | vertical | 22 mm, canto frontal |
| `ZOCALO` | Zócalo aplicado 18mm · Zócalo aplicado 5.5mm | estructura 18 / fondo 5,5 | horizontal | 22 mm (18) · **ninguno** (5,5) |

### Revestimientos

| Tipo propuesto | Nombres de hoy | Placa | Veta hoy | Tapacanto hoy |
|---|---|---|---|---|
| `PANEL` | Panel frontal 18mm · Panel base 18mm | frente 18 / estructura 18 | vertical | **22 mm, 1 canto** |
| `BASTIDOR` | Bastidor horizontal · Bastidor vertical | estructura 18 | según orientación | 22 mm, canto frontal |
| `LISTON` | Listón horizontal 18×18mm (×n) · Listón vertical 18×18mm (×n) | frente 18 | según orientación | **22 mm, 1 canto** |

## Lo que encontré y necesita una decisión

Ninguno se corrigió: cambiar cualquiera de estos puntos cambia costos, y eso lo decide el dueño.

1. **Piezas de placa de frente que el motor no trata como frente.** `Frentín bandeja`,
   `Panel fijo 620mm` (esquinero), `Panel frontal 18mm` y los `Listón` salen de la placa de frente,
   pero su nombre no empieza con `Frente`/`Puerta`. Consecuencia hoy: tapacanto **22 mm en un solo
   canto** en vez de 45 mm en los 4, y en modo técnico, si la placa de frente es de color, el color
   del canto se decide con el nombre del material de la **estructura**, no del frente. Si en el taller llevan canto visible, **hoy se cotizan por debajo**,
   y la regla del negocio es nunca por debajo. → ¿Qué cantos y qué canto lleva cada una?
2. **Veta distinta para la misma pieza.** Puertas y frentes de cajón: horizontal en el módulo
   estándar, vertical en las plantillas especiales. Caja de cajón: libre en el estándar, horizontal
   en las especiales. La veta decide si el optimizador puede girar la pieza
   (`pages/CostEstimator.tsx:1281`), lo que se imprime en la planilla de corte y el largo de
   tapacanto de las piezas que no son frente. → ¿Cuál es la correcta para cada tipo? ¿O depende
   del material (melamina lisa = libre, con veta = fija)?
3. **`Zócalo aplicado 5.5mm` no lleva tapacanto** porque el motor excluye todo material de 3 y
   5,5 mm (pensado para fondos). → ¿Es así en el taller?
4. **`Piso` (bajo mesada, esquinero) y `Base inferior`**: ¿son la misma pieza (`BASE`) o el piso
   tiene otra regla de construcción?
5. **`Estante — cara superior / inferior`** del estante flotante: ¿es una `TAPA_HORIZONTAL` con
   regrueso, o un tipo propio?
6. **La cantidad está en el nombre** (`Estante fijo (×7)`): el mismo estante aparece con un
   nombre distinto según cuántos haya. Con piezas tipo, el nombre queda solo para mostrar y la
   cantidad vuelve a su campo.

## Características que tendría cada pieza tipo (paso 2)

- `id` fijo (los de arriba) y nombre para mostrar.
- Rol de placa: estructura · frente · fondo · cajón.
- Visible (sí/no) y tapacanto por canto: cuáles y de qué tipo (22 / 45 / ninguno).
- Veta por defecto (y si el usuario puede cambiarla).
- Va en ranura (sí/no) — hoy lo deduce el 3D por nombre.
- Cómo se ubica en 3D (reemplaza las búsquedas por nombre de `geometry.ts`).

Las medidas **no** se mueven al catálogo: siguen en la fórmula de cada módulo, que es donde están
hoy y donde se prueban.

## Módulos y piezas nuevos — a definir antes de programar

Pedidos por Gustavo (13/10). No se programan hasta tener su regla constructiva: inventarla
cotizaría mal. Para cada uno hace falta: **qué piezas lleva** (y con qué medida respecto de
ancho W, alto H, profundidad D), **qué carga el usuario**, **herrajes** (cuáles y cuántos) y
**mano de obra** (días).

| Nuevo | Botón | Preguntas puntuales |
|---|---|---|
| Módulo vertical | Módulos | ¿Qué lo distingue del módulo estándar alto? ¿Barral, estantes cada X mm, división interna, zócalo? |
| Alacena | Módulos | ¿Colgadores (herraje y cantidad) o listón de colgar? ¿Fondo 3 mm o 18 mm para fijar a la pared? ¿Abatibles con pistón por defecto? ¿Profundidad típica? |
| Columna de cocina | Módulos | ¿Es una caja con huecos (horno, microondas) y puertas arriba/abajo, o se arma combinando los módulos de horno y microondas? |
| Módulo horno empotrado | Módulos | Medidas del hueco (ancho/alto libres). ¿Estante soporte, ventilación trasera (sin fondo o con corte), cajón inferior? |
| Módulo microondas | Módulos | Medidas del hueco. ¿Estante soporte, marco o frente alrededor? |
| Cajonera interior de placard | Módulos | ¿Lleva laterales propios o va entre los laterales del placard? Frentes: ¿18 mm de frente o 15 mm blanco interior? ¿Guías y alto de cajón? |
| Frente de cajón suelto | Piezas | ¿Solo la placa de frente (4 cantos 45 mm) o incluye caja y guías? |
| Frente abatible suelto | Piezas | ¿Lleva bisagras (¿cuántas?) y pistón? |

---

# Ficha constructiva (definida con Gustavo)

Reglas del taller para despiece, costo y 3D. "Hoy" = lo que hace el código antes de aplicarlas.
**[costo]** = cambia medidas de corte o herrajes (al implementarlo se regenera la foto de costos).

## Módulo estándar — 13/10/2026

| # | Tema | Regla del taller | Hoy | Impacto |
|---|---|---|---|---|
| 1 | Profundidad | Frentes delante de D, separados 3 mm del módulo. Profundidad total = D + 21 mm. | Frente pegado a D (D + 18) | 3D |
| 2 | Tapa y base | Siempre sobre laterales. Opción **Laterales enteros** para casos especiales. | Solo sobre laterales | [costo] con la opción |
| 3 | Fondo 3 mm | En ranura en tapa, base y laterales; ranura de 5 mm de profundidad en todo el perímetro. | (W − 36) × (H − 38), sin ranura | [costo] |
| 4a | Fondo 5,5 mm | Rebaje atrás para que quede al ras. Medida = 5 mm hacia adentro desde los bordes del módulo. | (W − 36) × (H − 18), laterales D − 18 | [costo] |
| 4b | Fondo estructural 18 mm | Entre laterales y entre tapa y base; atornillado a los cuatro. | (W − 36) × (H − 18), laterales D − 18 | [costo] |
| 5 | Cantidad de estantes | H > 850 → 1 + 1 cada 350 mm. | Igual | — |
| 6 | Estantes regulables | Opción **Estantes regulables**. | No existe | [costo] si llevan herraje |
| 7 | Posición de estantes | Equidistantes. | Igual | — |
| 8 | Profundidad del estante | D − espesor del fondo − 10 mm (retiro desde el frente). | D − 45 | [costo] |
| 9 | Frentes | Superpuestos por defecto. Opción **Frente embutido**. | Solo superpuestos | [costo] con la opción |
| 10 | Luces | 4 mm entre frentes, vertical y horizontal. | 4 mm vertical; entre puertas 4 mm (2 puertas) o 2 mm (3 puertas) | [costo] menor |
| 11 | Veta | Melamina lisa: libre. Con veta: paralela al lado mayor de la pieza. | Fija por pieza (horizontal / vertical) | Optimizador y planilla |
| 13 | Apertura | 1 puerta: bisagras del lado del eje del mueble en que está el módulo (izquierda del eje → izquierda). 2 puertas: izquierda / derecha. 3 puertas: izquierda, derecha, derecha. | 1 puerta: izquierda; 2+: hacia afuera | 3D |
| 14 | Cajones | Interior estándar de 80 mm; también de 120, 200 o 300 mm. | Caja fija de 120 mm | [costo] |
| 15 | Caja y guías | Caja D − 20; guía según profundidad (300/400/500). | Igual | — |
| 16 | Fondo de cajón | En ranura en las 4 caras, a 10 mm de abajo, 4 mm menos por lado. | Igual | — |
| 17 | Patas | Opcionales. | No existen | [costo] herraje |

### Detalle cerrado (repreguntas del 13/10)

| Tema | Regla |
|---|---|
| Fondo 3 mm | Ranura a **18 mm del canto trasero**, 5 mm de profundidad. Corte: **(W − 28) × (H − 28)** (1 mm de juego por lado). |
| Fondo 5,5 mm | Corte **(W − 10) × (H − 10)**. Rebaje atrás en laterales, tapa y base de 13 × 5,5 mm (quedan 5 mm de canto visible). Laterales a D completa. |
| Fondo estructural 18 mm | Corte **(W − 36) × (H − 36)**, dentro de la caja y al ras atrás. Laterales, tapa y base a D completa. |
| Laterales enteros | Opción: laterales **H × D**; tapa y base **(W − 36) × D** entre laterales. Se usa cuando el lateral queda a la vista (a criterio). |
| Estantes regulables | Opción. 4 soportes por estante: **se cuentan pero no se cobran**. Estante 2 mm más angosto (W − 38). |
| Sin fondo | Estante de profundidad D − 10. |
| Frente embutido | Entre laterales y entre tapa y base, con 4 mm de luz contra la caja y entre frentes; al ras del frente de la caja (profundidad total D). Los estantes se acortan 18 mm. |
| Luz perimetral (superpuesto) | **2 mm por lado** (frente de W − 4) → entre módulos vecinos quedan 4 mm. |
| Veta | Casilla **"con veta"** en el material de estructura y en el de frentes. Laqueado: libre. Kiri: con veta. |
| Frentes combinados | **No se usan.** Un módulo lleva un solo tipo de frente. |
| Apertura | 4 o más puertas: en pares (izquierda/derecha). Módulo de 1 puerta en el centro del mueble: indistinto (izquierda). |
| Cajones | El alto de interior (alto del lateral de la caja, 15 mm) depende del alto del frente: 80 / 120 / 200 / 300 mm. Puede haber cajón interno detrás de un frente. Fondo de cajón a 10 mm de abajo en todos los altos. |
| Patas | Opcionales. 4 hasta 900 mm de ancho; 6 a partir de ahí. Altura de 120 mm que **se suma a H**. Herraje "Pata regulable" en la lista de precios. |

Pendientes: regla alto de frente → alto de caja de cajón; cajón interno; profundidad de estante con
el fondo de 3 mm a 18 mm de atrás; qué hacer con presupuestos guardados que tienen frentes
combinados. Módulos de cocina: por definir.
