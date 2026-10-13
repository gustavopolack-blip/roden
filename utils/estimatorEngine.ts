/**
 * rødën OS — Motor del Estimador de Costos (puro, sin estado de React)
 *
 * Extraído TEXTUALMENTE de pages/CostEstimator.tsx para poder probarlo y reutilizarlo
 * (constructor 3D, pruebas). No cambia ninguna regla: tests/estimatorEngine.test.ts compara
 * su salida contra una foto (tests/fixtures/engine.baseline.json) generada con el código
 * anterior a la extracción.
 *
 * Contiene: despiece de módulos (calculateModuleParts), cantidades (calculateItemQuantities),
 * precios (boardPriceFor / hwPriceFor / resolveSlidePrice / buildFinishLines),
 * motor único de costos (computeItemFinancials) y escenarios (getRecalculatedItemPrices).
 */
import { CabinetModule, CalculatedPart, CostSettings } from '../types';
import { SPECIAL_MANUAL_ID, SLIDE_GAP_TOTAL, DRAWER_BOX_SIDE, DRAWER_BOTTOM_INSET } from './specialModules';

export interface ModuleExtra {
    id: string;
    description: string;
    quantity: number;
    unit: string; 
    unitPrice: number;
}

export interface ExtendedCabinetModule extends CabinetModule {
    materialFrontName?: string; 
    extras?: ModuleExtra[];
    // New computation flags
    calculateHinges?: boolean;
    calculateSlides?: boolean;
    // Technical Definition Fields
    structureCore?: 'AGLO' | 'MDF';
    frontsCore?: 'AGLO' | 'MDF';
    // Alto de cada frente cuando el módulo combina tipos de frente (vacío = automático)
    drawerFrontHeight?: number;
    flapFrontHeight?: number;
    // Brillo de la laca / lustre del módulo (vacío = semi mate)
    finishSheen?: 'SEMI' | 'GLOSS';
    // Ficha constructiva del módulo estándar (CATALOGO_PIEZAS.md, 13/10/2026)
    fullHeightSides?: boolean;   // laterales enteros: laterales H × D, tapa y base entre laterales
    adjustableShelves?: boolean; // estantes regulables: W − 38 y 4 soportes por estante (sin costo)
    insetFronts?: boolean;       // frentes embutidos: entre laterales/tapa/base, al ras de la caja
    // Base del módulo: eleva la caja 100 mm (BASE_HEIGHT). Banquina = obra (sin costo);
    // zócalo estructural = se carga aparte como pieza; patas = herraje (4 o 6 por módulo).
    baseType?: 'BANQUINA' | 'ZOCALO' | 'PATAS';
    // Variante constructiva del módulo estándar (vacío = estándar). Ficha de cocina 13/10/2026.
    //  BAJO: bajo mesada (laterales enteros, piso entre laterales, sin tapa, fajas de 100 mm).
    //  ESQUINERO: bajo mesada esquinero recto (frente fijo de rincón + 1 puerta).
    //  ALACENA: estándar + faja trasera superior de 100 mm; opción piso de microondas (420 mm).
    cabinetType?: 'BAJO' | 'ESQUINERO' | 'ALACENA';
    neighborDepth?: number;          // esquinero: profundidad del bajo que llega de costado (vacío = D)
    cornerSide?: 'LEFT' | 'RIGHT';   // esquinero: lado del rincón (frente fijo)
    microwaveFloor?: boolean;        // alacena: piso de 420 mm para microondas convencional
    // Veta del material. undefined = módulo anterior a la regla (veta fija por pieza, como antes);
    // false = melamina lisa (veta libre); true = con veta → paralela al lado mayor de la pieza.
    structureHasGrain?: boolean;
    frontsHaveGrain?: boolean;
    // Constructor 3D (solo dibujo; no intervienen en despiece ni costos)
    layout3d?: { x: number; y: number; z: number; rotY: 0 | 90 | 180 | 270 }; // posición en el mueble (mm)
    doorHingeSide?: 'LEFT' | 'RIGHT';                                       // apertura de puerta única
}

// NEW: Item definition (Grouping of Modules)
export interface EstimatorItem {
    id: string;
    name: string; // e.g. "Mueble de Cocina"
    modules: ExtendedCabinetModule[];
    labor: {
        workers: number;
        days: number;
    };
    margins: {
        workshop: number;
        roden: number;
    };
    // Pre-calculated totals for different scenarios for this specific item
    scenarioPrices: {
        whiteAglo: number;
        whiteMDF: number;
        colorAglo: number;
        colorMDF: number;
        lacquer: number;
        veneer: number;
        baseConfig?: number; // legacy field from old saved estimates
    };
    details: {
        totalHardwareCost: number;
        totalMaterialCostBase: number;
    }
}


export const HINGE_LABELS: Record<string, string> = {
    'COMMON': 'Bisagras Estándar',
    'SOFT_CLOSE': 'Bisagras Cierre Suave',
    'PUSH': 'Bisagras Push-Open'
};

// Herraje del estante 36mm flotante (template ESTANTE_FLOTANTE), en dos largos.
// Precio: priceFloatingBracket15 / priceFloatingBracket25.
export const bracketLabel = (length: 150 | 250): string => `Ménsula metálica oculta ${length / 10}cm`;
// Patas regulables del módulo estándar (precio priceLeg) y soportes de estante regulable (sin precio).
export const LEG_LABEL = 'Pata regulable';
export const SHELF_SUPPORT_LABEL = 'Soporte de estante (sin costo)';

export const SLIDE_LABELS: Record<string, string> = {
    'TELESCOPIC': 'Guías Telescópicas',
    'TELESCOPIC_SOFT': 'Guías Telescópicas Cierre Suave',
    'Z_TYPE': 'Guías Z (Epoxi)',
    'TELESCOPIC_PUSH': 'Guías Push',
    'HIDDEN_METAL_SIDE': 'Guías Ocultas'
};


// Medidas de placa (mm), única fuente para costo y optimizador de corte.
// Según el taller: todas 2750 × 1830 salvo el Trupan / fondo color 5.5mm, 2600 × 1830.
// Antes el costo usaba 2750 para todo (Trupan) y el optimizador 2600 para el Kiri.
export const getSheetSize = (materialName: string = ''): { width: number; height: number } => {
    const n = materialName.toLowerCase();
    if (n.includes('5.5') || n.includes('55mm') || n.includes('trupan')) return { width: 2600, height: 1830 };
    return { width: 2750, height: 1830 };
};
export const getSheetArea = (materialName: string = ''): number => {
    const { width, height } = getSheetSize(materialName);
    return width * height;
};


export const getStandardSlideLength = (depth: number) => {
    const target = depth - 30;
    const available = [250, 300, 350, 400, 450, 500, 600];
    const size = available.reverse().find(s => s <= target);
    return size || 250; 
};


// Extras de módulos con su cantidad EFECTIVA: los extras se cargan por unidad de
// módulo, así que un módulo con Cant. 3 y un extra de 1 un lleva 3. Antes el motor
// de costos los contaba una sola vez (calculateItemQuantities sí multiplicaba): un
// módulo repetido con extras se cotizaba por debajo. Única fuente para sumar y listar.
export const expandModuleExtras = (modules: any[] = []): ModuleExtra[] =>
    modules.flatMap((m: any) => (m?.extras || []).map((ex: ModuleExtra) => ({
        ...ex,
        quantity: (ex.quantity || 0) * (m?.quantity || 1),
    })));
