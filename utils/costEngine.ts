import { 
  CostModule, 
  Layer1_Technical, 
  Layer3_TechnicalCost, 
  Layer4_Commercial, 
  CostSnapshot, 
  CommercialConfig,
  MaterialConfig,
  ModuleGeometry,
  ModuleComponents
} from '../types';

// --- CAPA 1: GEOMETRÍA & TÉCNICA ---
// Inmutable: Las dimensiones definen superficies independientemente del material.

export const calculateLayer1 = (
  geometry: ModuleGeometry, 
  components: ModuleComponents
): Layer1_Technical => {
  const { width, height, depth } = geometry;
  const { doors, drawers, shelves, flaps } = components;

  // Convert mm to m
  const w = width / 1000;
  const h = height / 1000;
  const d = depth / 1000;

  // 1. Superficie Cuerpo (m2)
  // Caja básica: 2 laterales + piso + techo + fondo
  // Simplificación: (2 * h * d) + (2 * w * d) + (w * h)
  // Ajuste por estantes internos
  const sideArea = (h * d) * 2;
  const topBottomArea = (w * d) * 2;
  const backArea = (w * h);
  const shelfArea = (w * d) * shelves;
  
  // Estructura interna cajones (estimado)
  const drawerBoxArea = drawers * ((w - 0.1) * d + (d * 0.15 * 2) + ((w - 0.1) * 0.15 * 2)); 

  const surfaceBodyM2 = sideArea + topBottomArea + backArea + shelfArea + drawerBoxArea;

  // 2. Superficie Frentes (m2)
  // Puertas y frentes de cajón
  const surfaceFrontsM2 = (w * h); // Asumimos frente completo cubre el módulo

  // 3. Metros Lineales de Canto (m)
  // Perímetro de todas las piezas visibles
  const linearEdgesM = (h * 4) + (w * 4) + (shelves * w * 2) + (doors * (h + w) * 2) + (drawers * (w + 0.2) * 2);

  // 4. Días Base (Estimación por complejidad geométrica)
  // Base 0.5 días + 0.1 por cajón + 0.05 por puerta
  const baseLaborDays = 0.5 + (drawers * 0.1) + (doors * 0.05) + (flaps * 0.08);

  return {
    surfaceBodyM2: parseFloat(surfaceBodyM2.toFixed(3)),
    surfaceFrontsM2: parseFloat(surfaceFrontsM2.toFixed(3)),
    linearEdgesM: parseFloat(linearEdgesM.toFixed(2)),
    baseLaborDays: parseFloat(baseLaborDays.toFixed(2))
  };
};

// --- CAPA 2: MATERIALES & REGLAS ---
// Validación de reglas de negocio (Ej: Laqueado -> MDF)

export const validateLayer2 = (config: MaterialConfig): { isValid: boolean, adjustedConfig: MaterialConfig, warning?: string } => {
  let adjusted = { ...config };
  let isValid = true;
  let warning = undefined;

  // REGLA: Si es Laqueado o Enchapado, la base debe ser MDF
  const isLacquer = config.frontsMaterial.toLowerCase().includes('laqueado');
  const isVeneer = config.frontsMaterial.toLowerCase().includes('enchapado') || config.frontsMaterial.toLowerCase().includes('lustre');

  if (isLacquer || isVeneer) {
    if (adjusted.frontsCore !== 'MDF') {
      adjusted.frontsCore = 'MDF'; // Auto-fix
      isValid = false;
      warning = "Regla de Calidad: Los acabados Laqueados o Enchapados requieren obligatoriamente una base de MDF. Se ha ajustado automáticamente.";
    }
  }

  return { isValid, adjustedConfig: adjusted, warning };
};

// --- CAPA 3: COSTO TÉCNICO ---
// Depende del Snapshot de precios (Inmutable una vez generado)

