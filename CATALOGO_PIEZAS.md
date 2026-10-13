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
| Profundidad del estante | Fondo 3 mm → D − 31; 5,5 mm → D − 15,5; 18 mm → D − 28; sin fondo → D − 10 (− 18 más con frente embutido). |
| Caja de cajón | Interior según el frente: < 160 → 80; 160–239 → 120; 240–339 → 200; ≥ 340 → 300 mm. Con frente embutido la caja es 18 mm más corta (y la guía se elige con esa profundidad). |
| Frentes combinados | El formulario no deja cargar nuevos; los presupuestos guardados se siguen calculando igual. |

**Implementado** (13/10/2026) en el despiece, los herrajes, el formulario y el 3D. Supuesto mío
a confirmar: caja de cajón 18 mm más corta con frente embutido.

Pendientes: **cajón interno** (solo la caja, sin frente): falta su alto y cómo se combina con la
caja del frente. Patas: se cobran y elevan el módulo en 3D, pero todavía no se dibujan.
Módulos de cocina: ver abajo.

## Módulos de cocina — 13/10/2026

Hallazgo previo (verificado con el motor): el **Bajo mesada actual no genera puertas**. Con
puertas cargadas cobra las bisagras, pero no la placa ni el tapacanto de las puertas (cotiza
por debajo). El **Esquinero en L** no tiene ningún frente.

### Bajos (bajo mesada y esquineros)

| # | Tema | Regla del taller | Hoy |
|---|---|---|---|
| 1 | Tapa | Sin tapa (va la mesada). Faja frontal y faja trasera de 100 mm. | Igual |
| 2 | Laterales | Enteros (H × D); piso entre laterales. | Igual |
| 3 | Alturas | Caja 740, zócalo 100, mesada 20 (total 860). Base: **banquina, zócalo estructural o patas regulables**; en los tres casos puede llevar **zócalo aplicado** o no. | Sin base |
| 4 | Profundidad | **581 con frentes** (caja 560 + 21). La mesada (600) vuela. | — |
| 5 | Fondo 3 mm | En ranura en laterales y piso, a 18 mm de atrás. Faja trasera superior de 100 mm (para fijar a la pared y rigidizar). | (W − 36) × (H − 110), sin ranura |
| 6 | Puertas | Mismas reglas que el estándar. | **No se generan** |
| 7 | Cajones | Mismas reglas que el estándar; la cantidad la carga el usuario. | Automáticos, 1 cada 180 mm, sin luces |
| 8 | Variantes | No hay (bacha y anafe se arman igual). | — |
| 9 | Esquinero recto | Panel fijo = **profundidad del bajo que llega de costado + 21 + luz**. Puerta = resto. | Panel fijo de 620 |
| 10 | Esquinero recto | Solo un estante. | Sin estante |
| 11 | Esquinero en L | **Dos puertas separadas**, brazos de medida variable, lleva estante. | Sin frentes ni estante |

### Alacena

| # | Tema | Regla del taller |
|---|---|---|
| 12 | Construcción | Tapa y base sobre laterales (como el estándar). |
| 13 | Profundidad | 320 mm + frente. |
| 14 | Fondo | 3 mm en ranura a 18 mm de atrás + faja trasera superior de 100 mm. |
| 15 | Colgadores | No lleva. |
| 16 | Frentes | Puertas o abatibles (un solo tipo). |
| 17 | Altura | Base a 600 mm sobre la mesada (860 + 600 = 1460 mm del piso). |

### Columna, horno y microondas

| # | Tema | Regla del taller |
|---|---|---|
| 18 | Columna | Módulos apilados + **dos laterales aplicados** de la altura total, que avanzan 21 mm (al ras de las puertas). |
| 19 | Horno | Va dentro de la columna. 595 mm "entre ejes" de laterales y entre base y techo. |
| 20 | Horno | Sin fondo; techo con 300 mm recortados atrás para ventilar. |
| 21 | Microondas | En columna (de empotrar): mismo ancho libre que el horno, 385 mm "entre ejes" de piso y techo. En alacena (convencional): piso de 420 mm mínimo, 580 de ancho libre y 350 de alto libre. |

### Repreguntas cerradas (13/10)

| Tema | Regla |
|---|---|
| Base (todos los módulos) | Banquina, zócalo estructural o patas regulables: **100 mm** (reemplaza las patas de 120). Banquina = obra, no se cobra; zócalo estructural y zócalo aplicado se cargan aparte como Piezas; patas = herraje (4 hasta 900 mm de ancho, 6 a partir de ahí). |
| Horno | 595 mm **entre ejes** de laterales y entre base y techo → caja **613 × 613** (hueco libre 577; el frente del horno, 595 × 595, cubre). |
| Faja frontal del bajo | Acostada, arriba al frente. |
| Fondo del bajo | Llega al borde superior: 3 mm **(W − 28) × (H − 14)**. |
| Profundidad del bajo | D = 560 por defecto (581 con frente). |
| Esquinero recto | Frente fijo = profundidad del **bajo vecino** (campo propio; vacío = la del esquinero) + 21 + 4. Estante regulable. |
| Esquinero en L | Se cargan largo brazo 1, largo brazo 2, profundidad lado 1 y lado 2. Piso en L (una pieza), dos fondos, estante en L, dos puertas de largo del brazo − profundidad del otro − 21 − luz. |
| Alacena | Caja de 320 (+ frente). Microondas convencional: solo el piso es más profundo (420). |
| Columna | Opción (a): la columna aporta los 2 laterales aplicados; los módulos de adentro se cargan aparte. Puede ir sobre banquina, patas o zócalo estructural. |
| Horno | Va en la columna o en un bajo mesada. Techo de profundidad D − 300. |