export const sumModuleExtras = (modules: any[] = []): number =>
    expandModuleExtras(modules).reduce((sum, ex) => sum + (ex.unitPrice || 0) * (ex.quantity || 0), 0);

  // Distribución vertical de frentes. Cada cajón y cada abatible es una fila; las puertas
  // (lado a lado) son una fila más; 4mm entre filas, sobre el alto útil H−6.
  // - Un solo tipo de frente: idéntico a antes (ocupa todo el alto).
  // - Tipos combinados: los altos cargados (drawerFrontHeight / flapFrontHeight) se
  //   respetan y el resto del alto se reparte en partes iguales entre los grupos sin alto
  //   cargado (las puertas siempre toman su parte del resto).
  // Antes, con cajones, las puertas no se generaban (ni se cobraban), y abatibles +
  // puertas ocupaban ambos el alto completo (frentes duplicados).
// ── Ficha constructiva del módulo estándar (CATALOGO_PIEZAS.md) ──
export const FRONT_GAP = 4;        // luz entre frentes (vertical y horizontal) y, embutidos, contra la caja
export const FRONT_EDGE_GAP = 2;   // frente superpuesto: luz al borde del módulo (2 + 2 = 4 entre módulos)
export const FRONT_OFFSET = 3;     // frente superpuesto separado 3 mm de la caja → profundidad total D + 21
export const BACK3_GROOVE_FROM_BACK = 18; // ranura del fondo de 3 mm: a 18 mm del canto trasero, 5 mm de profundidad
export const SHELF_FRONT_SETBACK = 10;    // estante retirado 10 mm del frente
export const BASE_HEIGHT = 100;           // banquina, zócalo estructural o patas: se suman al alto H
export const KITCHEN_FAJA = 100;          // fajas de bajos y faja trasera de alacena
export const MICROWAVE_FLOOR_DEPTH = 420; // alacena con microondas convencional: piso de 420 mm
export const legsFor = (width: number): number => (width <= 900 ? 4 : 6);
// Alto interior de la caja de cajón (alto del lateral de 15 mm) según el alto del frente.
export const drawerBoxHeightFor = (frontH: number): number =>
    frontH < 160 ? 80 : frontH < 240 ? 120 : frontH < 340 ? 200 : 300;
// Veta: con veta → paralela al lado mayor; lisa → libre; sin dato (módulo anterior) → la de antes.
const grainOf = (hasGrain: boolean | undefined, w: number, h: number, legacy: CalculatedPart['grain']) =>
    hasGrain === undefined ? legacy : hasGrain ? (w >= h ? 'horizontal' : 'vertical') : 'free';

export const getFrontLayout = (mod: ExtendedCabinetModule) => {
      const H = mod.height || 0;
      const nDr = mod.cntDrawers || 0;
      const nFl = mod.cntFlaps || 0;
      const nDo = mod.cntDoors || 0;
      // Luz de 4 mm entre frentes. Superpuesto: 2 mm por lado al borde del módulo (frente H − 4).
      // Embutido: hueco interior H − 36 con 4 mm contra la caja (H − 44).
      const total = Math.max(0, mod.insetFronts ? H - 36 - 2 * FRONT_GAP : H - 2 * FRONT_EDGE_GAP);
      const rows = nDr + nFl + (nDo > 0 ? 1 : 0);
      const avail = Math.max(0, total - Math.max(0, rows - 1) * 4);
      const groups = (nDr > 0 ? 1 : 0) + (nFl > 0 ? 1 : 0) + (nDo > 0 ? 1 : 0);
      if (groups <= 1) {
          return { combined: false, overflow: false,
                   drawerH: nDr > 0 ? avail / nDr : 0, flapH: nFl > 0 ? avail / nFl : 0, doorH: nDo > 0 ? avail : 0 };
      }
      const userDr = nDr > 0 && (mod.drawerFrontHeight || 0) > 0 ? mod.drawerFrontHeight! : null;
      const userFl = nFl > 0 && (mod.flapFrontHeight || 0) > 0 ? mod.flapFrontHeight! : null;
      const remaining = avail - (userDr ? userDr * nDr : 0) - (userFl ? userFl * nFl : 0);
      const autoGroups = (nDr > 0 && !userDr ? 1 : 0) + (nFl > 0 && !userFl ? 1 : 0) + (nDo > 0 ? 1 : 0);
      const share = autoGroups > 0 ? Math.max(0, remaining) / autoGroups : 0;
      return {
          combined: true,
          // Los altos cargados no entran en el módulo (o no dejan lugar a las puertas)
          overflow: remaining < 0 || (nDo > 0 && share <= 0),
          drawerH: nDr > 0 ? (userDr ?? share / nDr) : 0,
          flapH:   nFl > 0 ? (userFl ?? share / nFl) : 0,
          doorH:   nDo > 0 ? share : 0,
      };
  };

// Esquinero recto: siempre 1 puerta (más el frente fijo de rincón), sin cajones ni abatibles.
export const normalizeCabinet = (mod: ExtendedCabinetModule): ExtendedCabinetModule =>
    mod.cabinetType === 'ESQUINERO' ? { ...mod, cntDoors: 1, cntDrawers: 0, cntFlaps: 0 } : mod;

