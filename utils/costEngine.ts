import { 
  CostModule, 
  Layer1_Technical, 
  Layer3_TechnicalCost, 
  Layer4_Commercial, 
  CostSnapshot, 
  CommercialConfig,
  MaterialConfig,
  ModuleGeometry,
  ModuleComponents,
  CalculatedPart
} from '../types';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const SHEET_AREA_18MM  = 2750 * 1830; // mm² — Faplac estándar
const SHEET_AREA_15MM  = 2750 * 1830; // mm² — Faplac 15mm
const SHEET_AREA_3MM   = 2750 * 1830; // mm² — Fondo MDF 3mm
const SHEET_AREA_55MM  = 2600 * 1830; // mm² — Trupan 5.5mm (distinto!)

// Factores de desperdicio diferenciados por material
const WASTE = {
  board18:  1.20, // Placas estructurales 18mm
  board15:  1.20, // Placas cajones 15mm
  backing3: 1.10, // Fondo 3mm
  backing55:1.10, // Fondo Trupan 5.5mm
  veneer:   1.25, // Enchapado Kiri
};

// ─────────────────────────────────────────────────────────────
// GEOMETRÍA BOTTOM-UP — pieza por pieza
// Esta es la única fuente de verdad de geometría en el sistema.
// ─────────────────────────────────────────────────────────────

