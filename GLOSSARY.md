# GLOSSARY.md — Lenguaje del dominio rødën

> Vocabulario compartido entre Gustavo, el taller y cualquier instancia de Claude.
> Cada término dice **qué es en el taller** y **cómo se llama en el código**.
> Usar estos nombres en conversaciones, commits y código nuevo. Si un término no está
> acá o su definición no coincide con el código, **preguntar antes de asumir** y
> después actualizar este archivo.
>
> Fuente: extraído del código (`types.ts`, `utils/estimatorEngine.ts`,
> `utils/specialModules.ts`, `translations.ts`, `pages/*`) el 2026-10-11.
> Lo marcado **[a confirmar]** es una duda abierta, no una regla.

## Flujo del negocio

| Término | Qué es | En el código |
|---|---|---|
| **Cliente** | Persona o empresa que encarga. Arranca como *Potencial*. | `Client` · `status`: `LEAD` (Potencial) / `ACTIVE` / `INACTIVE` · `type`: `INDIVIDUAL` / `COMPANY` |
| **Proyecto / Obra** | Un encargo de un cliente, de la propuesta a la entrega. | `Project` (tabla `projects`) |
| **Estado del proyecto** | Prospecto → Propuesta → Presupuestando → En Curso → En Producción → Listo para Entregar → Finalizado (o Cancelado). | `ProjectStatus`: `LEAD`, `PROPOSAL`, `QUOTING`, `IN_PROGRESS`, `PRODUCTION`, `READY`, `COMPLETED`, `CANCELLED` (labels en `translations.ts`) |
| **Semáforo de cotización** | Prioridad o temperatura de un proyecto en `QUOTING`. | `quotingColor`: `GREEN` / `YELLOW` / `RED` |
| **Paso de producción** | Etapa del proyecto en el taller: Anticipo y Planos → Materiales → Fabricación → Lustre → Preparación → Listo. | `ProductionStep`: `ANTICIPO_PLANOS`, `COMPRA_MATERIALES`, `FABRICACION`, `LUSTRE`, `PREPARACION`, `LISTO` |
| **Orden de Producción (OP)** | Documento de taller de un trabajo. | `ProductionOrder` (tabla `production_orders`), estados `PENDING` / `IN_PROCESS` / `FINISHED` |
| **Archivo** | Obras cerradas con su legajo (dossier): rentabilidad, tiempos y foto de tareas e informes. | `Project.dossier` (`ProjectDossier`), página `Archive` |
| **Pago a proveedor** | Egreso de una obra (seña + saldo). | `SupplierPayment` (`downPayment`, `balance`) |

## Presupuestos (dos sistemas: NO mezclar)