export const calculateModuleParts = (rawMod: ExtendedCabinetModule): CalculatedPart[] => {
      const mod = normalizeCabinet(rawMod);
      // Módulo manual (ej. "Base hierro cromado"): NO genera placas ni tapacanto.
      // Solo aporta su costo via extras (se cuentan aparte). Sin este guard, un item
      // manual con medidas generaba un cajón de melamina fantasma (placa entera espuria).
      if ((mod as any).specialTemplateId === SPECIAL_MANUAL_ID || mod.moduleType === 'MANUAL') {
          return [];
      }
      const parts: CalculatedPart[] = [];
      const W = mod.width || 0;
      const H = mod.height || 0;
      const D = mod.depth || 0;
      const cntDrawers = mod.cntDrawers || 0;
      const cntDoors = mod.cntDoors || 0;
      const cntFlaps = mod.cntFlaps || 0;
      
      // Códigos del selector (BACKING_OPTIONS): '3MM_WHITE' | '55_COLOR' | 'NONE'.
      // '5.5MM_COLOR' se acepta como alias legacy. Antes el despiece comparaba solo contra
      // '5.5MM_COLOR', así que 'NONE' caía al else y cobraba un fondo 5.5mm inexistente,
      // y con fondo 5.5mm los laterales no se descontaban.
      const rawBacking = mod.backingType || '3MM_WHITE';
      const backingType = rawBacking === '5.5MM_COLOR' ? '55_COLOR' : rawBacking;
      
      const structCore = mod.structureCore || (mod.isMDFCore ? 'MDF' : 'AGLO');
      const frontsCore = mod.frontsCore || (mod.isMDFCore ? 'MDF' : 'AGLO');
      const isWhiteStruct = mod.isWhiteStructure;

      let carcassMat: '18mm_White' | '18mm_Color' | '18mm_MDF';
      if (structCore === 'MDF') {
          carcassMat = '18mm_MDF'; 
      } else {
          carcassMat = isWhiteStruct ? '18mm_White' : '18mm_Color';
      }

      let frontMat: '18mm_White' | '18mm_Color' | '18mm_MDF' | '18mm_MDFCrudo' | '18mm_Kiri';
      const mTypeForFront = mod.moduleType || 'MELAMINE_FULL';
      if (mTypeForFront.includes('LACQUER')) {
          // Frentes laqueados: MDF crudo 1 cara
          frontMat = '18mm_MDFCrudo';
      } else if (mTypeForFront.includes('VENEER')) {
          // Frentes enchapados: placa Kiri MDF
          frontMat = '18mm_Kiri';
      } else if (frontsCore === 'MDF') {
          frontMat = '18mm_MDF';
      } else {
          const frontName = (mod.materialFrontName || '').toLowerCase();
          const isFrontWhite = frontName
              ? (frontName.includes('blanc') || frontName.includes('white'))
              : !!mod.isWhiteStructure;
          frontMat = isFrontWhite ? '18mm_White' : '18mm_Color';
      }

      // Módulo especial: piezas pre-calculadas por el template. Los templates usan
      // materiales genéricos ('18mm_Carcass' / '18mm_Front') que acá se resuelven al
      // material real del módulo. Sin esto el motor no los reconocía: se cotizaban
      // siempre como Melamina Color (aunque el mueble fuera blanco), los escenarios no
      // los variaban y el optimizador los cortaba en placas aparte.
      if ((mod as any).isSpecialModule && (mod as any).specialParts?.length > 0) {
          return ((mod as any).specialParts as CalculatedPart[]).map(p =>
              p.material === '18mm_Carcass' ? { ...p, material: carcassMat }
            : p.material === '18mm_Front'   ? { ...p, material: frontMat }
            : p
          );
      }

      // Reglas del taller: CATALOGO_PIEZAS.md → "Ficha constructiva — Módulo estándar".
      // `frontEdge` = lado de la pieza que da al frente (largo de tapacanto), independiente de la veta.
      const sG = mod.structureHasGrain, fG = mod.frontsHaveGrain;
      const carcass = (name: string, w: number, h: number, qty: number, frontEdge: 'width' | 'height', legacyGrain: 'horizontal' | 'vertical'): CalculatedPart =>
          ({ name, width: w, height: h, material: carcassMat, quantity: qty, grain: grainOf(sG, w, h, legacyGrain), frontEdge });

      // 1. Tapa, base y laterales. Por defecto tapa y base van SOBRE los laterales; con
      //    "laterales enteros" los laterales van de piso a techo y tapa/base entre ellos.
      //    Los laterales van siempre a profundidad D (los fondos de 5,5 y 18 mm van dentro).
      const kind = mod.cabinetType;
      const isBase = kind === 'BAJO' || kind === 'ESQUINERO';
      const innerW = Math.max(0, W - 36);
      if (isBase) {
          // Bajo mesada: laterales enteros, piso entre laterales, sin tapa (va la mesada):
          // faja frontal acostada y faja trasera parada de 100 mm (fija el módulo a la pared).
          parts.push(carcass('Lateral', D, H, 2, 'height', 'vertical'));
          parts.push(carcass('Piso', innerW, D, 1, 'width', 'horizontal'));
          parts.push(carcass('Faja frontal', innerW, KITCHEN_FAJA, 1, 'width', 'horizontal'));
          parts.push(carcass('Faja trasera', innerW, KITCHEN_FAJA, 1, 'width', 'horizontal'));
      } else if (mod.fullHeightSides) {
          parts.push(carcass('Tapa superior', Math.max(0, W - 36), D, 1, 'width', 'horizontal'));
          parts.push(carcass('Base inferior', Math.max(0, W - 36), D, 1, 'width', 'horizontal'));
          parts.push(carcass('Lateral', D, H, 2, 'height', 'vertical'));
      } else {
          parts.push(carcass('Tapa superior', W, D, 1, 'width', 'horizontal'));
          // Alacena con microondas convencional: solo el piso es más profundo (420 mm).
          const baseD = kind === 'ALACENA' && mod.microwaveFloor ? Math.max(D, MICROWAVE_FLOOR_DEPTH) : D;
          parts.push(carcass('Base inferior', W, baseD, 1, 'width', 'horizontal'));
          parts.push(carcass('Lateral', D, Math.max(0, H - 36), 2, 'height', 'vertical'));
      }
      if (kind === 'ALACENA') {
          // Faja trasera superior de 100 mm, detrás del fondo, para fijar a la pared.
          parts.push(carcass('Faja trasera', innerW, KITCHEN_FAJA, 1, 'width', 'horizontal'));
      }

      // 2. Fondo
      //  - 3 mm: en ranura de 5 mm en tapa, base y laterales (a 18 mm del canto trasero),
      //    1 mm de juego por lado → (W − 28) × (H − 28).
      //  - 5,5 mm: en rebaje trasero, 5 mm hacia adentro de cada borde → (W − 10) × (H − 10).
      //  - 18 mm estructural: dentro de la caja, entre laterales y entre tapa y base → (W − 36) × (H − 36).
      let backDepth = 0; // profundidad que ocupa el fondo desde atrás (para el estante)
      //  Bajo mesada (sin tapa): el fondo llega al borde superior → 3 mm (W − 28) × (H − 14)
      //  (ranura de 5 mm en el piso, 1 mm de juego); 5,5 mm (W − 10) × (H − 5); 18 mm (W − 36) × (H − 18).
      if (backingType === '3MM_WHITE') {
          parts.push({ name: 'Fondo 3mm Blanco', width: Math.max(0, W - 28), height: Math.max(0, H - (isBase ? 14 : 28)), material: '3mm_White', quantity: 1, grain: 'vertical' });
          backDepth = BACK3_GROOVE_FROM_BACK + 3;
      } else if (backingType === '18MM_STRUCTURE') {
          parts.push(carcass('Fondo Estructural 18mm', Math.max(0, W - 36), Math.max(0, H - (isBase ? 18 : 36)), 1, 'width', 'vertical'));
          backDepth = 18;
      } else if (backingType === '55_COLOR') {
          parts.push({ name: 'Fondo 5.5mm Color', width: Math.max(0, W - 10), height: Math.max(0, H - (isBase ? 5 : 10)), material: '5.5mm_Color', quantity: 1, grain: 'vertical' });
          backDepth = 5.5;
      }
      // 'NONE' (Sin fondo): no se genera pieza.

      // 3. Estantes: 1 si H > 850 y uno más cada 350 mm. Profundidad = D − fondo − 10 mm de
      //    retiro (− 18 más con frentes embutidos). Regulables: 2 mm más angostos.
      //    Bajos: 1 estante regulable si llevan puertas (el esquinero, siempre).
      let extraShelves = 0;
      if (isBase) {
          extraShelves = cntDoors > 0 ? 1 : 0;
      } else if (H > 850) {
          extraShelves = Math.floor((H - 850) / 350) + 1;
      }
      const adjustable = mod.adjustableShelves || isBase;
      if (extraShelves > 0) {
          const shelfW = Math.max(0, W - 36 - (adjustable ? 2 : 0));
          const shelfD = Math.max(0, D - backDepth - SHELF_FRONT_SETBACK - (mod.insetFronts ? 18 : 0));
          parts.push(carcass('Estante Interno', shelfW, shelfD, extraShelves, 'width', 'horizontal'));
      }

      // 4. Frentes: luz de 4 mm entre frentes; superpuestos con 2 mm al borde del módulo,
      //    embutidos con 4 mm contra la caja.
      const frontsW = mod.insetFronts ? Math.max(0, W - 36 - 2 * FRONT_GAP) : Math.max(0, W - 2 * FRONT_EDGE_GAP);
      const layout = getFrontLayout(mod);
      const front = (name: string, w: number, h: number, qty: number): CalculatedPart =>
          ({ name, width: w, height: h, material: frontMat, quantity: qty, grain: grainOf(fG, w, h, 'horizontal') });

      if (cntDrawers > 0) {
          parts.push(front('Frente Cajón', frontsW, layout.drawerH, cntDrawers));
      }
      if (kind === 'ESQUINERO') {
          // Frente fijo de rincón = profundidad del bajo vecino + 21 + 4 de luz; la puerta, el resto.
          const fixedW = (mod.neighborDepth || D) + FRONT_OFFSET + 18 + FRONT_GAP;
          parts.push(front('Frente fijo esquinero', fixedW, layout.doorH, 1));
          parts.push(front('Puerta', Math.max(0, frontsW - fixedW - FRONT_GAP), layout.doorH, 1));
      } else if (cntDoors > 0 && layout.doorH > 0) {
          const doorW = (frontsW - (cntDoors - 1) * FRONT_GAP) / cntDoors;
          parts.push(front('Puerta', doorW, layout.doorH, cntDoors));
      }
      if (cntFlaps > 0) {
          parts.push(front('Frente Abatible', frontsW, layout.flapH, cntFlaps));
      }

      // 5. Caja de cajón (melamina blanca 15 mm). Hueco = W − 36; correderas 12,5 mm por lado →
      //    caja exterior = hueco − 25. Alto interior según el alto del frente (80/120/200/300).
      //    Largo D − 20 (− 18 más con frentes embutidos: el frente ocupa esa profundidad).
      if (cntDrawers > 0) {
          const drawerHeight = drawerBoxHeightFor(layout.drawerH);
          const boxL = Math.max(0, D - 20 - (mod.insetFronts ? 18 : 0));
          const boxOuterW = Math.max(0, W - 36 - SLIDE_GAP_TOTAL);          // W − 61
          const boxInnerW = Math.max(0, boxOuterW - 2 * DRAWER_BOX_SIDE);   // W − 91
          parts.push({ name: 'Lateral Cajón', width: boxL, height: drawerHeight, material: '15mm_White', quantity: 2 * cntDrawers, grain: 'free' });
          // FRENTE Y TRASERO: entre los laterales de la caja
          parts.push({ name: 'Contra/Frente Cajón', width: boxInnerW, height: drawerHeight, material: '15mm_White', quantity: 2 * cntDrawers, grain: 'free' });
          // FONDO: en ranura en las 4 caras → caja exterior − 4mm por lado
          parts.push({ name: 'Fondo Cajón', width: Math.max(0, boxOuterW - 2 * DRAWER_BOTTOM_INSET), height: Math.max(0, boxL - 2 * DRAWER_BOTTOM_INSET), material: '3mm_White', quantity: 1 * cntDrawers, grain: 'free' });
      }

      return parts;
  };