export const calculateLayer3 = (
  layer1: Layer1_Technical,
  geometry: ModuleGeometry,
  materialConfig: MaterialConfig,
  components: ModuleComponents,
  snapshot: CostSnapshot,
  complexityFactor: number = 1.0
): Layer3_TechnicalCost => {
  
  // 1. Costo Materiales
  // Determinar precio base según Core (AGLO vs MDF) y Color (Blanco vs Color)
  
  let priceBodyBoard = snapshot.priceBoard18ColorAglo;
  if (materialConfig.structureCore === 'MDF') {
      priceBodyBoard = materialConfig.bodyMaterial.toLowerCase().includes('blanca') 
        ? snapshot.priceBoard18WhiteMDF 
        : snapshot.priceBoard18ColorMDF; 
  } else if (materialConfig.bodyMaterial.toLowerCase().includes('blanca')) {
      priceBodyBoard = snapshot.priceBoard18WhiteAglo;
  }

  let priceFrontBoard = snapshot.priceBoard18ColorAglo;
  const isLacquer = materialConfig.frontsMaterial.toLowerCase().includes('laqueado');
  const isVeneer = materialConfig.frontsMaterial.toLowerCase().includes('enchapado') || materialConfig.frontsMaterial.toLowerCase().includes('lustre');
  
  if (isLacquer) {
      priceFrontBoard = snapshot.priceBoard18MDFCrudo1Face;
  } else if (isVeneer) {
      priceFrontBoard = snapshot.priceBoard18VeneerMDF;
  } else if (materialConfig.frontsCore === 'MDF') {
      priceFrontBoard = materialConfig.frontsMaterial.toLowerCase().includes('blanca')
        ? snapshot.priceBoard18WhiteMDF
        : snapshot.priceBoard18ColorMDF;
  } else if (materialConfig.frontsMaterial.toLowerCase().includes('blanca')) {
      priceFrontBoard = snapshot.priceBoard18WhiteAglo;
  }

  const WASTE_FACTOR = 1.43;
  
  const costBody = layer1.surfaceBodyM2 * priceBodyBoard * WASTE_FACTOR;
  const costFronts = layer1.surfaceFrontsM2 * priceFrontBoard * WASTE_FACTOR;
  
  let priceEdge = snapshot.priceEdge22Color045;
  if (materialConfig.edgeType === 'PVC_2MM') {
      priceEdge = snapshot.priceEdge2mm;
  } else if (materialConfig.bodyMaterial.toLowerCase().includes('blanca')) {
      priceEdge = snapshot.priceEdge22White045;
  }

  const costEdges = layer1.linearEdgesM * priceEdge;

  const costMaterials = costBody + costFronts + costEdges;

  // 2. Costo Acabados
  let costFinish = 0;
  
  if (isLacquer) {
      costFinish = layer1.surfaceFrontsM2 * snapshot.priceFinishLacquerSemi;
  } else if (isVeneer) {
      costFinish = layer1.surfaceFrontsM2 * snapshot.priceFinishLustreSemi;
  }

  // 3. Costo Herrajes
  let costHardware = 0;
  
  // Hinges
  let priceHinge = snapshot.priceHingeStandard;
  if (components.hingeType === 'SOFT_CLOSE') priceHinge = snapshot.priceHingeSoftClose;
  if (components.hingeType === 'PUSH') priceHinge = snapshot.priceHingePush;
  
  const hingesCount = components.doors * 2 + components.flaps * 2; 
  costHardware += hingesCount * priceHinge;
  
  // Slides - Logic for length (Simplified to 500mm if not specified, or based on depth)
  // In a real scenario we'd use the depth to pick 300, 400, 500.
  const depth = geometry.depth;
  let slideLength: 300 | 400 | 500 = 500;
  if (depth < 400) slideLength = 300;
  else if (depth < 500) slideLength = 400;

  let priceSlide = snapshot.priceSlide500Std;
  if (slideLength === 300) {
      if (components.slideType === 'TELESCOPIC_SOFT') priceSlide = snapshot.priceSlide300Soft;
      else if (components.slideType === 'TELESCOPIC_PUSH') priceSlide = snapshot.priceSlide300Push;
      else priceSlide = snapshot.priceSlide300Std;
  } else if (slideLength === 400) {
      if (components.slideType === 'TELESCOPIC_SOFT') priceSlide = snapshot.priceSlide400Soft;
      else if (components.slideType === 'TELESCOPIC_PUSH') priceSlide = snapshot.priceSlide400Push;
      else priceSlide = snapshot.priceSlide400Std;
  } else {
      if (components.slideType === 'TELESCOPIC_SOFT') priceSlide = snapshot.priceSlide500Soft;
      else if (components.slideType === 'TELESCOPIC_PUSH') priceSlide = snapshot.priceSlide500Push;
      else priceSlide = snapshot.priceSlide500Std;
  }

  costHardware += components.drawers * priceSlide;

  // Pistons
  if (components.hasGasPistons) {
      costHardware += components.flaps * snapshot.priceGasPiston;
  }

  // Screws & Glue
  costHardware += snapshot.priceGlueTin * 0.05; // Estimated usage per module
  costHardware += snapshot.priceScrews; // Fixed or percentage? User list implies an item.

  // 4. Mano de Obra - CÁLCULO FACTOR GLOBAL
  const FactorC = 1.0;
  let FactorF = 1.0;
  if (isLacquer) FactorF = 1.3;
  else if (isVeneer) FactorF = 1.5;

  const totalSurface = layer1.surfaceBodyM2 + layer1.surfaceFrontsM2;
  
  let FactorGlobal = 1.0;
  if (totalSurface > 0) {
      FactorGlobal = ((layer1.surfaceBodyM2 * FactorC) + (layer1.surfaceFrontsM2 * FactorF)) / totalSurface;
  }

  const realLaborDays = layer1.baseLaborDays * FactorGlobal * complexityFactor;
  const costLabor = realLaborDays * snapshot.costLaborDay;

  const totalDirectCost = costMaterials + costFinish + costHardware + costLabor;

  return {
    costMaterials,
    costHardware,
    costLabor,
    costFinish,
    totalDirectCost,
    complexityFactor: FactorGlobal * complexityFactor,
    realLaborDays
  };
};

// --- CAPA 4: COMERCIAL ---
// Aplicación de márgenes

export const calculateLayer4 = (
  layer3: Layer3_TechnicalCost,
  commercial: CommercialConfig
): Layer4_Commercial => {
  
  const workshopMarkup = 1 + (commercial.marginWorkshop / 100);
  const priceWorkshop = layer3.totalDirectCost * workshopMarkup;

  const commercialMarkup = 1 + (commercial.marginCommercial / 100);
  const finalPrice = priceWorkshop * commercialMarkup;

  return {
    priceWorkshop,
    grossMarginValue: finalPrice - layer3.totalDirectCost,
    finalPrice
  };
};

// --- ORQUESTADOR (PIPELINE) ---

export const calculateModuleFull = (
  module: CostModule,
  snapshot: CostSnapshot,
  commercial: CommercialConfig,
  complexityFactor: number = 1.0
): CostModule => {
  
  // 1. Capa Técnica
  const layer1 = calculateLayer1(module.geometry, module.components);

  // 2. Capa Materiales
  const { adjustedConfig } = validateLayer2(module.materials);

  // 3. Capa Costos
  const layer3 = calculateLayer3(layer1, module.geometry, adjustedConfig, module.components, snapshot, complexityFactor);

  // 4. Capa Comercial
  const layer4 = calculateLayer4(layer3, commercial);

  return {
    ...module,
    materials: adjustedConfig,
    technical: layer1,
    costs: layer3,
    commercial: layer4
  };
};