export const calculateModuleParts = (
  geometry: ModuleGeometry,
  components: ModuleComponents,
  backingType: '3MM_WHITE' | '55_COLOR' | 'NONE' = '3MM_WHITE'
): CalculatedPart[] => {
  const parts: CalculatedPart[] = [];
  const { width: W, height: H, depth: D } = geometry;
  const { doors, drawers, flaps } = components;

  // Profundidad lateral: si el fondo es 5.5mm estructural, el lateral se acorta
  const lateralDepth = (backingType === '55_COLOR') ? D - 18 : D;

  // 1. Tapa y base
  parts.push({ name: 'Tapa superior',  width: W, height: D,            material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
  parts.push({ name: 'Base inferior',  width: W, height: D,            material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });

  // 2. Laterales
  parts.push({ name: 'Lateral',        width: lateralDepth, height: H, material: '18mm_Carcass', quantity: 2, grain: 'vertical' });

  // 3. Fondo
  if (backingType === '3MM_WHITE') {
    parts.push({ name: 'Fondo 3mm',    width: Math.max(0, W - 36), height: Math.max(0, H - 38), material: '3mm_White',   quantity: 1, grain: 'vertical' });
  } else if (backingType === '55_COLOR') {
    parts.push({ name: 'Fondo 5.5mm',  width: Math.max(0, W - 36), height: Math.max(0, H - 18), material: '55mm_Color',  quantity: 1, grain: 'vertical' });
  }
  // NONE → sin fondo

  // 4. Estantes internos automáticos (1 cada 350mm sobre los primeros 850mm)
  let extraShelves = 0;
  if (H > 850) extraShelves = Math.floor((H - 850) / 350) + 1;
  if (extraShelves > 0) {
    parts.push({ name: 'Estante interno', width: Math.max(0, W - 36), height: Math.max(0, D - 45), material: '18mm_Carcass', quantity: extraShelves, grain: 'horizontal' });
  }

  // 5. Frentes (puertas, abatibles)
  const frontWidth  = Math.max(0, W - 6);
  const frontHeight = Math.max(0, H - 6);

  if (doors > 0) {
    const doorWidth = doors >= 2 ? (W - 10) / doors : frontWidth;
    parts.push({ name: 'Puerta', width: doorWidth, height: frontHeight, material: '18mm_Front', quantity: doors, grain: 'vertical' });
  }
  if (flaps > 0) {
    const gaps      = (flaps - 1) * 4;
    const flapHeight = (frontHeight - gaps) / flaps;
    parts.push({ name: 'Frente abatible', width: frontWidth, height: flapHeight, material: '18mm_Front', quantity: flaps, grain: 'horizontal' });
  }

  // 6. Cajones — frentes + caja interna
  if (drawers > 0) {
    const gaps         = (drawers - 1) * 4;
    const drawerFrontH = (frontHeight - gaps) / drawers;
    parts.push({ name: 'Frente cajón',       width: frontWidth,           height: drawerFrontH,           material: '18mm_Front',  quantity: drawers, grain: 'horizontal' });
    parts.push({ name: 'Lateral cajón',      width: Math.max(0, D - 20),  height: 120,                   material: '15mm_White',  quantity: drawers * 2, grain: 'free' });
    parts.push({ name: 'Contra/frente cajón',width: Math.max(0, W - 26),  height: 120,                   material: '15mm_White',  quantity: drawers * 2, grain: 'free' });
    parts.push({ name: 'Fondo cajón',        width: Math.max(0, W - 26),  height: Math.max(0, D - 20),   material: '3mm_White',   quantity: drawers,     grain: 'free' });
  }

  return parts;
};

// ─────────────────────────────────────────────────────────────
// CAPA 1 — derivada desde piezas reales (bottom-up)
// ─────────────────────────────────────────────────────────────

export const calculateLayer1 = (
  geometry: ModuleGeometry,
  components: ModuleComponents,
  backingType: '3MM_WHITE' | '55_COLOR' | 'NONE' = '3MM_WHITE'
): Layer1_Technical => {
  const parts = calculateModuleParts(geometry, components, backingType);
  const { width: W, height: H, depth: D } = geometry;
  const { doors, drawers, flaps } = components;

  // Superficies desde piezas reales
  let surfaceBodyMM2  = 0;
  let surfaceFrontsMM2 = 0;

  parts.forEach(p => {
    const area = p.width * p.height * p.quantity;
    const isFront = p.name.includes('Frente') || p.name.includes('Puerta') || p.name.includes('abatible');
    if (isFront) surfaceFrontsMM2 += area;
    else         surfaceBodyMM2   += area;
  });

  // Metros lineales de canto — perímetro de todas las piezas 18mm visibles
  let linearEdgesMM = 0;
  parts.forEach(p => {
    if (p.material === '18mm_Carcass' || p.material === '18mm_Front') {
      linearEdgesMM += (p.width + p.height) * 2 * p.quantity;
    }
  });

  // Días base de mano de obra
  const baseLaborDays = 0.5
    + (drawers * 0.10)
    + (doors   * 0.05)
    + (flaps   * 0.08);

  return {
    surfaceBodyM2:  parseFloat((surfaceBodyMM2  / 1_000_000).toFixed(3)),
    surfaceFrontsM2:parseFloat((surfaceFrontsMM2 / 1_000_000).toFixed(3)),
    linearEdgesM:   parseFloat((linearEdgesMM   / 1_000).toFixed(2)),
    baseLaborDays:  parseFloat(baseLaborDays.toFixed(2))
  };
};

// ─────────────────────────────────────────────────────────────
// CAPA 2 — Validación de reglas de material
// ─────────────────────────────────────────────────────────────

export const validateLayer2 = (
  config: MaterialConfig
): { isValid: boolean; adjustedConfig: MaterialConfig; warning?: string } => {
  const adjusted = { ...config };
  const isLacquer = config.frontsMaterial.toLowerCase().includes('laqueado');
  const isVeneer  = config.frontsMaterial.toLowerCase().includes('enchapado')
                 || config.frontsMaterial.toLowerCase().includes('lustre');

  if ((isLacquer || isVeneer) && adjusted.frontsCore !== 'MDF') {
    adjusted.frontsCore = 'MDF';
    return {
      isValid: false,
      adjustedConfig: adjusted,
      warning: 'Acabado laqueado/enchapado requiere base MDF. Ajustado automáticamente.'
    };
  }

  return { isValid: true, adjustedConfig: adjusted };
};

// ─────────────────────────────────────────────────────────────
// HELPERS — precio de placa según material y core
// ─────────────────────────────────────────────────────────────

const getPriceBody = (config: MaterialConfig, snapshot: CostSnapshot): number => {
  const isWhite = config.bodyMaterial.toLowerCase().includes('blanca')
               || config.bodyMaterial.toLowerCase().includes('white');
  if (config.structureCore === 'MDF') {
    return isWhite ? snapshot.priceBoard18WhiteMDF : snapshot.priceBoard18ColorMDF;
  }
  return isWhite ? snapshot.priceBoard18WhiteAglo : snapshot.priceBoard18ColorAglo;
};

const getPriceFront = (config: MaterialConfig, snapshot: CostSnapshot): number => {
  const isLacquer = config.frontsMaterial.toLowerCase().includes('laqueado');
  const isVeneer  = config.frontsMaterial.toLowerCase().includes('enchapado')
                 || config.frontsMaterial.toLowerCase().includes('lustre');
  const isWhite   = config.frontsMaterial.toLowerCase().includes('blanca')
                 || config.frontsMaterial.toLowerCase().includes('white');

  if (isLacquer) return snapshot.priceBoard18MDFCrudo1Face;
  if (isVeneer)  return snapshot.priceBoard18VeneerMDF;
  if (config.frontsCore === 'MDF') {
    return isWhite ? snapshot.priceBoard18WhiteMDF : snapshot.priceBoard18ColorMDF;
  }
  return isWhite ? snapshot.priceBoard18WhiteAglo : snapshot.priceBoard18ColorAglo;
};

// ─────────────────────────────────────────────────────────────
// CAPA 3 — Costo técnico (opera sobre piezas reales)
// ─────────────────────────────────────────────────────────────

export const calculateLayer3 = (
  layer1: Layer1_Technical,
  geometry: ModuleGeometry,
  materialConfig: MaterialConfig,
  components: ModuleComponents,
  snapshot: CostSnapshot,
  complexityFactor: number = 1.0,
  backingType: '3MM_WHITE' | '55_COLOR' | 'NONE' = '3MM_WHITE'
): Layer3_TechnicalCost => {

  const parts = calculateModuleParts(geometry, components, backingType);

  // ── 1. COSTO MATERIALES ──────────────────────────────────

  const priceBody  = getPriceBody(materialConfig, snapshot);
  const priceFront = getPriceFront(materialConfig, snapshot);
  const isVeneer   = materialConfig.frontsMaterial.toLowerCase().includes('enchapado')
                  || materialConfig.frontsMaterial.toLowerCase().includes('lustre');

  let costBody    = 0;
  let costFronts  = 0;
  let costBacking = 0;
  let costCajonBox = 0;

  parts.forEach(p => {
    const areaMM2 = p.width * p.height * p.quantity;
    const areaM2  = areaMM2 / 1_000_000;

    switch (p.material) {
      case '18mm_Carcass':
        costBody    += areaM2 * priceBody  * WASTE.board18;
        break;
      case '18mm_Front':
        costFronts  += areaM2 * priceFront * (isVeneer ? WASTE.veneer : WASTE.board18);
        break;
      case '3mm_White':
        costBacking += areaM2 * snapshot.priceBacking3White  * WASTE.backing3;
        break;
      case '55mm_Color':
        costBacking += areaM2 * snapshot.priceBacking55Color * WASTE.backing55;
        break;
      case '15mm_White':
        costCajonBox += areaM2 * snapshot.priceBoard15WhiteAglo * WASTE.board15;
        break;
    }
  });

  // ── 2. TAPACANTO ────────────────────────────────────────
  // Estándar: 29mm (0.45×29). Blanco si la estructura es blanca, color en el resto.
  let priceEdge: number;
  if (materialConfig.edgeType === 'PVC_2MM') {
    priceEdge = snapshot.priceEdge2mm;
  } else {
    const bodyIsWhite = materialConfig.bodyMaterial.toLowerCase().includes('blanca')
                     || materialConfig.bodyMaterial.toLowerCase().includes('white');
    priceEdge = bodyIsWhite ? snapshot.priceEdge45White045 : snapshot.priceEdge45Color045;
  }
  const costEdges = layer1.linearEdgesM * priceEdge;

  const costMaterials = costBody + costFronts + costBacking + costCajonBox + costEdges;

  // ── 3. ACABADOS ─────────────────────────────────────────
  let costFinish = 0;
  const isLacquer = materialConfig.frontsMaterial.toLowerCase().includes('laqueado');
  if (isLacquer) costFinish = layer1.surfaceFrontsM2 * snapshot.priceFinishLacquerSemi;
  else if (isVeneer) costFinish = layer1.surfaceFrontsM2 * snapshot.priceFinishLustreSemi;

  // ── 4. HERRAJES ─────────────────────────────────────────
  let costHardware = 0;

  // Bisagras: 2 hasta 800mm, +1 cada 300mm adicionales
  let priceHinge = snapshot.priceHingeStandard;
  if (components.hingeType === 'SOFT_CLOSE') priceHinge = snapshot.priceHingeSoftClose;
  if (components.hingeType === 'PUSH')       priceHinge = snapshot.priceHingePush;

  const hingesPerDoor = geometry.height <= 800  ? 2
                      : geometry.height <= 1100 ? 3
                      : 4;
  const hingeCount = (components.doors * hingesPerDoor) + (components.flaps * 2);
  costHardware += hingeCount * priceHinge;

  // Guías telescópicas — largo por profundidad
  const depth = geometry.depth;
  let slideLength: 300 | 400 | 500 = 500;
  if (depth < 400) slideLength = 300;
  else if (depth < 500) slideLength = 400;

  let priceSlide: number;
  if (slideLength === 300) {
    priceSlide = components.slideType === 'TELESCOPIC_SOFT' ? snapshot.priceSlide300Soft
               : components.slideType === 'TELESCOPIC_PUSH' ? snapshot.priceSlide300Push
               : snapshot.priceSlide300Std;
  } else if (slideLength === 400) {
    priceSlide = components.slideType === 'TELESCOPIC_SOFT' ? snapshot.priceSlide400Soft
               : components.slideType === 'TELESCOPIC_PUSH' ? snapshot.priceSlide400Push
               : snapshot.priceSlide400Std;
  } else {
    priceSlide = components.slideType === 'TELESCOPIC_SOFT' ? snapshot.priceSlide500Soft
               : components.slideType === 'TELESCOPIC_PUSH' ? snapshot.priceSlide500Push
               : snapshot.priceSlide500Std;
  }
  costHardware += components.drawers * priceSlide;

  // Pistones
  if (components.hasGasPistons) {
    costHardware += components.flaps * snapshot.priceGasPiston;
  }

  // NOTA: tornillería y cemento de contacto se suman a nivel Item, NO por módulo.

  // ── 5. MANO DE OBRA ─────────────────────────────────────
  let factorFinish = 1.0;
  if (isLacquer) factorFinish = 1.3;
  else if (isVeneer) factorFinish = 1.5;

  const totalSurface = layer1.surfaceBodyM2 + layer1.surfaceFrontsM2;
  const factorGlobal = totalSurface > 0
    ? ((layer1.surfaceBodyM2 * 1.0) + (layer1.surfaceFrontsM2 * factorFinish)) / totalSurface
    : 1.0;

  const realLaborDays = layer1.baseLaborDays * factorGlobal * complexityFactor;
  const costLabor     = realLaborDays * snapshot.costLaborDay;

  const totalDirectCost = costMaterials + costFinish + costHardware + costLabor;

  return {
    costMaterials,
    costHardware,
    costLabor,
    costFinish,
    totalDirectCost,
    complexityFactor: parseFloat((factorGlobal * complexityFactor).toFixed(3)),
    realLaborDays:    parseFloat(realLaborDays.toFixed(2))
  };
};

// ─────────────────────────────────────────────────────────────
// CAPA 4 — Comercial (márgenes)
// ─────────────────────────────────────────────────────────────

export const calculateLayer4 = (
  layer3: Layer3_TechnicalCost,
  commercial: CommercialConfig
): Layer4_Commercial => {
  const priceWorkshop = layer3.totalDirectCost * (1 + commercial.marginWorkshop / 100);
  const finalPrice    = priceWorkshop           * (1 + commercial.marginCommercial / 100);

  return {
    priceWorkshop,
    grossMarginValue: finalPrice - layer3.totalDirectCost,
    finalPrice
  };
};

// ─────────────────────────────────────────────────────────────
// ORQUESTADOR
// ─────────────────────────────────────────────────────────────

export const calculateModuleFull = (
  module: CostModule,
  snapshot: CostSnapshot,
  commercial: CommercialConfig,
  complexityFactor: number = 1.0
): CostModule => {

  const backingType = (module as any).backingType || '3MM_WHITE';

  // Capa 1 — geometría desde piezas reales
  const layer1 = calculateLayer1(module.geometry, module.components, backingType);

  // Capa 2 — validación material
  const { adjustedConfig } = validateLayer2(module.materials);

  // Capa 3 — costos técnicos
  const layer3 = calculateLayer3(layer1, module.geometry, adjustedConfig, module.components, snapshot, complexityFactor, backingType);

  // Capa 4 — comercial
  const layer4 = calculateLayer4(layer3, commercial);

  return {
    ...module,
    materials: adjustedConfig,
    technical: layer1,
    costs:     layer3,
    commercial: layer4
  };
};