// Frente visible (puerta, frente de cajón, abatible): el nombre EMPIEZA con Frente/Puerta.
// Con includes(), "Contra/Frente Cajón" (pieza interior de la caja, 15mm) se tomaba como
// frente visible y llevaba tapacanto visible 45mm del color de los frentes.
export const isVisibleFrontPiece = (name: string = ''): boolean => /^(Frente|Puerta)/.test(name);

// Largo de tapacanto por pieza (mm), solo cantos vistos:
// - Frentes y puertas: los 4 cantos.
// - Caja de cajón 15mm: canto superior (el largo de la pieza).
// - Fondo estructural 18mm: canto oculto, sin tapacanto.
// - Resto (laterales, tapa, base, estantes, divisores, fajas…): canto frontal, según la
//   veta: pieza vertical → su alto; horizontal → su ancho; libre → el lado mayor.
// Fondos de 3 / 5.5mm no llevan canto (se excluyen más abajo por material).
export const visibleEdgeLength = (p: CalculatedPart): number => {
    const w = p.width || 0, h = p.height || 0;
    if (isVisibleFrontPiece(p.name)) return (w + h) * 2;
    if ((p.material || '').includes('15mm')) return w;
    if (/^Fondo/.test(p.name || '')) return 0;
    if (p.frontEdge === 'width') return w;
    if (p.frontEdge === 'height') return h;
    if (p.grain === 'vertical') return h;
    if (p.grain === 'horizontal') return w;
    return Math.max(w, h);
};