| Término | Qué es | En el código |
|---|---|---|
| **Presupuesto legacy** | Sistema viejo y simple, vinculado a un proyecto. | `Budget` (tabla `budgets`), `pages/Budgets.tsx` |
| **Presupuesto del estimador** | Sistema actual que genera el CostEstimator: ítems, módulos, versiones. | `SavedEstimate` (tabla `saved_estimates`) |
| **Versión** | Cada re-cotización crea una versión nueva enlazada a la anterior. | `version`, `parentId`, `isLatest` |
| **Estado comercial** | Borrador → Enviado → Aprobado / Rechazado → En producción → Terminado. | `CommercialStatus`: `DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `IN_PRODUCTION`, `FINISHED` |
| **Precios congelados** | Al aprobarse, el presupuesto guarda una foto de los precios de cada ítem. Desde ahí no se recalcula: ni un cambio del motor ni uno de lista cambia lo cotizado. Para re-cotizar se genera una versión nueva. | `quoteData.frozenPrices`, `FREEZE_STATUSES` = `APPROVED`, `IN_PRODUCTION`, `FINISHED` (`pages/CostEstimator.tsx`) |
| **Lista de precios** | Precios de insumos vigentes en un momento. Cada presupuesto queda atado a una. | Tabla `price_lists` · `priceListId` · `settingsSnapshot` (la foto que usa el motor) |

## Estructura de un presupuesto

| Término | Qué es | En el código |
|---|---|---|
| **Ítem** | Un mueble o amoblamiento cotizado como unidad (ej. "Mueble de Cocina"). Agrupa módulos y lleva su mano de obra y márgenes. | `EstimatorItem` (`modules`, `labor`, `margins`, `scenarioPrices`) |
| **Módulo** | Caja o pieza constructiva de un ítem, con ancho × alto × profundidad (mm) y cantidad. | `ExtendedCabinetModule` (`width`, `height`, `depth`, `quantity`) |
| **Módulo estándar** | Caja con tapa, base, laterales, fondo, estantes y frentes, calculada por fórmula. | `calculateModuleParts()` (rama general) |
| **Módulo especial** | Plantilla con despiece propio: Botinero, Biblioteca, Módulo Abierto, Esquinero, Panel, Zócalo, Tapa Horizontal, Ajuste, etc. | `isSpecialModule`, `specialTemplateId`, `specialParts` (`utils/specialModules.ts`) |
| **Módulo (botón Módulos)** | Plantilla especial que es una caja: Módulo Abierto, Horizontal, Bajo Mesada, Esquinero, Esquinero en L, Botineros, Biblioteca. | `group: 'MODULO'` en la plantilla |
| **Pieza suelta (botón Piezas)** | Plantilla especial que es una placa o conjunto chico que se agrega solo: Puerta, Estantes, Paneles, Zócalos, Ajuste, Lateral Aplicado, Divisor, Tapa Horizontal. No confundir con **pieza** del despiece. | `group: 'PIEZA'` en la plantilla |
| **Módulo manual** | Algo que solo aporta costo, sin placas (ej. "Base hierro cromado"). | `moduleType: 'MANUAL'` / `SPECIAL_MANUAL_ID` → no genera piezas |
| **Extra** | Costo adicional por unidad de módulo (se multiplica por la cantidad del módulo). | `ModuleExtra`, `expandModuleExtras()` |

## Despiece y materiales

| Término | Qué es | En el código |
|---|---|---|
| **Despiece** | Lista de piezas (nombre, medidas, material, cantidad y veta) que sale de un módulo. Base de corte, optimizador, reporte técnico y materiales. | `calculateModuleParts()` → `CalculatedPart[]` |
| **Pieza** | Tapa superior, Base inferior, Lateral, Fondo, Estante Interno, Puerta, Frente Cajón, Frente Abatible, Lateral Cajón, Contra/Frente Cajón, Fondo Cajón. | `CalculatedPart.name` (los nombres son contrato: `isVisibleFrontPiece()` usa el prefijo `Frente`/`Puerta`) |
| **Estructura / carcasa** | Tapa, base, laterales, estantes: el cuerpo del módulo. | `carcassMat`, `structureCore` |
| **Frentes** | Puertas, frentes de cajón y abatibles: lo que se ve. | `frontMat`, `frontsCore` |
| **Placa** | Tablero entero de 2750 × 1830 mm (salvo Trupan/fondo 5,5 mm: 2600 × 1830). | `getSheetSize()` |
| **MDP / Aglo** | Aglomerado melamínico. **La UI dice "MDP"; el código dice `AGLO`**: son lo mismo. | `structureCore`/`frontsCore` = `'AGLO'` |
| **MDF** | Fibra de densidad media. | `'MDF'`, material `18mm_MDF` |
| **Core** | Alma del tablero (MDP o MDF), por separado para estructura y frentes. | `structureCore`, `frontsCore` (legacy: `isMDFCore`) |
| **Módulo mixto** | Estructura MDP + frentes MDF (o al revés). El presupuesto debe reflejar su costo real, nunca menos. | `computeItemFinancials(item, snapshot, null)` = config real |
| **Melamina blanca / color** | Terminación melamínica de la placa. | `isWhiteStructure`, materiales `18mm_White` / `18mm_Color`, `materialFrontName` |
| **MDF crudo** | MDF sin revestir, base para laquear. | `18mm_MDFCrudo` |
| **Kiri** | Placa MDF para enchapado. | `18mm_Kiri` |
| **Trupan** | Fondo de 5,5 mm. | `5.5mm_Color`, `backingType: '55_COLOR'` |
| **Fondo** | Trasera del módulo: 3 mm blanco (en ranura), 5,5 mm color, estructural 18 mm o sin fondo. | `backingType`: `3MM_WHITE`, `55_COLOR` (alias legacy `5.5MM_COLOR`), `18MM_STRUCTURE`, `NONE` |
| **Caja de cajón** | Laterales, contra/frente y fondo del cajón, en 15 mm blanco + fondo 3 mm. | Material `15mm_White`; `SLIDE_GAP_TOTAL`, `DRAWER_BOX_SIDE`, `DRAWER_BOTTOM_INSET` |
| **Veta** | Dirección del dibujo de la placa en la pieza. | `grain`: `horizontal` / `vertical` / `free` |
| **Tapacanto** | Canto pegado en los bordes vistos: 22 mm (interior/estructura), 45 mm (frentes, visible), 2 mm. Solo cantos vistos; los fondos no llevan. | `visibleEdgeLength()`, `linearWhite22/45`, `linearColor22/45`, `linear2mm` |
| **Frentes combinados** | Módulo con más de un tipo de frente (cajones + puertas + abatibles). Los altos cargados se respetan y el resto se reparte. | `getFrontLayout()`, `drawerFrontHeight`, `flapFrontHeight` |

## Terminaciones y herrajes

| Término | Qué es | En el código |
|---|---|---|
| **Tipo de módulo** | Combinación de terminación: melamina total, estructura melamina + frentes laqueados, + frentes enchapados, todo laqueado, todo enchapado. | `moduleType`: `MELAMINE_FULL`, `MELAMINE_STRUCT_LACQUER`, `MELAMINE_STRUCT_VENEER`, `LACQUER_FULL`, `VENEER_FULL` |
| **Laca / laqueado** | Pintura sobre MDF crudo. Se cobra por m² (+15 % de seguridad). | `lacquerAreaM2`; línea de terminación `Lacquer` |
| **Enchapado / Lustre** | Chapa de madera sobre Kiri, lustrada. En las líneas de costo figura como "Lustre". | `veneerAreaM2`; línea `Lustre` |
| **Brillo** | Semi mate (por defecto) o brillante. | `finishSheen`: `SEMI` / `GLOSS` |
| **Bisagras** | Estándar, cierre suave, push-open. Entre 2 y 4 por puerta según su alto. | `COMMON`, `SOFT_CLOSE`, `PUSH` (`HINGE_LABELS`) |
| **Guías / correderas** | Telescópica, cierre suave, push, Z (epoxi), ocultas. Largos de 250 a 600 mm según profundidad. | `SLIDE_LABELS`, `getStandardSlideLength()`, `resolveSlidePrice()` |
| **Pistones a gas** | Herraje de los frentes abatibles: uno por abatible, solo si el módulo lo tiene activado. | `hasGasPistons` → `totalPistons` |

## Costos y precios

| Término | Qué es | En el código |
|---|---|---|
| **Motor único de costos** | La única función que calcula plata. Planilla, comparativa y presupuesto la usan igual. | `computeItemFinancials(item, snapshot, override)` |
| **Config real** | El módulo tal como se va a fabricar (cores reales, mezcla MDP+MDF). Es lo que se cotiza. | `override = null` → `realConfig` |
| **Escenario** | El mismo ítem recalculado con materiales forzados, para comparar. Son **14**: 4 melamina (blanca/color × MDP/MDF), 8 estructura + frentes laqueados/enchapados, todo laqueado y todo enchapado. | `getRecalculatedItemPrices()`, `scenarioPrices` |
| **Costo directo** | Placas + tapacanto + herrajes + extras + fijos (tornillos, cola) + terminación + mano de obra. | `costoDirecto` |
| **Mano de obra** | Operarios × días × costo del día. | `labor.workers × labor.days × costLaborDay` |
| **Margen taller** | Recargo sobre el costo directo (35 % por defecto). | `margins.workshop` → `precioTaller` |
| **Margen rødën** | Recargo comercial sobre el precio taller (0 % por defecto). | `margins.roden` → `precioFinal` |
| **Redondeo a placa entera** | Se cobran placas enteras por material, con 20 % de desperdicio (10 % en fondos). **Intencional: siempre costea de más, nunca de menos. No "arreglarlo".** | `Math.ceil(area * 1.2 / getSheetArea(...))` |
| **Redondeo a 10** | El precio final de cada ítem se redondea hacia arriba a múltiplo de 10. | `roundUp10()` |

## Constructor 3D (solo dibujo)

| Término | Qué es | En el código |
|---|---|---|
| **Constructor 3D** | Ubica en 3D las piezas que ya calcula el despiece. No calcula medidas ni costos propios. | `utils/furniture3d/`, `components/estimator3d/` |
| **Posición / giro** | Dónde va el módulo en el mueble (mm) y su rotación. | `layout3d` `{x, y, z, rotY}` |
| **Apertura** | Lado de la bisagra en puerta única. | `doorHingeSide`: `LEFT` / `RIGHT` |
| **Despiece explotado** | Vista con las piezas separadas, para el taller. | Modo "Despiece" del constructor |

## Roles

| Término (UI) | En `types.ts` | En DB (`public.users`) |
|---|---|---|
| Administrador | `administrador` | `ADMIN` |
| Gerente de taller | `gerente_taller` | `WORKSHOP_MANAGER` |
| Operario de taller | `operario_taller` | `USER` **[a confirmar el mapeo exacto]** |
| Vendedor / Cliente | `vendedor` / `cliente` | **[a confirmar si están implementados]** |

## Dudas abiertas [a confirmar con el taller]

Son preguntas, no reglas. Al resolverlas, mover la respuesta a la tabla que corresponda.

1. **Fondo 5,5 mm y estructural 18 mm**: el despiece los mide `H − 18`, pero con tapas sobre laterales el alto interior es `H − 36`. ¿Cuál es la medida real de corte? (Afecta costo, no solo dibujo.)
2. **Profundidad D**: ¿incluye el espesor del frente o el frente va delante de D?
3. **Alto de caja de cajón**: fijo en 120 mm en el despiece. ¿Es siempre así?
4. **Estantes internos**: se agregan solos si `H > 850` (uno cada 350 mm). ¿Es la regla del taller o un valor provisorio?
5. **Orden vertical de frentes combinados**: ¿abatibles arriba, cajones, puertas abajo?
6. **Sentido de apertura por defecto**: 1 puerta → izquierda; 2 o más → hacia afuera. ¿Correcto?
7. **"Lustre" vs "enchapado"**: en el código la terminación de enchapado se cobra como "Lustre". ¿El lustre es solo la terminación del enchapado, o el paso de producción `LUSTRE` cubre también la laca?
