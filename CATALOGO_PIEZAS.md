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