export const calculateItemQuantities = (currentModules: ExtendedCabinetModule[], scenarioOverride: Partial<CabinetModule> = {}) => {
    if (!currentModules || currentModules.length === 0) {
        return {
            boards18Color: 0, boards18White: 0, boards18MDFMelamine: 0, boards18MDF: 0,
            boards15: 0, backing55: 0, backing3: 0,
            linearWhite22: 0, linearWhite45: 0, linearColor22: 0, linearColor45: 0, linear2mm: 0,
            lacquerAreaM2: 0, veneerAreaM2: 0, lacquerGlossAreaM2: 0, veneerGlossAreaM2: 0,
            totalHinges: 0, totalPistons: 0, totalSlides: 0, totalExtrasCost: 0,
            detailedBoards: {}, detailedHardware: {}
        };
    }

    let totalBoard18ColorArea = 0; 
    let totalBoard18WhiteArea = 0; 
    let totalBoard18MDFMelamineArea = 0; 
    let totalBoard18MDFArea = 0; 
    let totalBoard15Area = 0; 
    let totalBacking55Area = 0; 
    let totalBacking3Area = 0; 
    let linearWhite22 = 0;
    let linearWhite45 = 0;
    let linearColor22 = 0;
    let linearColor45 = 0;
    let linear2mm = 0;
    let totalHinges = 0;
    let totalPistons = 0;
    let totalSlides = 0;
    let lacquerArea = 0; 
    let veneerArea = 0; 
    let lacquerGlossArea = 0; // parte de lacquerArea con terminación brillante
    let veneerGlossArea = 0;  // parte de veneerArea con terminación brillante
    let totalExtrasCost = 0;
    let totalComplexityFactor = 0;
    let totalAreaForComplexity = 0;

    const detailedMaterialsArea: Record<string, number> = {};
    const detailedHardware: Record<string, number> = {};

    currentModules.forEach(rawMod => {
        const mod = normalizeCabinet({ ...rawMod, ...scenarioOverride } as ExtendedCabinetModule);
        const qty = mod.quantity || 1;
        const parts = calculateModuleParts(mod);
        
        const h = mod.height || 0;
        const d = mod.depth || 0;
        let modHinges = 0;
        let modPistons = 0;
        let modSlides = 0;

        // Herrajes que declara el template de un módulo especial. Si el template ya
        // cuenta bisagras/guías, NO se suman además las del formulario (Puertas/Cajones)
        // para no cobrarlas dos veces.
        const sh = (mod as any).isSpecialModule ? ((mod as any).specialHardware || {}) : {};
        const templateHinges = sh.hinges > 0;
        const templateSlides = sh.slides > 0;

        if (mod.calculateHinges && !templateHinges) {
            // Con frentes combinados la puerta es más baja que el módulo: se usa su alto real.
            const fl = getFrontLayout(mod);
            const doorRefH = fl.combined ? fl.doorH : h;
            const hingesPerDoor = doorRefH > 1500 ? 4 : doorRefH > 900 ? 3 : 2;
            const doorsBuilt = (fl.combined && fl.doorH <= 0) ? 0 : (mod.cntDoors || 0); // sin lugar → no hay puertas
            modHinges += (doorsBuilt * hingesPerDoor);
            modHinges += ((mod.cntFlaps || 0) * 2);
            const hingeName = HINGE_LABELS[mod.hingeType || 'COMMON'];
            if (modHinges > 0) detailedHardware[hingeName] = (detailedHardware[hingeName] || 0) + (modHinges * qty);
        }
        if (mod.hasGasPistons) {
            modPistons += (mod.cntFlaps || 0);
            if (modPistons > 0) detailedHardware['Pistones a Gas'] = (detailedHardware['Pistones a Gas'] || 0) + (modPistons * qty);
        }
        // Tipo: el que fije el template (extraOption) o, si no, el elegido en el formulario.
        if (templateSlides) {
            const slideLen  = sh.slideLength || 500;
            const slideType = sh.slideType || mod.slideType || 'TELESCOPIC';
            const slideName = `${SLIDE_LABELS[slideType] || 'Guías'} (${slideLen}mm)`;
            detailedHardware[slideName] = (detailedHardware[slideName] || 0) + (sh.slides * qty);
            modSlides += sh.slides;
        }
        if (templateHinges) {
            const hingeName = HINGE_LABELS[sh.hingeType || mod.hingeType || 'COMMON'] || 'Bisagras Estándar';
            detailedHardware[hingeName] = (detailedHardware[hingeName] || 0) + (sh.hinges * qty);
            modHinges += sh.hinges;
        }
        // Patas regulables (base del módulo estándar): 4 hasta 900 mm de ancho, 6 a partir de ahí.
        // Las opciones del estándar no aplican a plantillas (el formulario las conserva al cambiar de tipo).
        const isStandard = !(mod as any).isSpecialModule;
        if (isStandard && mod.baseType === 'PATAS') {
            detailedHardware[LEG_LABEL] = (detailedHardware[LEG_LABEL] || 0) + (legsFor(mod.width || 0) * qty);
        }
        // Estantes regulables: 4 soportes por estante. Se cuentan pero no se cobran (costo despreciable).
        if (isStandard && (mod.adjustableShelves || mod.cabinetType === 'BAJO' || mod.cabinetType === 'ESQUINERO')) {
            const shelves = parts.filter(p => /^Estante/.test(p.name)).reduce((a, p) => a + (p.quantity || 1), 0);
            if (shelves > 0) detailedHardware[SHELF_SUPPORT_LABEL] = (detailedHardware[SHELF_SUPPORT_LABEL] || 0) + (4 * shelves * qty);
        }
        if (sh.brackets > 0) {
            const bracketName = bracketLabel(sh.bracketLength);
            detailedHardware[bracketName] = (detailedHardware[bracketName] || 0) + (sh.brackets * qty);
        }
        if (mod.calculateSlides && !templateSlides) {
            modSlides += (mod.cntDrawers || 0);
            // Con frentes embutidos la caja es 18 mm más corta: la guía se elige con esa profundidad.
            const slideLen = getStandardSlideLength(mod.insetFronts ? d - 18 : d);
            const slideName = `${SLIDE_LABELS[mod.slideType || 'TELESCOPIC']} (${slideLen}mm)`;
            if (modSlides > 0) detailedHardware[slideName] = (detailedHardware[slideName] || 0) + (modSlides * qty);
        }

        totalHinges += modHinges * qty;
        totalPistons += modPistons * qty;
        totalSlides += modSlides * qty;

        if (mod.extras) {
            mod.extras.forEach(extra => {
                totalExtrasCost += (extra.unitPrice * extra.quantity) * qty;
            });
        }

        const w = mod.width || 0;
        const frontArea = (w * h) / 1000000; 
        const sidesArea = (h * d) * 2 / 1000000; 
        const topBottomArea = (w * d) * 2 / 1000000; 
        const modArea = frontArea + sidesArea + topBottomArea;

        let modComplexity = 1.0;
        const mType = mod.moduleType || 'MELAMINE_FULL';
        if (mType.includes('LACQUER')) modComplexity = 1.3;
        else if (mType.includes('VENEER')) modComplexity = 1.5;

        totalComplexityFactor += modComplexity * modArea * qty;
        totalAreaForComplexity += modArea * qty;

        // Área de terminación según tipo + coeficiente de seguridad 1.15
        // MELAMINE_STRUCT_LACQUER/VENEER → solo frentes (W×H)
        // LACQUER_FULL / VENEER_FULL     → exterior completo (frente + laterales + techo + piso)
        const FINISH_SAFETY = 1.15;
        const visibleExteriorArea = frontArea + sidesArea + topBottomArea;
        const baseFinishArea = (mType === 'LACQUER_FULL' || mType === 'VENEER_FULL')
            ? visibleExteriorArea
            : frontArea; // MELAMINE_STRUCT → solo frente
        const finishArea = baseFinishArea * FINISH_SAFETY;

        const isGloss = (mod as any).finishSheen === 'GLOSS';
        if (mType && mType.includes('LACQUER')) {
            lacquerArea += finishArea * qty;
            if (isGloss) lacquerGlossArea += finishArea * qty;
        } else if (mType && mType.includes('VENEER')) {
            veneerArea += finishArea * qty;
            if (isGloss) veneerGlossArea += finishArea * qty;
        }

        parts.forEach(p => {
            const area = p.width * p.height * p.quantity * qty;
            // Tapacanto: solo cantos vistos (criterio del taller). Antes: perímetro completo.
            const perimeter = visibleEdgeLength(p) * p.quantity * qty;
            const isFront = isVisibleFrontPiece(p.name);

            const isTechnicalMode = Object.keys(scenarioOverride).length === 0;
            
            let currentCore = 'AGLO';
            let currentMatName = 'Melamina';

            if (isTechnicalMode) {
                currentCore = isFront ? (mod.frontsCore || 'AGLO') : (mod.structureCore || 'AGLO');
                const colorName = mod.materialColorName || (mod.isWhiteStructure ? 'Melamina Blanca' : 'Melamina Color');
                // materialFrontName es independiente de la estructura — puede ser blanca aunque estructura sea color
                const frontName = mod.materialFrontName || colorName;
                currentMatName = isFront ? frontName : colorName;
            } else {
                // En modo override, MDFCrudo y Kiri siempre son MDF
                const isSpecialMat = p.material === '18mm_MDFCrudo' || p.material === '18mm_Kiri';
                currentCore = isSpecialMat ? 'MDF' : (mod.isMDFCore ? 'MDF' : 'AGLO');
                // En modo scenario: frentes usan materialFrontName si existe, si no hereda estructura
                const frontMatName = mod.materialFrontName || '';
                const isFrontWhite = frontMatName.toLowerCase().includes('blanca') || frontMatName.toLowerCase().includes('white')
                    || (!frontMatName && mod.isWhiteStructure);
                currentMatName = isFront ? (isFrontWhite ? 'Blanco' : 'Color') : (mod.isWhiteStructure ? 'Blanco' : 'Color');
            }

            // Acumular área por tipo de material
            if      (p.material.includes('15mm'))          totalBoard15Area     += area;
            else if (p.material.includes('5.5mm'))         totalBacking55Area   += area;
            else if (p.material.includes('3mm'))           totalBacking3Area    += area;
            else if (p.material === '18mm_MDFCrudo')       totalBoard18MDFArea  += area;  // laca
            else if (p.material === '18mm_Kiri')           totalBoard18MDFArea  += area;  // enchapado
            else if (p.material.includes('Color'))         totalBoard18ColorArea += area;
            else if (p.material.includes('White'))         totalBoard18WhiteArea += area;
            else if (p.material.includes('MDF'))           totalBoard18MDFArea  += area;

            // Tapacanto: distinguir 22mm (interior) vs 45mm (visible/frentes)
            // — Frentes (Puerta, Frente*, Abatible): tapacanto visible 45mm
            // — Estructura, cajones e interiores: tapacanto interior 22mm
            // — MDFCrudo y Kiri: siempre tapacanto color visible 45mm
            // — Fondos de 3mm / 5.5mm (módulo y cajón): NO llevan tapacanto. Antes la rama
            //   0.45mm les sumaba el perímetro completo como canto interior 22mm.
            const takesEdge = p.material.includes('18mm') || p.material.includes('15mm');
            if (!takesEdge) {
                // sin tapacanto
            } else if (mod.edgeCategory === 'PVC_2MM') {
                linear2mm += perimeter;
            } else {
                const safeMatName = (currentMatName || '').toLowerCase();
                const isSpecialFront = p.material === '18mm_MDFCrudo' || p.material === '18mm_Kiri';
                // Pieza de material blanco (ej. caja de cajón 15mm blanca) → canto blanco, aunque la
                // estructura del módulo sea de color. Antes heredaba el color de la estructura.
                const isWhiteMat = !isSpecialFront && (p.material.includes('White')
                    || safeMatName.includes('blanco') || safeMatName.includes('white'));
                const isFrontPiece = isVisibleFrontPiece(p.name);
                if (isSpecialFront) {
                    // MDFCrudo/Kiri: siempre tapacanto color visible 45mm (nunca blanco)
                    linearColor45 += perimeter;
                } else if (isFrontPiece) {
                    // Frentes melamina: tapacanto visible 45mm, blanco o color según material
                    if (isWhiteMat) linearWhite45 += perimeter;
                    else            linearColor45 += perimeter;
                } else {
                    // Estructura, cajones, estantes: tapacanto interior 22mm
                    if (isWhiteMat) linearWhite22 += perimeter;
                    else            linearColor22 += perimeter;
                }
            }

            // Clave del reporte — basada en el material de la pieza, no en mType del módulo
            let reportKey = '';
            if (p.material === '18mm_MDFCrudo') {
                reportKey = `MDF Crudo (para laquear) 18mm MDF`;
            } else if (p.material === '18mm_Kiri') {
                reportKey = `Enchapado Kiri 18mm MDF`;
            } else if (p.material.includes('18mm') || (p.material.includes('MDF') && !p.material.includes('3mm'))) {
                // El material '18mm_MDF' no codifica blanco/color: se infiere del contexto
                // (currentMatName) para no cobrar siempre Color MDF a una estructura blanca.
                const ctxIsWhite = (currentMatName || '').toLowerCase().includes('blanc')
                                || (currentMatName || '').toLowerCase().includes('white');
                const isWhitePiece = p.material.includes('White') || p.material === '18mm_White'
                                || (p.material === '18mm_MDF' && ctxIsWhite);
                const matLabel = isWhitePiece ? 'Melamina Blanca' : 'Melamina Color';
                const displayCore = currentCore === 'AGLO' ? 'MDP' : 'MDF';
                reportKey = `${matLabel} 18mm ${displayCore}`;
            }
            else if (p.material.includes('15mm'))  reportKey = 'Melamina Blanca 15mm MDP';
            else if (p.material.includes('5.5mm')) reportKey = `Fondo ${currentMatName} (5.5mm)`;
            else if (p.material.includes('3mm'))   reportKey = 'Fondo Blanco (3mm)';

            if (reportKey) {
                detailedMaterialsArea[reportKey] = (detailedMaterialsArea[reportKey] || 0) + area;
            }
        });
    });

    const SHEET_AREA = 2750 * 1830;
    
    const detailedBoards: Record<string, number> = {};
    Object.entries(detailedMaterialsArea).forEach(([name, area]) => {
        detailedBoards[name] = Math.ceil(area * 1.2 / getSheetArea(name)); // placas enteras por material (con 20% de desperdicio)
    });

    return {
        boards18Color: Math.ceil(totalBoard18ColorArea * 1.2 / SHEET_AREA),
        boards18White: Math.ceil(totalBoard18WhiteArea * 1.2 / SHEET_AREA),
        boards18MDFMelamine: Math.ceil(totalBoard18MDFMelamineArea * 1.2 / SHEET_AREA),
        boards18MDF: Math.ceil(totalBoard18MDFArea * 1.2 / SHEET_AREA),
        boards15: Math.ceil(totalBoard15Area * 1.2 / SHEET_AREA),
        backing55: Math.ceil(totalBacking55Area * 1.1 / getSheetArea('5.5mm')),
        backing3: Math.ceil(totalBacking3Area * 1.1 / SHEET_AREA),
        linearWhite22: Math.ceil(linearWhite22 / 1000),
        linearWhite45: Math.ceil(linearWhite45 / 1000),
        linearColor22: Math.ceil(linearColor22 / 1000),
        linearColor45: Math.ceil(linearColor45 / 1000),
        linear2mm: Math.ceil(linear2mm / 1000),
        lacquerAreaM2: Math.round(lacquerArea * 100) / 100,  // ya está en m²
        veneerAreaM2:  Math.round(veneerArea  * 100) / 100,  // ya está en m²
        lacquerGlossAreaM2: Math.round(lacquerGlossArea * 100) / 100,
        veneerGlossAreaM2:  Math.round(veneerGlossArea  * 100) / 100,
        totalHinges, totalPistons, totalSlides, totalExtrasCost,
        // Report Details
        detailedBoards,
        detailedHardware,
        avgComplexity: parseFloat((totalAreaForComplexity > 0 ? totalComplexityFactor / totalAreaForComplexity : 1.0).toFixed(2))
    };
};