**Implementado** (13/10/2026): bajo mesada, esquinero recto y alacena como variantes del módulo
estándar (`cabinetType`), base de 100 mm en todos los módulos estándar, módulo horno empotrado
y columna (plantillas nuevas). Las plantillas viejas de bajo mesada y esquinero quedan ocultas
(`legacy`) y siguen calculando los presupuestos guardados con ellas.

Supuestos míos a confirmar:
- Bajo con puertas: **1 estante regulable** (como la plantilla anterior). Con cajones, sin estante.
- Esquinero recto: puerta = W − 4 − frente fijo − 4 (2 mm al borde libre, 4 mm entre fijo y
  puerta); bisagras del lado de afuera (abre alejándose del rincón).
- Bajo con fondo de 5,5 mm: (W − 10) × (H − 5); con fondo de 18 mm: (W − 36) × (H − 18).
- Alacena: estantes con la regla del estándar (ninguno hasta 850 mm de alto).
- Horno: tapa y base sobre laterales (como el estándar); sin mano de obra estimada.
- Columna: el ancho es el exterior total; los módulos de adentro miden ancho − 36. La base de la
  columna todavía no se aplica (se dibuja en el piso).

### Tercera ronda (13/10)

| Tema | Regla |
|---|---|
| Supuestos 1, 2, 4 y 5 | Confirmados. |
| Estantes de alacena | Hasta 600 mm de alto → 1; hasta 900 → 2; más de 900 → 3. |
| Módulo microondas (alacena) | Módulo abierto (sin frentes), fondo de 18 mm, piso de 420 mm que sobresale 100 mm hacia adelante. |
| Esquinero en L | Se cotiza como dos rectángulos (piso y estante). |
| Microondas de columna (de empotrar) | Sin fondo. 613 × 403 (mismo ancho que el horno; 385 entre ejes de piso y techo). |
| Horno en bajo mesada | Lleva faja inferior. |
| Cajón interno | Solo la caja, 80 mm de alto; con sus guías. |

**Implementado:** estantes de alacena, módulo microondas de alacena (sin faja trasera: el fondo
de 18 mm la reemplaza — supuesto mío), microondas de columna y cajón interno (en 3D se apilan
desde el piso cada 120 mm — supuesto de dibujo).

### Cuarta ronda (13/10)

| Tema | Regla |
|---|---|
| Bajo mesada para horno | 595 entre ejes de laterales (613 de ancho). Construcción de bajo, **sin fondo**. Estante fijo de apoyo, (W − 36) × (D − 10), que deja **600 mm libres** hasta la mesada. **Faja inferior de material de frente**, (W − 4) × (H − 600 − 4). **Implementado.** |
| Esquinero en L | Pisos: A a lo largo de todo el brazo 1; B desde donde termina la profundidad de A. Puertas abren hacia afuera del rincón. Rigidez: **dos fajas verticales en L de 80 × 80 mm por la altura total** ("columna" en el ángulo). |

Columna del esquinero en L: **en el rincón contra las paredes**, fajas de **estructura**, piezas
de 80 y 62 (exterior 80 × 80).

**Esquinero en L implementado** (plantilla `ESQUINERO_EN_L`, reemplaza la versión sin frentes).
Carga: ancho = largo del brazo 1, prof. = lado 1, opciones largo del brazo 2 y prof. del lado 2.

| Pieza | Medida |
|---|---|
| Laterales (extremos) | D1 × H y D2 × H |
| Piso A / B | (L1 − 18) × D1 / (L2 − D1 − 18) × D2 |
| Columna de rincón | 80 × (H − 18) y 62 × (H − 18) — apoyada sobre el piso (confirmado) |
| Fajas traseras (paradas) | (L1 − 98) × 100 / (L2 − 98) × 100 — desde la columna |
| Fajas frontales (acostadas) | (L1 − 18 − D2) × 100 / (L2 − 18 − D1) × 100 |
| Fondos 3 mm | (L1 − 32) × (H − 14) / (L2 − 35) × (H − 14) — A pasa en el rincón, B apoya |
| Estante A / B (regulable) | (L1 − 41) × (D1 − 31) / (L2 − D1 − 10) × (D2 − 31) — **corregido** respecto de la propuesta (chocaba con el fondo del otro brazo) |
| Puertas | (L1 − D2 − 25) × (H − 4) / (L2 − D1 − 25) × (H − 4); bisagras hacia afuera del rincón |