// ─────────────────────────────────────────────────────────────
// MOTOR ÚNICO DE COSTOS — fuente de verdad financiera
// ─────────────────────────────────────────────────────────────
// boardPriceFor / hwPriceFor: lookups únicos de precio por nombre.
// computeItemFinancials: construye costo directo / precio taller / precio final
// para una config. override=null => CONFIG REAL del módulo (cores reales, mezcla
// MDP+MDF, etc.). override={...} => escenario forzado (las 14 terminaciones).
// SIEMPRE incluye extras y fijos, de forma idéntica en planilla, comparativa y
// presupuesto, para que las tres rutas no puedan divergir.
// ─────────────────────────────────────────────────────────────

export const boardPriceFor = (name: string, count: number, S: any): number => {
    const n = name.toLowerCase();
    let p = S.priceBoard18WhiteAglo || 0;
    if      (n.includes('trupan') || n.includes('5.5'))        p = S.priceBacking55Color       || 0;
    else if (n.includes('fondo') && n.includes('3'))           p = S.priceBacking3White         || 0;
    else if (n.includes('15mm'))                               p = S.priceBoard15WhiteAglo      || 0;
    else if (n.includes('laquear') || n.includes('crudo'))     p = S.priceBoard18MDFCrudo1Face  || 0;
    else if (n.includes('kiri') || n.includes('veneer'))       p = S.priceBoard18VeneerMDF      || 0;
    else if (n.includes('color') && n.includes('mdf'))         p = S.priceBoard18ColorMDF       || 0;
    else if (n.includes('color'))                              p = S.priceBoard18ColorAglo      || 0;
    else if (n.includes('blanca') && n.includes('mdf'))        p = S.priceBoard18WhiteMDF       || 0;
    return p * count;
};

export const hwPriceFor = (name: string, qty: number, S: any): number => {
    const n = name.toLowerCase();
    let unitPrice = 0;
    if      (n.includes('estándar') || n.includes('standard'))      unitPrice = S.priceHingeStandard || 0;
    else if (n.includes('cierre suave') && n.includes('bisag'))     unitPrice = S.priceHingeSoftClose || 0;
    else if (n.includes('push') && n.includes('bisag'))             unitPrice = S.priceHingePush || 0;
    else if (n.includes('pistón') || n.includes('piston'))          unitPrice = S.priceGasPiston || 0;
    else if (n.includes('guías') || n.includes('guia')) unitPrice = resolveSlidePrice(name, S).price;
    else if (n.includes('pata regulable'))                          unitPrice = S.priceLeg || 0;
    else if (n.includes('ménsula'))                                 unitPrice = (n.includes('25cm') ? S.priceFloatingBracket25 : S.priceFloatingBracket15) || 0;
    return unitPrice * qty;
};

// ── Precio de guías ──
// Clave en la lista: priceSlide{300|400|500|600}{Std|Soft|Push|Z|Hidden}.
// Fallbacks (siempre hacia lo que se cobraba antes, nunca a 0 si hay alternativa):
//  - 600mm sin precio → el de 500 del mismo tipo.
//  - Z (epoxi) / Ocultas sin precio → telescópica estándar del mismo largo.
// `fallback` describe el reemplazo para que la planilla lo advierta.
export const SLIDE_KIND_LABEL: Record<string, string> = { Std: 'telescópica estándar', Soft: 'cierre suave', Push: 'push', Z: 'Z (epoxi)', Hidden: 'oculta' };
export const resolveSlidePrice = (name: string, S: any): { price: number; fallback: string | null } => {
    const n = name.toLowerCase();
    const len = parseInt(name.match(/\((\d+)mm\)/)?.[1] || '300');
    const tier = len <= 300 ? 300 : len <= 400 ? 400 : len <= 500 ? 500 : 600;
    const kind = n.includes('suave') ? 'Soft' : n.includes('push') ? 'Push'
               : n.includes('epoxi') ? 'Z' : n.includes('oculta') ? 'Hidden' : 'Std';
    const candidates: Array<[number, string]> = [[tier, kind]];
    if (tier === 600) candidates.push([500, kind]);
    if (kind === 'Z' || kind === 'Hidden') {
        candidates.push([tier, 'Std']);
        if (tier === 600) candidates.push([500, 'Std']);
    }
    for (const [t, k] of candidates) {
        const v = S[`priceSlide${t}${k}`] || 0;
        if (v > 0) {
            const fallback = (t === tier && k === kind) ? null
                : `sin precio de guía ${SLIDE_KIND_LABEL[kind]} ${tier}mm en la lista: se usó ${SLIDE_KIND_LABEL[k]} ${t}mm`;
            return { price: v, fallback };
        }
    }
    return { price: 0, fallback: null };
};

// Líneas de terminación a partir de las áreas de calculateItemQuantities.
// Brillante sin precio en la lista → se usa semi mate (lo que se cobraba antes) y se avisa.
export type FinishLine = { label: string; area: number; price: number; total: number; fallback: string | null };
export const buildFinishLines = (q: any, S: any): FinishLine[] => {
    const lines: FinishLine[] = [];
    const add = (kind: 'Lacquer' | 'Lustre', gloss: boolean, rawArea: number) => {
        const area = Math.round(Math.max(0, rawArea) * 100) / 100;
        if (area <= 0) return;
        const semi = S[`priceFinish${kind}Semi`] || 0;
        const glossPrice = S[`priceFinish${kind}Gloss`] || 0;
        const price = gloss ? (glossPrice > 0 ? glossPrice : semi) : semi;
        const name = kind === 'Lacquer' ? 'Laca' : 'Lustre (enchapado Kiri)';
        lines.push({
            label: `${name} ${gloss ? 'Brillante' : 'Semi Mate'}`,
            area, price, total: area * price,
            fallback: gloss && !(glossPrice > 0) ? 'sin precio brillante en la lista: se usó semi mate' : null,
        });
    };
    add('Lacquer', false, (q.lacquerAreaM2 || 0) - (q.lacquerGlossAreaM2 || 0));
    add('Lacquer', true,  q.lacquerGlossAreaM2 || 0);
    add('Lustre',  false, (q.veneerAreaM2 || 0) - (q.veneerGlossAreaM2 || 0));
    add('Lustre',  true,  q.veneerGlossAreaM2 || 0);
    return lines;
};

// Texto de terminación de frentes para descripciones (presupuesto / insumos).
export const finishDescription = (modules: any[] = []): string | null => {
    const sheenOf = (kind: string) => {
        const ms = modules.filter((m: any) => (m.moduleType || '').includes(kind));
        if (ms.length === 0) return null;
        const g = ms.some((m: any) => m.finishSheen === 'GLOSS');
        const sm = ms.some((m: any) => m.finishSheen !== 'GLOSS');
        return g && sm ? 'Semi Mate / Brillante' : g ? 'Brillante' : 'Semi Mate';
    };
    const lac = sheenOf('LACQUER');
    const ven = sheenOf('VENEER');
    const parts = [
        lac ? `Laca ${lac}` : null,
        ven ? `Enchapado Kiri${ven === 'Semi Mate' ? '' : ` (${ven})`}` : null,
    ].filter(Boolean);
    return parts.length ? `Frentes ${parts.join(' + ')}` : null;
};

// Devuelve el desglose completo y los precios de una config.
// override === null  → config REAL (technical mode, sin forzar cores)
// override === {...}  → escenario forzado
export const computeItemFinancials = (item: any, snapshot: any, override: Partial<CabinetModule> | null) => {
    const S: any = snapshot;
    const modules = item?.modules || [];
    const margins = item?.margins || { workshop: 35, roden: 0 };
    const laborCost  = (item?.labor?.workers || 1) * (item?.labor?.days || 1) * (S.costLaborDay || 0);
    const fixedCosts = (S.priceScrews || 0) + (S.priceGlueTin || 0);
    const extrasCost = sumModuleExtras(modules);

    // Cantidades: override=null → sin override (config real); si no, escenario forzado.
    const q = override ? calculateItemQuantities(modules, override) : calculateItemQuantities(modules);

    // Terminación: una línea por (laca | lustre) × (semi | brillante). Antes se cobraba una
    // sola: si el ítem mezclaba laca y enchapado solo se cobraba la laca, y el brillante
    // nunca se usaba.
    const finishLines = buildFinishLines(q, S);
    const finArea  = finishLines.reduce((a, l) => a + l.area, 0);

    const tPlacas  = Object.entries(q.detailedBoards).filter(([, v]) => (v as number) > 0)
        .reduce((a, [n, c]) => a + boardPriceFor(n, c as number, S), 0);
    const tTapac   = (q.linearWhite22 * (S.priceEdge22White045 || 0)) + (q.linearWhite45 * (S.priceEdge45White045 || 0))
                   + (q.linearColor22 * (S.priceEdge22Color045 || 0)) + (q.linearColor45 * (S.priceEdge45Color045 || 0))
                   + (q.linear2mm * (S.priceEdge2mm || 0));
    const tHerrajes = Object.entries(q.detailedHardware)
        .reduce((a, [n, hqty]) => a + hwPriceFor(n, hqty as number, S), 0);
    const tFinish  = finishLines.reduce((a, l) => a + l.total, 0);
    const finPrice = finArea > 0 ? tFinish / finArea : 0; // promedio, solo informativo

    const costoDirecto = tPlacas + tTapac + tHerrajes + extrasCost + fixedCosts + tFinish + laborCost;
    const precioTaller = costoDirecto * (1 + (margins.workshop ?? 35) / 100);
    const precioFinal  = precioTaller * (1 + (margins.roden ?? 0) / 100);

    return { q, laborCost, fixedCosts, extrasCost, tPlacas, tTapac, tHerrajes, tFinish,
             finArea, finPrice, finishLines, costoDirecto, precioTaller, precioFinal };
};


// Etiqueta de placa para corte: una placa física distinta = una etiqueta distinta.
// Única fuente para el optimizador y la planilla de cortes. Antes:
// - el optimizador rotulaba TODO 18mm_MDF como "Melamina Blanca MDF" (mezclaba blanco y color)
//   y nombraba los frentes con el color de la estructura;
// - la planilla juntaba MDP y MDF del mismo color y mandaba el Kiri a "Otros".
export const getBoardLabel = (mod: any, part: CalculatedPart): string => {
    const m = part.material || '';
    if (m === '18mm_MDFCrudo') return 'MDF Crudo 1 Cara 18mm (para laquear)';
    if (m === '18mm_Kiri')     return 'Enchapado Kiri 18mm MDF';
    if (m.includes('15mm'))    return 'Melamina Blanca 15mm (cajón)';
    if (m.includes('5.5mm') || m.includes('55mm')) return 'Fondo Color 5.5mm';
    if (m.includes('3mm'))     return 'Fondo Blanco 3mm';
    // Melamina 18mm: color según material (White/Color) o, en MDF, según el nombre / estructura
    const isFront = isVisibleFrontPiece(part.name);
    const named = String((isFront ? (mod.materialFrontName || mod.materialColorName) : mod.materialColorName) || '').trim();
    const namedIsWhite = /blanc|white/i.test(named);
    const isWhite = m.includes('White') ? true
                  : m.includes('Color') ? false
                  : (named ? namedIsWhite : !!mod.isWhiteStructure);
    // El nombre cargado solo se usa si es coherente con el material y no es genérico
    const generic = !named || /^melamina (blanca|color)$/i.test(named) || /^(laqueado|enchapado kiri)$/i.test(named);
    const colorName = (!generic && namedIsWhite === isWhite) ? named : (isWhite ? 'Melamina Blanca' : 'Melamina Color');
    const core = m === '18mm_MDF' ? 'MDF' : 'MDP';
    return `${colorName} 18mm ${core}`;
};


export const getRecalculatedItemPrices = (item: EstimatorItem, snapshot: CostSettings) => {
    // Guard: item puede venir de Supabase con estructura incompleta
    if (!item?.labor || !item?.margins || !item?.modules) {
        return { whiteAglo: 0, whiteMDF: 0, colorAglo: 0, colorMDF: 0, whiteLacqAglo: 0, whiteLacqMDF: 0, colorLacqAglo: 0, colorLacqMDF: 0, whiteVenrAglo: 0, whiteVenrMDF: 0, colorVenrAglo: 0, colorVenrMDF: 0, baseConfig: 0, totalDirectCost: 0, realConfig: 0, realConfigTaller: 0, realConfigDirect: 0, lacquer: 0, veneer: 0 };
    }

    // Ítem manual: devolver precios originales sin recalcular con escenarios de materiales
    const isManual = (item as any).isManualItem ||
        item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);
    if (isManual) {
        const p = item.scenarioPrices?.colorAglo || (item as any).details?.manualPrecioFinal || 0;
        const taller = item.scenarioPrices?.baseConfig || (item as any).details?.manualPrecioTaller || 0;
        const directCost = (item.details?.totalMaterialCostBase || 0) + (item.details?.totalHardwareCost || 0);
        return { whiteAglo: p, whiteMDF: p, colorAglo: p, colorMDF: p,
                 whiteLacqAglo: p, whiteLacqMDF: p, colorLacqAglo: p, colorLacqMDF: p,
                 whiteVenrAglo: p, whiteVenrMDF: p, colorVenrAglo: p, colorVenrMDF: p,
                 baseConfig: taller, totalDirectCost: directCost,
                 realConfig: p, realConfigTaller: taller, realConfigDirect: directCost,
                 lacquer: p, veneer: p };
    }

    // ── Motor único: computeItemFinancials para cada escenario ──
    // Cada escenario fuerza cores; realConfig usa los cores reales del módulo (override=null).
    const scen = (override: Partial<CabinetModule>) => computeItemFinancials(item, snapshot, override);
    const real = computeItemFinancials(item, snapshot, null);

    const whiteAglo     = scen({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'AGLO' });
    const whiteMDF      = scen({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF'  });
    const colorAglo     = scen({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'AGLO' });
    const colorMDF      = scen({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF'  });
    const whiteLacqAglo = scen({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
    const whiteLacqMDF  = scen({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
    const colorLacqAglo = scen({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
    const colorLacqMDF  = scen({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
    const whiteVenrAglo = scen({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
    const whiteVenrMDF  = scen({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
    const colorVenrAglo = scen({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
    const colorVenrMDF  = scen({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });

    return {
        whiteAglo:     whiteAglo.precioFinal,
        whiteMDF:      whiteMDF.precioFinal,
        colorAglo:     colorAglo.precioFinal,
        colorMDF:      colorMDF.precioFinal,
        whiteLacqAglo: whiteLacqAglo.precioFinal,
        whiteLacqMDF:  whiteLacqMDF.precioFinal,
        colorLacqAglo: colorLacqAglo.precioFinal,
        colorLacqMDF:  colorLacqMDF.precioFinal,
        whiteVenrAglo: whiteVenrAglo.precioFinal,
        whiteVenrMDF:  whiteVenrMDF.precioFinal,
        colorVenrAglo: colorVenrAglo.precioFinal,
        colorVenrMDF:  colorVenrMDF.precioFinal,
        baseConfig:    colorAglo.precioFinal,
        totalDirectCost: colorAglo.costoDirecto,
        // ── Config REAL del módulo (cores reales, mezcla MDP+MDF, etc.) ──
        // El presupuesto y el recuadro principal de la planilla usan esto.
        realConfig:        real.precioFinal,
        realConfigTaller:  real.precioTaller,
        realConfigDirect:  real.costoDirecto,
        // Aliases para compatibilidad con render del presupuesto
        lacquer: whiteLacqAglo.precioFinal,
        veneer:  whiteVenrAglo.precioFinal,
    };
};

// Precios de escenario que se guardan en el ítem al crearlo (o al cambiar sus módulos desde el
// constructor 3D). Antes estaba inline en handleCreateItem; se centraliza para no duplicarlo.
export const scenarioPricesFromRecalc = (rp: ReturnType<typeof getRecalculatedItemPrices>): any => ({
    whiteAglo:     rp.whiteAglo,
    whiteMDF:      rp.whiteMDF,
    colorAglo:     rp.colorAglo,
    colorMDF:      rp.colorMDF,
    whiteLacqAglo: rp.whiteLacqAglo,
    whiteLacqMDF:  rp.whiteLacqMDF,
    colorLacqAglo: rp.colorLacqAglo,
    colorLacqMDF:  rp.colorLacqMDF,
    whiteVenrAglo: rp.whiteVenrAglo,
    whiteVenrMDF:  rp.whiteVenrMDF,
    colorVenrAglo: rp.colorVenrAglo,
    colorVenrMDF:  rp.colorVenrMDF,
    baseConfig: rp.colorAglo,
    lacquer: rp.lacquer,
    veneer:  rp.veneer,
});
export const detailsFromRecalc = (rp: ReturnType<typeof getRecalculatedItemPrices>): any => ({
    totalHardwareCost: (rp as any).totalDirectCost,
    totalMaterialCostBase: 0,
});

