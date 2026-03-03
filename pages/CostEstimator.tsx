
import React, { useState, useEffect } from 'react';
import { 
  CostSettings, CabinetModule, CalculatedPart, Project, ModuleType, PriceListHistory, SavedEstimate, EdgeCategory,
  CostModule, CostSnapshot, CommercialConfig, MaterialConfig, BudgetStatus, ProductionOrder, ProductionOrderStatus,
  CommercialStatus, ProductionStatus, AuditEntry, Client
} from '../types';
import { calculateModuleFull } from '../utils/costEngine'; // NEW ENGINE
import { 
  Database, Plus, Trash2, 
  DollarSign, Calculator, Box, FileText,
  Hammer, TrendingUp, Save, History,
  Search, Printer, Scissors, Pencil, X, AlertTriangle, ArrowLeft, ListPlus, Package, Check, Layers, Settings, ChevronRight, FileCheck, ArrowDown, Link, Download, Grid, PieChart, ShoppingCart, FolderPlus, ArrowRight, RefreshCw, Archive, Eye, Clock, Calendar, ChevronDown, ChevronUp, Share2, Activity, CheckCircle, Copy, ArrowUpCircle
} from 'lucide-react';
import { generateCutPlan, Sheet } from '../utils/cutOptimizer';
import { supabase } from '../services/supabaseClient';

interface CostEstimatorProps {
    projects?: Project[];
    clients?: Client[];
    savedEstimates?: SavedEstimate[]; 
    onSaveEstimate?: (estimate: SavedEstimate) => void; 
    onDeleteEstimate?: (id: string) => void; 
    onAddProductionOrder?: (order: ProductionOrder) => void;
    initialProjectId?: string;
}

// --- EXTENDED TYPES ---
interface ModuleExtra {
    id: string;
    description: string;
    quantity: number;
    unit: string; 
    unitPrice: number;
}

interface ExtendedCabinetModule extends CabinetModule {
    materialFrontName?: string; 
    extras?: ModuleExtra[];
    // New computation flags
    calculateHinges?: boolean;
    calculateSlides?: boolean;
    // Technical Definition Fields
    structureCore?: 'AGLO' | 'MDF';
    frontsCore?: 'AGLO' | 'MDF';
}

// NEW: Item definition (Grouping of Modules)
interface EstimatorItem {
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
    };
    details: {
        totalHardwareCost: number;
        totalMaterialCostBase: number;
    }
}

// --- CONSTANTS ---

const HINGE_LABELS: Record<string, string> = {
    'COMMON': 'Bisagras Estándar',
    'SOFT_CLOSE': 'Bisagras Cierre Suave',
    'PUSH': 'Bisagras Push-Open'
};

const SLIDE_LABELS: Record<string, string> = {
    'TELESCOPIC': 'Guías Telescópicas',
    'TELESCOPIC_SOFT': 'Guías Telescópicas Cierre Suave',
    'Z_TYPE': 'Guías Z (Epoxi)',
    'TELESCOPIC_PUSH': 'Guías Push',
    'HIDDEN_METAL_SIDE': 'Guías Ocultas'
};

const DEFAULT_OBSERVATIONS = `Los valores expresados son netos e incluyen envío e instalación.
Plazo de entrega estimado: 60 días. Coordinación de acuerdo a necesidades.`;

const DEFAULT_CONDITIONS = `- Forma de pago: 50% anticipo - saldo contra entrega.
- Medios de pago: a convenir.
- Mantenimiento de oferta: 7 días`;

const INITIAL_MODULE_FORM: Partial<ExtendedCabinetModule> = {
    name: '',
    width: 600,
    height: 720,
    depth: 580,
    quantity: 1,
    cntDoors: 0,
    cntFlaps: 0,
    cntDrawers: 0,
    moduleType: 'MELAMINE_FULL', // Internal default
    isWhiteStructure: false, 
    materialColorName: '', 
    materialFrontName: '',
    backingType: '3MM_WHITE',
    isMDFCore: false,
    edgeCategory: 'PVC_045',
    hingeType: 'COMMON',
    slideType: 'TELESCOPIC',
    calculateHinges: true,
    calculateSlides: true,
    hasGasPistons: false,
    extras: [],
    structureCore: 'AGLO',
    frontsCore: 'AGLO'
};

const STATUS_COLORS: Record<string, string> = {
    'BORRADOR': 'bg-gray-200 text-gray-700',
    'ENVIADO': 'bg-blue-200 text-blue-700',
    'APROBADO': 'bg-green-200 text-green-700',
    'EN_PRODUCCION': 'bg-purple-200 text-purple-700',
    'FINALIZADO': 'bg-indigo-200 text-indigo-700',
    'ENTREGADO': 'bg-indigo-200 text-indigo-700',
    'CANCELADO': 'bg-red-200 text-red-700',
    'DRAFT': 'bg-gray-200 text-gray-700',
    'SENT': 'bg-blue-200 text-blue-700',
    'APPROVED': 'bg-green-200 text-green-700',
    'IN_PRODUCTION': 'bg-purple-200 text-purple-700',
    'DELIVERED': 'bg-indigo-200 text-indigo-700',
};

const BACKING_OPTIONS = [
    { label: 'Fondo Blanco 3mm', value: '3MM_WHITE' },
    { label: 'Fondo Color 5.5mm', value: '55_COLOR' },
    { label: 'Sin Fondo', value: 'NONE' }
];

const BOARD_OPTIONS = [
    { label: 'Melamina Blanca Aglo 18mm', value: 'priceBoard18WhiteAglo' },
    { label: 'Melamina Blanca MDF 18mm', value: 'priceBoard18WhiteMDF' },
    { label: 'Melamina Color Aglo 18mm', value: 'priceBoard18ColorAglo' },
    { label: 'Melamina Color MDF 18mm', value: 'priceBoard18ColorMDF' },
    { label: 'MDF Crudo 1 Cara Blanca 18mm', value: 'priceBoard18MDFCrudo1Face' },
    { label: 'Madera Enchapada MDF 18mm', value: 'priceBoard18VeneerMDF' },
    { label: 'Melamina Blanca 15mm Aglo', value: 'priceBoard15WhiteAglo' },
    { label: 'Fondo Blanco 3mm', value: 'priceBacking3White' },
    { label: 'Fondo Color 5.5mm', value: 'priceBacking55Color' },
];

const CostEstimator: React.FC<CostEstimatorProps> = ({ 
    projects = [], 
    clients = [],
    savedEstimates = [], 
    onSaveEstimate, 
    onDeleteEstimate,
    onAddProductionOrder,
    initialProjectId
}) => {
  const [view, setView] = useState<'SETUP' | 'MODULES' | 'RESULTS' | 'HISTORY'>('MODULES');
    const [printMode, setPrintMode] = useState<'NONE' | 'SUPPLIES' | 'CUTTING' | 'COSTS' | 'ECONOMIC' | 'PRODUCTION_ORDER'>('NONE');
    
    // Use initialProjectId if provided
    const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
    
    useEffect(() => {
        if (initialProjectId) {
            setSelectedProjectId(initialProjectId);
            setView('SETUP'); // Go to setup to select project if needed, or maybe just stay in modules
        }
    }, [initialProjectId]);
    // Production Order State
    const [productionOrderInfo, setProductionOrderInfo] = useState({
        orderNumber: 'OP-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
        startDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        workers: 2,
        status: 'PENDIENTE'
    });
    const [customProjectName, setCustomProjectName] = useState<string>('');
    const [isProjectActive, setIsProjectActive] = useState(false);
  
  // Pending Modules (Not yet grouped into an Item)
  const [pendingModules, setPendingModules] = useState<ExtendedCabinetModule[]>([]);
  
  // Final Items (Grouped Modules)
  const [items, setItems] = useState<EstimatorItem[]>([]);
  
  // Selection State for Results Tab
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // TECHNICAL DEFINITION STATE (Loaded from History)
  const [technicalItems, setTechnicalItems] = useState<EstimatorItem[]>([]);
  const [isTechnicalModalOpen, setIsTechnicalModalOpen] = useState(false);
  const [technicalSelectedIds, setTechnicalSelectedIds] = useState<Set<string>>(new Set()); // New: Selection for Technical Report
  const [technicalObservations, setTechnicalObservations] = useState('');
  const [loadedEstimateInfo, setLoadedEstimateInfo] = useState<{projectName: string, date: string, observations?: string, conditions?: string} | null>(null);
  const [originalEstimateForComparison, setOriginalEstimateForComparison] = useState<SavedEstimate | null>(null);
  const [costComparisonAlert, setCostComparisonAlert] = useState<{
      isOpen: boolean;
      originalCost: number;
      updatedCost: number;
      difference: number;
      percentage: number;
      onConfirm: () => void;
      onCancel: () => void;
  } | null>(null);

  // PRODUCTION ORDER STATE
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [isProductionOrderModalOpen, setIsProductionOrderModalOpen] = useState(false);
  const [isEditEstimateModalOpen, setIsEditEstimateModalOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<SavedEstimate | null>(null);
  const [selectedBudgetIdForProduction, setSelectedBudgetIdForProduction] = useState<string | null>(null);
  const [productionOrderForm, setProductionOrderForm] = useState<{
      itemDescription: string;
      startDate: string;
      estimatedDeliveryDate: string;
      assignedOperators: string;
  }>({ itemDescription: '', startDate: '', estimatedDeliveryDate: '', assignedOperators: '' });

  // OPTIMIZATION STATE
  const [optimizationResult, setOptimizationResult] = useState<Record<string, Sheet[]>>({});
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [activeMaterialTab, setActiveMaterialTab] = useState<string>('');

  // Association Modal State
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [pendingPrintType, setPendingPrintType] = useState<'COSTS' | 'ECONOMIC' | null>(null);
  const [targetProjectId, setTargetProjectId] = useState('');

  // Item Creation Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
      name: '',
      workers: 2,
      days: 3,
      marginWorkshop: 35,
      marginRoden: 25
  });

  // Cost Sheet Modal State
  const [isCostSheetModalOpen, setIsCostSheetModalOpen] = useState(false);
  const [costSheetMargin, setCostSheetMargin] = useState(35); // Default Workshop Profit
  
  // EDITING MODULE STATE
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState<Partial<ExtendedCabinetModule>>(INITIAL_MODULE_FORM);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [newExtra, setNewExtra] = useState<ModuleExtra>({ id: '', description: '', quantity: 1, unit: 'un', unitPrice: 0 });

  // Quote Meta Data
  const [quoteReference, setQuoteReference] = useState(''); 
  const [quoteItemTitle, setQuoteItemTitle] = useState(''); 
  const [quoteId, setQuoteId] = useState(''); 
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  
  // Enabled Scenarios for Quote
  const [enabledScenarios, setEnabledScenarios] = useState({
      white: true,
      textured: true,
      lacquer: true,
      veneer: true
  });

  const [priceHistory, setPriceHistory] = useState<PriceListHistory[]>([]);
  const [newListName, setNewListName] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | 'ALL'>('ALL'); // New: Filter for budget status
  
  // Quote Texts State
  const [quoteObservations, setQuoteObservations] = useState(DEFAULT_OBSERVATIONS);
  const [quoteConditions, setQuoteConditions] = useState(DEFAULT_CONDITIONS);
  const [quoteVersion, setQuoteVersion] = useState<number | undefined>(undefined);

  // Default Pricing
  const [settings, setSettings] = useState<CostSettings>({
      // PLACAS
      priceBoard18WhiteAglo: 28000,
      priceBoard18WhiteMDF: 32000,
      priceBoard18ColorAglo: 42000,
      priceBoard18ColorMDF: 55000,
      priceBoard18MDFCrudo1Face: 18000,
      priceBoard18VeneerMDF: 65000,
      priceBoard15WhiteAglo: 26000,
      priceBacking3White: 12000,
      priceBacking55Color: 15000,

      // TAPACANTOS
      priceEdge22White045: 250,
      priceEdge45White045: 450,
      priceEdge22Color045: 350,
      priceEdge45Color045: 600,
      priceEdge2mm: 900,

      // HERRAJES
      priceHingeStandard: 1500,
      priceHingeSoftClose: 2800,
      priceHingePush: 2200,
      
      priceSlide300Std: 3500,
      priceSlide300Soft: 5500,
      priceSlide300Push: 6000,
      priceSlide400Std: 4000,
      priceSlide400Soft: 6000,
      priceSlide400Push: 6500,
      priceSlide500Std: 4500,
      priceSlide500Soft: 6500,
      priceSlide500Push: 7000,

      priceGasPiston: 4500,
      priceGlueTin: 8500,
      priceScrews: 500, // Fixed per module estimate

      // ACABADOS
      priceFinishLacquerSemi: 45000,
      priceFinishLacquerGloss: 55000,
      priceFinishLustreSemi: 48000,
      priceFinishLustreGloss: 58000,

      // MANO DE OBRA
      costLaborDay: 35000
  });

  const [activeSettings, setActiveSettings] = useState<CostSettings>(settings);


  // --- HELPERS ---

  const roundUp10 = (val: number) => {
      return Math.ceil(val / 10) * 10;
  };

  const formatCurrency = (amount: number) => {
      return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getProjectTitleById = (id?: string) => {
      const p = projects.find(prj => prj.id === id);
      return p ? p.title : 'Desconocido';
  };

  const getActiveProjectName = () => {
      if ((printMode === 'SUPPLIES' || printMode === 'CUTTING' || printMode === 'COSTS') && loadedEstimateInfo) return loadedEstimateInfo.projectName;
      if (selectedProjectId === 'NEW') return customProjectName || quoteReference || 'Proyecto Nuevo';
      return getProjectTitleById(selectedProjectId);
  };

  const generateQuoteId = () => {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const randomSeq = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
      return `${day}${month}${year}/${randomSeq}`;
  };

  const cleanHardwareName = (name: string) => {
      return name.replace(/Común|Common/gi, 'Estándar');
  };

  const getStandardSlideLength = (depth: number) => {
      const target = depth - 30;
      const available = [250, 300, 350, 400, 450, 500, 600];
      const size = available.reverse().find(s => s <= target);
      return size || 250; 
  };

  const getMaterialThickness = (mat: string): number => {
      if (mat.includes('18mm')) return 18;
      if (mat.includes('15mm')) return 15;
      if (mat.includes('5.5mm')) return 5.5;
      if (mat.includes('3mm')) return 3;
      return 18; // Default
  };

  // --- CALCULATIONS ---

    const calculateModuleParts = (mod: ExtendedCabinetModule): CalculatedPart[] => {
        const parts: CalculatedPart[] = [];
        const W = mod.width || 0;
        const H = mod.height || 0;
        const D = mod.depth || 0;
        const cntDrawers = mod.cntDrawers || 0;
        const cntDoors = mod.cntDoors || 0;
        const cntFlaps = mod.cntFlaps || 0;
        
        const backingType = mod.backingType || '3MM_WHITE';
        
        const structCore = mod.structureCore || (mod.isMDFCore ? 'MDF' : 'AGLO');
        const frontsCore = mod.frontsCore || (mod.isMDFCore ? 'MDF' : 'AGLO');
        const isWhiteStruct = mod.isWhiteStructure;

        let carcassMat: '18mm_White' | '18mm_Color' | '18mm_MDF';
        if (structCore === 'MDF') {
            carcassMat = '18mm_MDF'; 
        } else {
            carcassMat = isWhiteStruct ? '18mm_White' : '18mm_Color';
        }

        let frontMat: '18mm_Color' | '18mm_MDF';
        if (frontsCore === 'MDF') {
            frontMat = '18mm_MDF';
        } else {
            frontMat = '18mm_Color';
        }

        // 1. Tapas y Bases: SIEMPRE pasan completas (sin descuentos)
        // Ancho = Ancho_exterior, Profundidad = Profundidad_exterior
        parts.push({ name: 'Tapa superior', width: W, height: D, material: carcassMat, quantity: 1, grain: 'horizontal' });
        parts.push({ name: 'Base inferior', width: W, height: D, material: carcassMat, quantity: 1, grain: 'horizontal' });
        
        // 2. Laterales: Alto = Alto_exterior
        // SI fondo = 3mm: Profundidad = Profundidad_exterior
        // SI fondo = 5.5mm o 18mm: Profundidad = Profundidad_exterior - 18mm
        let lateralDepth = D;
        if (backingType === '5.5MM_COLOR' || backingType === '18MM_STRUCTURE') {
            lateralDepth = D - 18;
        }
        parts.push({ name: 'Lateral', width: lateralDepth, height: H, material: carcassMat, quantity: 2, grain: 'vertical' });
        
        // 3. Fondos
        if (backingType === '3MM_WHITE') {
            // Ancho = Ancho_exterior - 36mm, Alto = Alto_exterior - descuento_ranura (usamos 38mm según ejemplo 850-812)
            parts.push({ name: 'Fondo 3mm Blanco', width: Math.max(0, W - 36), height: Math.max(0, H - 38), material: '3mm_White', quantity: 1, grain: 'vertical' });
        } else if (backingType === '18MM_STRUCTURE') {
            // Ancho = Ancho_exterior - 36mm, Profundidad (Alto) = Profundidad_exterior - 18mm? No, Alto = H - 36?
            // El prompt dice: Ancho = Ancho_exterior - 36mm, Profundidad = Profundidad_exterior - 18mm para el fondo.
            // Asumimos que "Profundidad" en el fondo es su altura.
            parts.push({ name: 'Fondo Estructural 18mm', width: Math.max(0, W - 36), height: Math.max(0, H - 18), material: carcassMat, quantity: 1, grain: 'vertical' });
        } else {
            // 5.5mm
            parts.push({ name: 'Fondo 5.5mm Color', width: Math.max(0, W - 36), height: Math.max(0, H - 18), material: '5.5mm_Color', quantity: 1, grain: 'vertical' });
        }

        // 4. Estantes (si cantidad > 0)
        // Ancho = Ancho_exterior - 36mm, Profundidad = Profundidad_exterior - 45mm
        let extraShelves = 0;
        if (H > 850) {
            extraShelves = Math.floor((H - 850) / 350) + 1; 
        } 
        if (extraShelves > 0) {
            parts.push({ name: 'Estante Interno', width: Math.max(0, W - 36), height: Math.max(0, D - 45), material: carcassMat, quantity: extraShelves, grain: 'horizontal' });
        }

        // 5. Frentes (puertas/cajones)
        // Ancho = Ancho_exterior - 6mm, Veta = HORIZONTAL
        const frontWidth = Math.max(0, W - 6);
        const totalFrontHeight = Math.max(0, H - 6);

        if (cntDrawers > 0) {
            const gaps = (cntDrawers - 1) * 4;
            const drawerFrontHeight = (totalFrontHeight - gaps) / cntDrawers;
            parts.push({ name: 'Frente Cajón', width: frontWidth, height: drawerFrontHeight, material: frontMat, quantity: cntDrawers, grain: 'horizontal' });
        } 
        
        if (cntDoors > 0) {
            if (cntDrawers === 0) {
               const doorHeight = totalFrontHeight; 
               const finalDoorWidth = cntDoors >= 2 ? (W - 10) / cntDoors : frontWidth;
               parts.push({ name: 'Puerta', width: finalDoorWidth, height: doorHeight, material: frontMat, quantity: cntDoors, grain: 'horizontal' });
            }
        }
        
        if (cntFlaps > 0) {
            const gaps = (cntFlaps - 1) * 4;
            const flapHeight = (totalFrontHeight - gaps) / cntFlaps;
            parts.push({ name: 'Frente Abatible', width: frontWidth, height: flapHeight, material: frontMat, quantity: cntFlaps, grain: 'horizontal' });
        }

        // 6. Interiores de Cajón
        if (cntDrawers > 0) {
            const drawerHeight = 120;
            // LATERALES: Ancho = Profundidad_módulo - 20mm, Alto = Alto_cajón
            parts.push({ name: 'Lateral Cajón', width: Math.max(0, D - 20), height: drawerHeight, material: '15mm_White', quantity: 2 * cntDrawers, grain: 'free' });
            // FRENTE Y TRASERO: Ancho = Ancho_módulo - 26mm, Alto = Alto_cajón
            parts.push({ name: 'Contra/Frente Cajón', width: Math.max(0, W - 26), height: drawerHeight, material: '15mm_White', quantity: 2 * cntDrawers, grain: 'free' });
            // FONDO: Ancho = Ancho_módulo - 26mm, Profundidad = Profundidad_módulo - 20mm
            parts.push({ name: 'Fondo Cajón', width: Math.max(0, W - 26), height: Math.max(0, D - 20), material: '3mm_White', quantity: 1 * cntDrawers, grain: 'free' });
        }

        return parts;
    };

  const calculateItemQuantities = (currentModules: ExtendedCabinetModule[], scenarioOverride: Partial<CabinetModule> = {}) => {
      if (!currentModules || currentModules.length === 0) {
          return {
              boards18Color: 0, boards18White: 0, boards18MDFMelamine: 0, boards18MDF: 0,
              boards15: 0, backing55: 0, backing3: 0,
              linearWhite22: 0, linearWhite45: 0, linearColor22: 0, linearColor45: 0, linear2mm: 0,
              lacquerAreaM2: 0, veneerAreaM2: 0,
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
      let totalExtrasCost = 0;
      let totalComplexityFactor = 0;
      let totalAreaForComplexity = 0;

      const detailedMaterialsArea: Record<string, number> = {};
      const detailedHardware: Record<string, number> = {};

      currentModules.forEach(rawMod => {
          const mod = { ...rawMod, ...scenarioOverride };
          const qty = mod.quantity || 1;
          const parts = calculateModuleParts(mod);
          
          const h = mod.height || 0;
          const d = mod.depth || 0;
          let modHinges = 0;
          let modPistons = 0;
          let modSlides = 0;

          if (mod.calculateHinges) {
              const hingesPerDoor = h > 1500 ? 4 : h > 900 ? 3 : 2;
              modHinges += ((mod.cntDoors || 0) * hingesPerDoor);
              modHinges += ((mod.cntFlaps || 0) * 2);
              const hingeName = HINGE_LABELS[mod.hingeType || 'COMMON'];
              if (modHinges > 0) detailedHardware[hingeName] = (detailedHardware[hingeName] || 0) + (modHinges * qty);
          }
          if (mod.hasGasPistons) {
              modPistons += (mod.cntFlaps || 0);
              if (modPistons > 0) detailedHardware['Pistones a Gas'] = (detailedHardware['Pistones a Gas'] || 0) + (modPistons * qty);
          } 
          if (mod.calculateSlides) {
              modSlides += (mod.cntDrawers || 0);
              const slideLen = getStandardSlideLength(d);
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

          let finishAreaPerModule = 0;

          if (mType === 'LACQUER_FULL' || mType === 'VENEER_FULL') {
              finishAreaPerModule = frontArea + sidesArea + topBottomArea;
          }
          if (mType && mType.includes('LACQUER')) lacquerArea += finishAreaPerModule * qty;
          else if (mType && mType.includes('VENEER')) veneerArea += finishAreaPerModule * qty;

          parts.forEach(p => {
              const area = p.width * p.height * p.quantity * qty;
              const perimeter = (p.width + p.height) * 2 * p.quantity * qty;
              const isFront = p.name.includes('Frente') || p.name.includes('Puerta');

              const isTechnicalMode = Object.keys(scenarioOverride).length === 0;
              
              let currentCore = 'AGLO';
              let currentMatName = 'Melamina';

              if (isTechnicalMode) {
                  currentCore = isFront ? (mod.frontsCore || 'AGLO') : (mod.structureCore || 'AGLO');
                  const colorName = mod.materialColorName || 'Estándar';
                  const frontName = mod.materialFrontName || colorName;
                  currentMatName = isFront ? frontName : colorName;
              } else {
                  currentCore = mod.isMDFCore ? 'MDF' : 'AGLO';
                  currentMatName = isFront ? 'Color/Terminación' : (mod.isWhiteStructure ? 'Blanco' : 'Color');
              }

              if (p.material.includes('Color')) totalBoard18ColorArea += area;
              else if (p.material.includes('White')) totalBoard18WhiteArea += area;
              else if (p.material.includes('MDF')) totalBoard18MDFArea += area;
              else if (p.material.includes('15mm')) totalBoard15Area += area;
              else if (p.material.includes('5.5mm')) totalBacking55Area += area;
              else if (p.material.includes('3mm')) totalBacking3Area += area;

              if (mod.edgeCategory === 'PVC_2MM') {
                  if (p.material.includes('18mm') || p.material.includes('15mm')) linear2mm += perimeter;
              } else {
                  const safeMatName = (currentMatName || '').toLowerCase();
                  const isWhiteMat = safeMatName.includes('blanco') || safeMatName.includes('white');
                  if (isWhiteMat) linearWhite22 += perimeter;
                  else linearColor22 += perimeter;
              }

              let reportKey = '';
              
              // Helper to consolidate material name logic for the report
              if (p.material.includes('18mm') || p.material.includes('MDF')) {
                  let type = 'Melamina';
                  if (mType.includes('LACQUER')) type = 'Para Laquear';
                  if (mType.includes('VENEER')) type = 'Para Enchapar';
                  
                  const safeMatName = (currentMatName || '').toLowerCase();
                  if (safeMatName.includes('blanco')) type = 'Melamina Blanca';
                  
                  const cleanName = type === 'Melamina' || type.includes('Para') ? currentMatName : type;
                  const displayCore = currentCore === 'AGLO' ? 'Aglomerado' : 'MDF';
                  
                  reportKey = `${cleanName} (18mm ${displayCore})`;
              } 
              else if (p.material.includes('15mm')) reportKey = 'Melamina Blanca (15mm)';
              else if (p.material.includes('5.5mm')) reportKey = `Fondo ${currentMatName} (5.5mm)`;
              else if (p.material.includes('3mm')) reportKey = 'Fondo Blanco (3mm)';

              if (reportKey) {
                  detailedMaterialsArea[reportKey] = (detailedMaterialsArea[reportKey] || 0) + area;
              }
          });
      });

      const SHEET_AREA = 2750 * 1830;
      
      const detailedBoards: Record<string, number> = {};
      Object.entries(detailedMaterialsArea).forEach(([name, area]) => {
          detailedBoards[name] = Math.ceil(area * 1.2 / SHEET_AREA); // Estimate sheets just for internal calculations if needed
      });

      return {
          boards18Color: Math.ceil(totalBoard18ColorArea * 1.2 / SHEET_AREA),
          boards18White: Math.ceil(totalBoard18WhiteArea * 1.2 / SHEET_AREA),
          boards18MDFMelamine: Math.ceil(totalBoard18MDFMelamineArea * 1.2 / SHEET_AREA),
          boards18MDF: Math.ceil(totalBoard18MDFArea * 1.2 / SHEET_AREA),
          boards15: Math.ceil(totalBoard15Area * 1.2 / SHEET_AREA),
          backing55: Math.ceil(totalBacking55Area * 1.1 / SHEET_AREA),
          backing3: Math.ceil(totalBacking3Area * 1.1 / SHEET_AREA),
          linearWhite22: Math.ceil(linearWhite22 / 1000),
          linearWhite45: Math.ceil(linearWhite45 / 1000),
          linearColor22: Math.ceil(linearColor22 / 1000),
          linearColor45: Math.ceil(linearColor45 / 1000),
          linear2mm: Math.ceil(linear2mm / 1000),
          lacquerAreaM2: Math.ceil(lacquerArea / 1000000 * 10) / 10,
          veneerAreaM2: Math.ceil(veneerArea / 1000000 * 10) / 10,
          totalHinges, totalPistons, totalSlides, totalExtrasCost,
          // Report Details
          detailedBoards,
          detailedHardware,
          avgComplexity: parseFloat((totalAreaForComplexity > 0 ? totalComplexityFactor / totalAreaForComplexity : 1.0).toFixed(2))
      };
  };

  const calculateFinancialsForScenario = (
      currentModules: ExtendedCabinetModule[], 
      laborCost: number, 
      margins: { workshop: number; roden: number },
      scenarioOverride: Partial<CabinetModule> = {},
      snapshotOverride?: CostSnapshot
  ) => {
      // 1. Create Snapshot from current settings or override
      const snapshot: CostSnapshot = snapshotOverride || {
          ...settings,
          currency: 'ARS',
          timestamp: new Date().toISOString()
      };

      // 2. Commercial Config
      const commercial: CommercialConfig = {
          marginWorkshop: margins.workshop,
          marginCommercial: margins.roden,
          taxRate: 0
      };

      let totalDirectCost = 0;
      let totalHardwareCost = 0;
      let totalMaterialCostBase = 0;
      
      // Note: We use the Engine's calculated labor instead of the manual 'laborCost' param
      // to strictly follow the requested architecture where Labor = BaseDays * Complexity.

      currentModules.forEach(mod => {
          // Apply overrides
          const effectiveMod = { ...mod, ...scenarioOverride };
          
          // Map to CostModule
          const costMod: CostModule = {
              id: effectiveMod.id || 'temp',
              name: effectiveMod.name || 'Module',
              quantity: effectiveMod.quantity || 1,
              geometry: {
                  width: effectiveMod.width || 0,
                  height: effectiveMod.height || 0,
                  depth: effectiveMod.depth || 0
              },
              components: {
                  doors: effectiveMod.cntDoors || 0,
                  drawers: effectiveMod.cntDrawers || 0,
                  shelves: 0, 
                  flaps: effectiveMod.cntFlaps || 0,
                  hingeType: effectiveMod.hingeType || 'COMMON',
                  slideType: effectiveMod.slideType || 'TELESCOPIC',
                  hasGasPistons: effectiveMod.hasGasPistons || false
              },
              materials: {
                  bodyMaterial: effectiveMod.materialColorName || (effectiveMod.isWhiteStructure ? 'Melamina Blanca' : 'Melamina Color'),
                  frontsMaterial: effectiveMod.materialFrontName || effectiveMod.materialColorName || (effectiveMod.isWhiteStructure ? 'Melamina Blanca' : 'Melamina Color'),
                  edgeType: effectiveMod.edgeCategory || 'PVC_045',
                  structureCore: effectiveMod.structureCore || (effectiveMod.isMDFCore ? 'MDF' : 'AGLO'),
                  frontsCore: effectiveMod.frontsCore || (effectiveMod.isMDFCore ? 'MDF' : 'AGLO')
              }
          };

          // Override material logic for specific scenarios
          if (effectiveMod.moduleType === 'LACQUER_FULL') {
              costMod.materials.frontsMaterial = 'Laqueado Semi';
              costMod.materials.frontsCore = 'MDF';
          } else if (effectiveMod.moduleType === 'VENEER_FULL') {
              costMod.materials.frontsMaterial = 'Enchapado Paraiso';
              costMod.materials.frontsCore = 'MDF';
          }

          // Calculate using the new Engine
          const result = calculateModuleFull(costMod, snapshot, commercial);
          
          if (result.costs) {
              const qty = costMod.quantity;
              totalDirectCost += result.costs.totalDirectCost * qty;
              totalHardwareCost += result.costs.costHardware * qty;
              totalMaterialCostBase += (result.costs.costMaterials + result.costs.costFinish) * qty;
          }
          
          // Add Extras (Manual extras not handled by engine)
          if (effectiveMod.extras) {
             effectiveMod.extras.forEach(extra => {
                 const extraCost = extra.unitPrice * extra.quantity * costMod.quantity;
                 totalDirectCost += extraCost;
                 totalHardwareCost += extraCost; 
             });
          }
      });

      const profitWorkshopValue = totalDirectCost * (margins.workshop / 100);
      const priceWorkshop = totalDirectCost + profitWorkshopValue;
      const profitRodenValue = priceWorkshop * (margins.roden / 100);
      const finalPrice = priceWorkshop + profitRodenValue;

      return {
          finalPrice,
          totalHardwareCost,
          totalMaterialCostBase,
          totalDirectCost
      };
  };

  // --- HANDLERS ---

  const handleOpenItemModal = () => {
      if (pendingModules.length === 0) {
          alert("Debe agregar módulos pendientes antes de crear un item.");
          return;
      }
      setItemForm({
          name: '',
          workers: 2,
          days: 3,
          marginWorkshop: 35,
          marginRoden: 25
      });
      setIsItemModalOpen(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
      e.preventDefault();
      
      const laborCost = itemForm.workers * itemForm.days * settings.costLaborDay;
      const margins = { workshop: itemForm.marginWorkshop, roden: itemForm.marginRoden };

      // Calculate All 6 Scenarios
      const whiteAglo = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: true, isMDFCore: false });
      const whiteMDF = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: true, isMDFCore: true });
      const colorAglo = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: false, isMDFCore: false });
      const colorMDF = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: false, isMDFCore: true });
      const lacquer = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'LACQUER_FULL', isWhiteStructure: false, isMDFCore: false });
      const veneer = calculateFinancialsForScenario(pendingModules, laborCost, margins, { moduleType: 'VENEER_FULL', isWhiteStructure: false, isMDFCore: false });

      const standardCalc = calculateFinancialsForScenario(pendingModules, laborCost, margins, {});

      const newItem: EstimatorItem = {
          id: `item${Date.now()}`,
          name: itemForm.name,
          modules: [...pendingModules],
          labor: { workers: itemForm.workers, days: itemForm.days },
          margins: margins,
          scenarioPrices: {
              whiteAglo: whiteAglo.finalPrice,
              whiteMDF: whiteMDF.finalPrice,
              colorAglo: colorAglo.finalPrice,
              colorMDF: colorMDF.finalPrice,
              lacquer: lacquer.finalPrice,
              veneer: veneer.finalPrice
          },
          details: {
              totalHardwareCost: standardCalc.totalHardwareCost,
              totalMaterialCostBase: standardCalc.totalMaterialCostBase
          }
      };

      setItems(prev => [...prev, newItem]);
      setPendingModules([]); 
      setIsItemModalOpen(false);
  };

  const deleteItem = (id: string) => {
      if(confirm('¿Eliminar este item del presupuesto?')) {
          setItems(prev => prev.filter(i => i.id !== id));
      }
  };

  const toggleItemSelection = (id: string) => {
      const next = new Set(selectedItemIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedItemIds(next);
  };

  const handleOpenQuoteModal = () => {
      if (selectedItemIds.size === 0) {
          alert("Debe seleccionar al menos un item para generar el presupuesto.");
          return;
      }
      setPendingPrintType('ECONOMIC');
      setIsPriceListModalOpen(true);
  };

  const handleSelectPriceList = (listSettings: CostSettings) => {
      setActiveSettings(listSettings);
      setIsPriceListModalOpen(false);
      
      if (pendingPrintType === 'COSTS') {
          setPrintMode('COSTS');
      } else if (pendingPrintType === 'ECONOMIC') {
          setQuoteItemTitle("Amoblamiento Integral");
          setQuoteReference(getActiveProjectName());
          setQuoteId(generateQuoteId());
          setShowQuoteModal(true);
      }
      setPendingPrintType(null);
  };

  const handleGenerateQuote = () => {
      if (onSaveEstimate) {
          const selectedItemsList = items.filter(i => selectedItemIds.has(i.id));
          
          // Recalculate totalRef using activeSettings
          const totalRef = selectedItemsList.reduce((sum, item) => {
              const prices = getRecalculatedItemPrices(item, activeSettings);
              return sum + prices.colorAglo;
          }, 0);
          
          const estimateToSave: SavedEstimate = {
              id: `est${Date.now()}`,
              projectId: selectedProjectId !== 'NEW' ? selectedProjectId : undefined,
              customProjectName: selectedProjectId === 'NEW' ? customProjectName || quoteReference : undefined,
              date: new Date().toISOString(),
              type: 'ECONOMIC',
              items: selectedItemsList,
              modules: [], // Not used for ECONOMIC but required by type
              settingsSnapshot: activeSettings,
              financialsSnapshot: { ...activeSettings, timestamp: new Date().toISOString(), currency: 'ARS' },
              totalDirectCost: selectedItemsList.reduce((sum, item) => sum + (getRecalculatedItemPrices(item, activeSettings) as any).totalDirectCost, 0),
              finalPrice: totalRef,
              status: BudgetStatus.DRAFT,
              version: 1,
              isLatest: true,
              quoteData: {
                  title: quoteItemTitle,
                  reference: quoteReference,
                  id: quoteId,
                  observations: quoteObservations,
                  conditions: quoteConditions,
                  enabledScenarios: enabledScenarios
              }
          };
          onSaveEstimate(estimateToSave);
      }
      
      setPrintMode('ECONOMIC');
      setShowQuoteModal(false);
  };

  // --- TECHNICAL REPORT FLOW (FROM HISTORY) ---
  
  const handleOpenTechnicalDefinition = (estimate: SavedEstimate) => {
    const savedItems = (estimate.items || estimate.modules) as any as EstimatorItem[];
    if (!savedItems || !Array.isArray(savedItems)) {
        console.error("No items found in estimate", estimate);
        return;
    }
    const clonedItems: EstimatorItem[] = JSON.parse(JSON.stringify(savedItems)).map((item: EstimatorItem) => ({
          ...item,
          modules: item.modules.map(m => {
              // Naming convention: Front material takes precedence
              let scenario = estimate.finalTerminationScenario;
              if (!scenario) {
                  const isTextured = m.materialFrontName?.toLowerCase().includes('color') || 
                                   m.materialFrontName?.toLowerCase().includes('texturada') ||
                                   (!m.materialFrontName && (m.materialColorName?.toLowerCase().includes('color') || m.materialColorName?.toLowerCase().includes('texturada')));
                  scenario = isTextured ? 'textured' : 'white';
              }
              
              const coreLabel = (m.structureCore || (m.isMDFCore ? 'MDF' : 'AGLO')) === 'MDF' ? ' MDF' : '';
              const baseName = scenario === 'white' ? `Melamina Blanca${coreLabel}` : 
                               scenario === 'textured' ? `Melamina Color${coreLabel}` :
                               scenario === 'lacquer' ? `Laqueado${coreLabel}` : `Enchapado${coreLabel}`;

              return {
                  ...m,
                  structureCore: m.structureCore || (m.isMDFCore ? 'MDF' : 'AGLO'),
                  frontsCore: m.frontsCore || (m.isMDFCore ? 'MDF' : 'AGLO'),
                  // Ensure material names match price list naming or module selection
                  materialColorName: m.materialColorName || baseName,
                  materialFrontName: m.materialFrontName || baseName
              };
          })
      }));
      
      setTechnicalItems(clonedItems);
      const allIds = new Set(clonedItems.map(i => i.id));
      setTechnicalSelectedIds(allIds);
      
      setTechnicalObservations('');
      setLoadedEstimateInfo({
          projectName: estimate.projectId ? getProjectTitleById(estimate.projectId) : estimate.customProjectName || 'Sin Nombre',
          date: estimate.date
      });
      setOriginalEstimateForComparison(estimate);
      if (estimate.projectId) setTargetProjectId(estimate.projectId);
      else setTargetProjectId('');

      setIsTechnicalModalOpen(true);
  };

  const handleGenerateNewVersion = (originalEstimate: SavedEstimate) => {
      if (onSaveEstimate) {
          const newVersion: SavedEstimate = {
              ...originalEstimate,
              id: `est${Date.now()}`,
              date: new Date().toISOString(),
              version: (originalEstimate.version || 1) + 1,
              parentId: originalEstimate.id,
              isLatest: true,
              status: BudgetStatus.DRAFT,
              commercialStatus: CommercialStatus.DRAFT,
              productionStatus: ProductionStatus.PENDING,
              hasTechnicalDefinition: false,
              auditLog: [
                  ...(originalEstimate.auditLog || []),
                  {
                      from: originalEstimate.commercialStatus || 'N/A',
                      to: CommercialStatus.DRAFT,
                      timestamp: new Date().toISOString(),
                      user: 'Sistema (Nueva Versión)'
                  }
              ]
          };
          onSaveEstimate(newVersion);
          alert(`Nueva versión v${newVersion.version} creada.`);
      }
  };

  const handleUpdatePrices = (originalEstimate: SavedEstimate) => {
    if (onSaveEstimate) {
      const newVersion: SavedEstimate = {
        ...originalEstimate,
        id: `est${Date.now()}`,
        date: new Date().toISOString(),
        version: (originalEstimate.version || 1) + 1,
        parentId: originalEstimate.id,
        isLatest: true,
        settingsSnapshot: { ...settings }, // Aplica precios actuales
        auditLog: [
          ...(originalEstimate.auditLog || []),
          {
            from: originalEstimate.commercialStatus || 'N/A',
            to: originalEstimate.commercialStatus || 'N/A',
            timestamp: new Date().toISOString(),
            user: 'Sistema (Actualización de Precios)'
          }
        ]
      };
      onSaveEstimate(newVersion);
      alert(`Nueva versión v${newVersion.version} con precios actualizados.`);
    }
  };

  const handleSetFinalTermination = (scenario: 'white' | 'textured' | 'lacquer' | 'veneer') => {
    if (!editingEstimate) return;
    
    // Actualizar todos los módulos para que coincidan con este escenario
    const updatedModules = editingEstimate.modules.map(m => ({
      ...m,
      moduleType: (scenario === 'white' || scenario === 'textured') ? 'MELAMINE_FULL' : 
                  scenario === 'lacquer' ? 'MELAMINE_STRUCT_LACQUER' : 
                  'MELAMINE_STRUCT_VENEER' as ModuleType,
      isWhiteStructure: scenario === 'white',
      materialColorName: scenario === 'white' ? 'Blanco' : m.materialColorName
    }));

    setEditingEstimate({
      ...editingEstimate,
      finalTerminationScenario: scenario,
      modules: updatedModules
    });
  };

  const handleConfirmTechnicalDefinition = () => {
      if (!originalEstimateForComparison || !onSaveEstimate) {
          setIsTechnicalModalOpen(false);
          return;
      }

      // 1. Calculate the updated cost based on technicalItems
      const updatedTotalDirectCost = technicalItems.reduce((sum, item) => {
          const prices = calculateFinancialsForScenario(item.modules, item.labor.workers * item.labor.days * settings.costLaborDay, item.margins, {}, originalEstimateForComparison.financialsSnapshot);
          return sum + prices.totalDirectCost;
      }, 0);

      const updatedFinalPrice = technicalItems.reduce((sum, item) => {
          const prices = calculateFinancialsForScenario(item.modules, item.labor.workers * item.labor.days * settings.costLaborDay, item.margins, {}, originalEstimateForComparison.financialsSnapshot);
          return sum + prices.finalPrice;
      }, 0);

      const originalCost = originalEstimateForComparison.finalPrice || 0;
      const difference = updatedFinalPrice - originalCost;
      const percentage = originalCost === 0 ? 0 : (difference / originalCost) * 100;

      if (Math.abs(percentage) > 5) {
          setCostComparisonAlert({
              isOpen: true,
              originalCost,
              updatedCost: updatedFinalPrice,
              difference,
              percentage,
              onConfirm: () => {
                  // User confirmed, save the changes
                  const updatedEstimate: SavedEstimate = {
                      ...originalEstimateForComparison,
                      items: technicalItems,
                      totalDirectCost: updatedTotalDirectCost,
                      finalPrice: updatedFinalPrice,
                      date: new Date().toISOString(),
                      hasTechnicalDefinition: true,
                  };
                  onSaveEstimate(updatedEstimate);
                  setCostComparisonAlert(null);
                  setIsTechnicalModalOpen(false);
              },
              onCancel: () => {
                  // User cancelled, discard changes and close modal
                  setCostComparisonAlert(null);
                  setIsTechnicalModalOpen(false);
              },
          });
      } else {
          // Difference is within tolerance, save directly
          const updatedEstimate: SavedEstimate = {
              ...originalEstimateForComparison,
              items: technicalItems,
              totalDirectCost: updatedTotalDirectCost,
              finalPrice: updatedFinalPrice,
              date: new Date().toISOString(),
              hasTechnicalDefinition: true,
          };
          onSaveEstimate(updatedEstimate);
          setIsTechnicalModalOpen(false);
      }
  };

  const handleGenerateProductionOrder = (budgetId: string) => {
      const budget = savedEstimates?.find(b => b.id === budgetId);
      if (budget) {
          setProductionOrderForm({
              itemDescription: budget.customProjectName || '',
              startDate: new Date().toISOString().split('T')[0],
              estimatedDeliveryDate: '',
              assignedOperators: ''
          });
      }
      setSelectedBudgetIdForProduction(budgetId);
      setIsProductionOrderModalOpen(true);
  };

  const handleSaveProductionOrder = async () => {
      if (!selectedBudgetIdForProduction) return;
      
      const budget = savedEstimates?.find(b => b.id === selectedBudgetIdForProduction);
      if (!budget) return;

      const newOrder = {
          budgetId: budget.id,
          clientId: budget.projectId === 'NEW' ? null : budget.projectId,
          clientName: budget.customProjectName || 'Cliente Desconocido',
          itemDescription: productionOrderForm.itemDescription,
          technicalDetails: budget.modules,
          materialsList: budget.details,
          startDate: productionOrderForm.startDate,
          estimatedDeliveryDate: productionOrderForm.estimatedDeliveryDate,
          assignedOperators: productionOrderForm.assignedOperators.split(',').map(s => s.trim()).filter(Boolean),
          status: ProductionOrderStatus.PENDING
      };

      const { error } = await supabase.from('production_orders').insert(newOrder);
      if (error) {
          alert("Error al guardar la orden de producción: " + error.message);
      } else {
          setIsProductionOrderModalOpen(false);
          alert("Orden de producción generada con éxito.");
      }
  };

  const updateTechnicalModule = (itemId: string, moduleId: string, field: string, value: any) => {
      setTechnicalItems(prev => prev.map(item => {
          if (item.id !== itemId) return item;
          return {
              ...item,
              modules: item.modules.map(mod => {
                  if (mod.id !== moduleId) return mod;
                  return { ...mod, [field]: value };
              })
          };
      }));
  };

  const handleToggleTechnicalItem = (itemId: string) => {
      const next = new Set(technicalSelectedIds);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      setTechnicalSelectedIds(next);
  };

  const handlePreGenerateReport = () => {
      if (technicalSelectedIds.size === 0) {
          alert("Debe seleccionar al menos un item para incluir en el reporte.");
          return;
      }
      setIsAssociateModalOpen(true);
  };

  const handleConfirmAssociationAndGenerate = () => {
      const selectedTechnicalItems = technicalItems.filter(i => technicalSelectedIds.has(i.id));
      
      if (onSaveEstimate) {
          const estimateToSave: SavedEstimate = {
              id: `tech${Date.now()}`,
              projectId: targetProjectId || undefined, 
              customProjectName: targetProjectId ? getProjectTitleById(targetProjectId) : loadedEstimateInfo?.projectName || 'Reporte Técnico',
              date: new Date().toISOString(),
              type: 'TECHNICAL',
              modules: selectedTechnicalItems as any,
              settingsSnapshot: settings,
              version: 1,
              isLatest: true
          };
          onSaveEstimate(estimateToSave); 
      }

      setTechnicalItems(selectedTechnicalItems);
      
      setIsAssociateModalOpen(false);
      setIsTechnicalModalOpen(false);
      setPrintMode('SUPPLIES'); // Default view
  };

  const handleOptimizeCut = () => {
      const itemsToProcess = technicalItems.length > 0 ? technicalItems : items;
      const groupedByMaterial: Record<string, { id: string, width: number, height: number, quantity: number }[]> = {};

      itemsToProcess.forEach(item => {
          item.modules.forEach(mod => {
              const parts = calculateModuleParts(mod);
              parts.forEach(part => {
                  let materialKey = part.material as string;
                  if (materialKey.includes('18mm_Color')) materialKey = mod.materialColorName || 'Melamina Color';
                  if (materialKey.includes('15mm_White')) materialKey = 'Melamina Blanca 15mm';
                  if (materialKey.includes('3mm_White')) materialKey = 'Fondo 3mm Blanco';
                  
                  if (!groupedByMaterial[materialKey]) {
                      groupedByMaterial[materialKey] = [];
                  }
                  
                  groupedByMaterial[materialKey].push({
                      id: `${mod.name.substring(0,3)}_${part.name.substring(0,3)}`,
                      width: Math.floor(part.width),
                      height: Math.floor(part.height),
                      quantity: part.quantity * (mod.quantity || 1)
                  });
              });
          });
      });

      const results: Record<string, Sheet[]> = {};
      
      Object.keys(groupedByMaterial).forEach(material => {
          const input = {
              pieces: groupedByMaterial[material],
              sheetWidth: 2750,
              sheetHeight: 1830,
              kerf: 3 // Blade kerf thickness
          };
          const { sheets } = generateCutPlan(input);
          results[material] = sheets;
      });

      setOptimizationResult(results);
      if (Object.keys(results).length > 0) {
          setActiveMaterialTab(Object.keys(results)[0]);
          setIsOptimizationModalOpen(true);
      } else {
          alert("No hay piezas para optimizar.");
      }
  };

  // Helper function to group pieces for the Cut List (Technical Decomposition)
  const getDecomposedCutList = () => {
      const itemsToProcess = technicalItems.length > 0 ? technicalItems : items;
      
      // Structure: Material Name -> Thickness -> List of Pieces
      const grouped: Record<string, Record<string, any[]>> = {};

      itemsToProcess.forEach(item => {
          item.modules.forEach(mod => {
              const parts = calculateModuleParts(mod);
              const qty = mod.quantity || 1;

              parts.forEach(part => {
                  // Determine Material Name and Thickness based on logic
                  let matName = "Otros";
                  let thickness = "18mm";
                  let allowRotation = true; // Default

                  const isFront = part.name.includes('Frente') || part.name.includes('Puerta');
                  const colorName = mod.materialColorName || 'Estándar';
                  const frontName = mod.materialFrontName || colorName;

                  if (part.material.includes('18mm')) {
                      thickness = "18mm";
                      // Determine specific name based on module config
                      if (part.material.includes('Color')) matName = isFront ? frontName : colorName;
                      else if (part.material.includes('White')) matName = 'Melamina Blanca';
                      else if (part.material.includes('MDF')) {
                          matName = isFront ? frontName : colorName;
                          if (matName === 'Estándar' || !matName) matName = 'MDF Crudo';
                      }
                      
                      // Check grain for rotation
                      if (part.grain !== 'free') allowRotation = false; // Usually wood-like patterns
                  } else if (part.material.includes('15mm')) {
                      thickness = "15mm";
                      matName = 'Melamina Blanca (Cajón)';
                  } else if (part.material.includes('5.5mm')) {
                      thickness = "5.5mm";
                      matName = 'Fondo Color';
                  } else if (part.material.includes('3mm')) {
                      thickness = "3mm";
                      matName = 'Fondo Blanco';
                  }

                  if (!grouped[matName]) grouped[matName] = {};
                  if (!grouped[matName][thickness]) grouped[matName][thickness] = [];

                  grouped[matName][thickness].push({
                      id: part.name,
                      moduleRef: mod.name,
                      quantity: part.quantity * qty,
                      width: Math.floor(part.width),
                      height: Math.floor(part.height),
                      grain: part.grain || 'free',
                      allowRotation: allowRotation
                  });
              });
          });
      });

      return grouped;
  };

  const executeLoad = (estimate: SavedEstimate) => {
      if (confirm("Cargar esta estimación reemplazará los items actuales en el área de trabajo. ¿Continuar?")) {
          setItems(estimate.modules as any); 
          setSettings(estimate.settingsSnapshot);
          
          if (estimate.projectId) {
              setSelectedProjectId(estimate.projectId);
              setCustomProjectName('');
          } else {
              setSelectedProjectId('NEW');
              setCustomProjectName(estimate.customProjectName || '');
          }
          
          setView('RESULTS'); 
          setPrintMode('NONE');
      }
  };

  const executeViewQuote = (estimate: SavedEstimate) => {
      // Open the edit modal directly so the user can review/edit before viewing
      setEditingEstimate({
          ...estimate,
          quoteData: estimate.quoteData || {
              title: 'Amoblamiento Integral',
              reference: estimate.customProjectName || getProjectTitleById(estimate.projectId || ''),
              observations: DEFAULT_OBSERVATIONS,
              conditions: DEFAULT_CONDITIONS,
              enabledScenarios: { white: true, textured: true, lacquer: false, veneer: false }
          }
      });
      setIsEditEstimateModalOpen(true);
  };

  const handleDelete = (e: any, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (onDeleteEstimate) onDeleteEstimate(id);
  };

  const handleAddModule = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingId) {
          setPendingModules(prev => prev.map(m => m.id === editingId ? { ...moduleForm, id: editingId } as ExtendedCabinetModule : m));
          setEditingId(null);
      } else {
          const newMod = { ...moduleForm, id: `m${Date.now()}` } as ExtendedCabinetModule;
          setPendingModules(prev => [...prev, newMod]);
      }
      setModuleForm(INITIAL_MODULE_FORM);
  };

  const handleInputChange = (field: keyof ExtendedCabinetModule, value: any) => {
      setModuleForm(prev => {
          const next = { ...prev, [field]: value };
          
          // Lógica de Validación de Regla de Negocio: Laqueado/Enchapado -> MDF
          const isLacquer = next.moduleType?.includes('LACQUER');
          const isVeneer = next.moduleType?.includes('VENEER');
          
          if ((isLacquer || isVeneer) && next.frontsCore !== 'MDF') {
              setValidationWarning("Regla de Calidad: Los acabados Laqueados o Enchapados requieren obligatoriamente una base de MDF.");
          } else {
              setValidationWarning(null);
          }
          
          return next;
      });
  };
  const handleAddExtra = () => {
      if (!newExtra.description.trim() || newExtra.unitPrice < 0) return;
      setModuleForm(prev => ({ ...prev, extras: [...(prev.extras || []), { ...newExtra, id: `ex${Date.now()}` }] }));
      setNewExtra({ id: '', description: '', quantity: 1, unit: 'un', unitPrice: 0 });
  };
  const handleRemoveExtra = (id: string) => setModuleForm(prev => ({ ...prev, extras: prev.extras?.filter(e => e.id !== id) }));
  
  const handleCancelEdit = () => { setEditingId(null); setModuleForm(INITIAL_MODULE_FORM); };
  const handleEditModule = (mod: ExtendedCabinetModule) => { setEditingId(mod.id); setModuleForm(mod); };

    const downloadEstimateFile = (estimate: SavedEstimate) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(estimate, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `presupuesto_${estimate.id}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleSaveEditedEstimate = (andView = false) => {
        if (!editingEstimate || !onSaveEstimate) return;
        
        // Get selected items (those not in removedItemIds)
        const selectedItemsList = (editingEstimate.items || []).filter(item => 
            !(editingEstimate as any)._removedItemIds?.includes(item.id)
        );
        const snapshot = editingEstimate.financialsSnapshot || editingEstimate.settingsSnapshot;
        
        const totalRef = selectedItemsList.reduce((sum, item) => {
            const prices = getRecalculatedItemPrices(item, snapshot);
            return sum + prices.colorAglo;
        }, 0);

        const updatedEstimate: SavedEstimate = {
            ...editingEstimate,
            items: selectedItemsList,
            modules: selectedItemsList.flatMap(i => i.modules) as any,
            finalPrice: totalRef,
            totalDirectCost: selectedItemsList.reduce((sum, item) => {
                const prices = getRecalculatedItemPrices(item, snapshot);
                return sum + prices.totalDirectCost;
            }, 0),
            date: new Date().toISOString()
        };

        onSaveEstimate(updatedEstimate);
        setIsEditEstimateModalOpen(false);
        
        if (andView) {
            // Load into view mode
            setItems(updatedEstimate.modules as any);
            setSettings(updatedEstimate.settingsSnapshot);
            setActiveSettings(updatedEstimate.settingsSnapshot);
            const qd = updatedEstimate.quoteData;
            setQuoteObservations(qd?.observations || DEFAULT_OBSERVATIONS); 
            setQuoteConditions(qd?.conditions || DEFAULT_CONDITIONS);
            setQuoteVersion(updatedEstimate.version);
            setSelectedItemIds(new Set(selectedItemsList.map(i => i.id)));
            setQuoteItemTitle(qd?.title || 'Amoblamiento Integral');
            setQuoteReference(qd?.reference || updatedEstimate.customProjectName || getProjectTitleById(updatedEstimate.projectId || ''));
            setQuoteId(updatedEstimate.id.substring(0, 8).toUpperCase());
            if (qd?.enabledScenarios) setEnabledScenarios(qd.enabledScenarios as any);
            setView('RESULTS');
            setPrintMode('ECONOMIC');
        }
        
        setEditingEstimate(null);
    };

    const handleUpdateEditingEstimate = (field: string, value: any) => {
        if (!editingEstimate) return;
        setEditingEstimate(prev => {
            if (!prev) return null;
            if (field.includes('.')) {
                const parts = field.split('.');
                const next = { ...prev };
                let current: any = next;
                for (let i = 0; i < parts.length - 1; i++) {
                    current[parts[i]] = { ...current[parts[i]] };
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
                return next;
            }
            return { ...prev, [field]: value };
        });
    };

    const toggleItemInEditingEstimate = (itemId: string) => {
        if (!editingEstimate) return;
    };

    const handleCommercialStatusChange = (estimateId: string, newStatus: CommercialStatus) => {
        if (onSaveEstimate) {
            const estimateToUpdate = savedEstimates.find(e => e.id === estimateId);
            if (estimateToUpdate) {
                const auditLog = estimateToUpdate.auditLog || [];
                onSaveEstimate({ 
                    ...estimateToUpdate, 
                    commercialStatus: newStatus,
                    auditLog: [...auditLog, { 
                        from: estimateToUpdate.commercialStatus || 'N/A', 
                        to: newStatus, 
                        timestamp: new Date().toISOString(),
                        user: 'Usuario Actual'
                    }]
                });
            }
        }
    };

    const handleProductionStatusChange = (estimateId: string, newStatus: ProductionStatus) => {
        if (onSaveEstimate) {
            const estimateToUpdate = savedEstimates.find(e => e.id === estimateId);
            if (estimateToUpdate) {
                const auditLog = estimateToUpdate.auditLog || [];
                const isFinishing = newStatus === ProductionStatus.READY;
                
                onSaveEstimate({ 
                    ...estimateToUpdate, 
                    productionStatus: newStatus,
                    commercialStatus: isFinishing ? CommercialStatus.FINISHED : estimateToUpdate.commercialStatus,
                    isArchived: isFinishing ? true : estimateToUpdate.isArchived,
                    auditLog: [...auditLog, { 
                        from: estimateToUpdate.productionStatus || 'N/A', 
                        to: newStatus, 
                        timestamp: new Date().toISOString(),
                        user: 'Usuario Actual'
                    },
                    ...(isFinishing ? [{
                        from: estimateToUpdate.commercialStatus || 'N/A',
                        to: CommercialStatus.FINISHED,
                        timestamp: new Date().toISOString(),
                        user: 'Sistema (Entrega de Obra)'
                    }] : [])]
                });

                if (isFinishing) {
                    alert("Obra finalizada y movida al archivo de obras realizadas.");
                }
            }
        }
    };

    const handlePublishToWorkshop = (estimateId: string) => {
        if (onSaveEstimate) {
            const estimateToUpdate = savedEstimates.find(e => e.id === estimateId);
            if (estimateToUpdate) {
                onSaveEstimate({ 
                    ...estimateToUpdate, 
                    isPublished: true,
                    lastPublishedAt: new Date().toISOString()
                });
                alert("Cambios publicados al taller exitosamente.");
            }
        }
    };

    const [vinculandoEstimateId, setVinculandoEstimateId] = React.useState<string | null>(null);
    const [vinculandoProjectId, setVinculandoProjectId] = React.useState('');

    const handleConfirmVincular = () => {
        if (!vinculandoEstimateId || !onSaveEstimate) return;
        const estimateToUpdate = savedEstimates.find(e => e.id === vinculandoEstimateId);
        if (estimateToUpdate) {
            onSaveEstimate({
                ...estimateToUpdate,
                projectId: vinculandoProjectId || estimateToUpdate.projectId,
                commercialStatus: CommercialStatus.IN_PRODUCTION,
                auditLog: [...(estimateToUpdate.auditLog || []), {
                    from: estimateToUpdate.commercialStatus || 'N/A',
                    to: CommercialStatus.IN_PRODUCTION,
                    timestamp: new Date().toISOString(),
                    user: 'Usuario Actual'
                }]
            });
            alert(`Estimación vinculada al proyecto y puesta En Producción.`);
        }
        setVinculandoEstimateId(null);
        setVinculandoProjectId('');
    };

    const handleStatusChange = (estimateId: string, newStatus: BudgetStatus) => {
      if (onSaveEstimate) {
          const estimateToUpdate = savedEstimates.find(e => e.id === estimateId);
          if (estimateToUpdate) {
              const statusHistory = estimateToUpdate.statusHistory || [];
              onSaveEstimate({ 
                  ...estimateToUpdate, 
                  status: newStatus,
                  statusHistory: [...statusHistory, { status: newStatus, date: new Date().toISOString() }]
              });
          }
      }
  };

  const handleArchive = (estimateId: string) => {
      if (onSaveEstimate) {
          const estimateToUpdate = savedEstimates.find(e => e.id === estimateId);
          if (estimateToUpdate) {
              onSaveEstimate({ ...estimateToUpdate, isArchived: true });
          }
      }
  };

  const filteredEstimates = savedEstimates.filter(estimate => {
      const matchesSearch = estimate.customProjectName?.toLowerCase().includes(historySearch.toLowerCase()) ||
                            getProjectTitleById(estimate.projectId).toLowerCase().includes(historySearch.toLowerCase());
      const matchesStatus = filterStatus === 'ALL' || estimate.status === filterStatus;
      return estimate.isLatest && matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const handleSavePriceList = () => {
      if (!newListName.trim()) return;
      setPriceHistory([{ id: `h${Date.now()}`, date: new Date().toISOString(), name: newListName, settings: { ...settings } }, ...priceHistory]);
      setNewListName('');
  };
  const handleLoadPriceList = (id: string) => {
      const h = priceHistory.find(x => x.id === id);
      if (h && confirm('¿Cargar lista?')) setSettings({ ...h.settings });
  };

  const calculateGlobalSummary = (items: EstimatorItem[]) => {
      const globalBoards: Record<string, number> = {};
      const globalHardware: Record<string, number> = {};
      
      items.forEach(item => {
          const q = calculateItemQuantities(item.modules);
          
          Object.entries(q.detailedBoards).forEach(([key, val]) => {
              globalBoards[key] = (globalBoards[key] || 0) + val;
          });
          Object.entries(q.detailedHardware).forEach(([key, val]) => {
              globalHardware[key] = (globalHardware[key] || 0) + val;
          });
      });
      return { globalBoards, globalHardware };
  };

  const handleGenerateCostSheet = () => {
      if (selectedItemIds.size === 0) {
          alert("Debe seleccionar al menos un item.");
          return;
      }
      setPendingPrintType('COSTS');
      setIsPriceListModalOpen(true);
  };

  const getRecalculatedItemPrices = (item: EstimatorItem, snapshot: CostSettings) => {
      const laborCost = item.labor.workers * item.labor.days * snapshot.costLaborDay;
      const margins = item.margins;
      const costSnapshot: CostSnapshot = { ...snapshot, currency: 'ARS', timestamp: '' };

      const whiteAglo = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: true, isMDFCore: false }, costSnapshot);
      const whiteMDF = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: true, isMDFCore: true }, costSnapshot);
      const colorAglo = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: false, isMDFCore: false }, costSnapshot);
      const colorMDF = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'MELAMINE_FULL', isWhiteStructure: false, isMDFCore: true }, costSnapshot);
      const lacquer = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'LACQUER_FULL', isWhiteStructure: false, isMDFCore: false }, costSnapshot);
      const veneer = calculateFinancialsForScenario(item.modules, laborCost, margins, { moduleType: 'VENEER_FULL', isWhiteStructure: false, isMDFCore: false }, costSnapshot);

      return {
          whiteAglo: whiteAglo.finalPrice,
          whiteMDF: whiteMDF.finalPrice,
          colorAglo: colorAglo.finalPrice,
          colorMDF: colorMDF.finalPrice,
          lacquer: lacquer.finalPrice,
          veneer: veneer.finalPrice,
          totalDirectCost: colorAglo.totalDirectCost
      };
  };

  if (printMode === 'SUPPLIES' || printMode === 'CUTTING' || printMode === 'COSTS' || printMode === 'PRODUCTION_ORDER') {
      const itemsToPrint = technicalItems.length > 0 ? technicalItems : items.filter(i => selectedItemIds.has(i.id));
      const summary = calculateGlobalSummary(itemsToPrint);
      const cutList = printMode === 'CUTTING' ? getDecomposedCutList() : {};

      return (
        <div className="animate-fade-in min-h-screen bg-gray-100/50 print:bg-white flex flex-col items-center font-sans">
             <style>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body * {
                        visibility: hidden;
                    }
                    .print-container, .print-container * {
                        visibility: visible;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0;
                        padding: 0;
                        background: white;
                        z-index: 9999;
                    }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
             <div className="no-print w-full max-w-[210mm] flex flex-col gap-4 mb-6 pt-6">
                <div className="flex justify-between items-center">
                    <button onClick={() => setPrintMode('NONE')} className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200"><ArrowLeft size={16} /> Volver</button>
                    <button onClick={() => window.print()} className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"><Printer size={16} /> Imprimir Documento</button>
                </div>
                
                {printMode !== 'COSTS' && (
                    <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
                        <button 
                            onClick={() => setPrintMode('SUPPLIES')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${printMode === 'SUPPLIES' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <ShoppingCart size={16}/> Reporte Técnico (Materiales)
                        </button>
                        <button 
                            onClick={() => setPrintMode('CUTTING')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${printMode === 'CUTTING' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Grid size={16}/> Listado de Corte
                        </button>
                        <button 
                            onClick={() => setPrintMode('PRODUCTION_ORDER')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${printMode === 'PRODUCTION_ORDER' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Package size={16}/> Orden de Producción
                        </button>
                    </div>
                )}
            </div>

            <div className="print-container relative w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none flex flex-col">
                <header className="h-[14mm] bg-black text-white flex items-center justify-between px-10 relative">
                    <div className="flex items-baseline gap-4"><h1 className="text-4xl font-bold tracking-tighter leading-none">rødën</h1><span className="text-3xl font-light text-gray-500 pb-0.5">|</span><span className="text-lg font-medium mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {printMode === 'SUPPLIES' ? 'Reporte Técnico' : printMode === 'CUTTING' ? 'Listado de Corte' : 'Costos de Producción'}
                    </span></div>
                    <div className="text-right">
                        <div className="text-sm font-bold">{new Date().toLocaleDateString()}</div>
                        <div className="text-xs font-light text-gray-300">1/1</div>
                    </div>
                </header>
                
                <div className="px-12 py-8 flex-1 flex flex-col font-mono text-sm">
                    <div className="border-b border-gray-300 pb-4 mb-6">
                        <h2 className="text-xl font-bold uppercase mb-1">
                            {printMode === 'SUPPLIES' ? 'SECCIÓN 1 — REPORTE TÉCNICO' : 
                             printMode === 'CUTTING' ? 'SECCIÓN 2 — LISTADO DE CORTE' : 
                             printMode === 'PRODUCTION_ORDER' ? 'ORDEN DE PRODUCCIÓN' :
                             'X — COSTOS'}
                        </h2>
                        <p>Proyecto: {getActiveProjectName()}</p>
                        {printMode === 'PRODUCTION_ORDER' && (
                            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                                <div><strong>Orden N°:</strong> {productionOrderInfo.orderNumber}</div>
                                <div><strong>Fecha Emisión:</strong> {new Date().toLocaleDateString()}</div>
                                <div><strong>Inicio Est.:</strong> {new Date(productionOrderInfo.startDate).toLocaleDateString()}</div>
                                <div><strong>Entrega Est.:</strong> {new Date(productionOrderInfo.deliveryDate).toLocaleDateString()}</div>
                            </div>
                        )}
                    </div>

                    {printMode === 'PRODUCTION_ORDER' && (
                        <div className="space-y-8">
                            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                <h3 className="font-bold uppercase text-sm mb-3 border-b border-gray-300 pb-1">Datos de Producción</h3>
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                    <div>
                                        <label className="block text-gray-400 uppercase font-bold mb-1">Operarios</label>
                                        <input type="number" className="w-full border p-1 rounded no-print" value={productionOrderInfo.workers} onChange={e => setProductionOrderInfo({...productionOrderInfo, workers: Number(e.target.value)})}/>
                                        <span className="hidden print:block">{productionOrderInfo.workers} personas</span>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 uppercase font-bold mb-1">Fecha Inicio</label>
                                        <input type="date" className="w-full border p-1 rounded no-print" value={productionOrderInfo.startDate} onChange={e => setProductionOrderInfo({...productionOrderInfo, startDate: e.target.value})}/>
                                        <span className="hidden print:block">{new Date(productionOrderInfo.startDate).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 uppercase font-bold mb-1">Fecha Entrega</label>
                                        <input type="date" className="w-full border p-1 rounded no-print" value={productionOrderInfo.deliveryDate} onChange={e => setProductionOrderInfo({...productionOrderInfo, deliveryDate: e.target.value})}/>
                                        <span className="hidden print:block">{new Date(productionOrderInfo.deliveryDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold border-b border-black mb-3 uppercase text-lg">1. Definición Técnica por Ítem</h3>
                                <div className="space-y-4">
                                    {itemsToPrint.map((item, idx) => (
                                        <div key={item.id} className="border border-gray-200 p-3 rounded bg-white">
                                            <div className="font-bold text-sm mb-2">{idx + 1}. {item.name}</div>
                                            <div className="grid grid-cols-3 gap-4 text-[10px] text-gray-600">
                                                <div><strong>Estructura:</strong> {item.modules[0]?.materialColorName || 'A definir'} ({item.modules[0]?.structureCore || 'AGLO'})</div>
                                                <div><strong>Frentes:</strong> {item.modules[0]?.materialFrontName || 'A definir'} ({item.modules[0]?.frontsCore || 'AGLO'})</div>
                                                <div><strong>Herrajes:</strong> {SLIDE_LABELS[item.modules[0]?.slideType as keyof typeof SLIDE_LABELS] || 'Estándar'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="break-before-page pt-8">
                                <h3 className="font-bold border-b border-black mb-4 uppercase text-lg">2. Reporte de Insumos</h3>
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="font-bold text-xs uppercase mb-2 text-gray-500">Placas y Tableros</h4>
                                        <ul className="text-xs space-y-1">
                                            {Object.entries(summary.globalBoards).map(([name, count]) => (
                                                <li key={name} className="flex justify-between border-b border-gray-100 py-1">
                                                    <span>{name}</span>
                                                    <span className="font-bold">{count} un.</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xs uppercase mb-2 text-gray-500">Herrajes y Accesorios</h4>
                                        <ul className="text-xs space-y-1">
                                            {Object.entries(summary.globalHardware).map(([name, count]) => (
                                                <li key={name} className="flex justify-between border-b border-gray-100 py-1">
                                                    <span>{name}</span>
                                                    <span className="font-bold">{count}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="break-before-page pt-8">
                                <h3 className="font-bold border-b border-black mb-4 uppercase text-lg">3. Planilla de Cortes</h3>
                                {Object.entries(cutList).map(([material, thicknesses]) => (
                                    <div key={material} className="mb-6">
                                        <h4 className="font-bold bg-gray-100 p-1 uppercase text-[10px] mb-2">{material}</h4>
                                        {Object.entries(thicknesses).map(([thick, pieces]) => (
                                            <div key={thick} className="mb-4">
                                                <table className="w-full text-left text-[9px] border-collapse border border-gray-200">
                                                    <thead>
                                                        <tr className="bg-gray-50">
                                                            <th className="border px-1 py-0.5">Ref.</th>
                                                            <th className="border px-1 py-0.5 text-center">Cant.</th>
                                                            <th className="border px-1 py-0.5 text-center">Ancho</th>
                                                            <th className="border px-1 py-0.5 text-center">Largo</th>
                                                            <th className="border px-1 py-0.5 text-center">Veta</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(pieces as any[]).map((p, idx) => (
                                                            <tr key={idx}>
                                                                <td className="border px-1 py-0.5">{p.moduleRef.substring(0,15)}</td>
                                                                <td className="border px-1 py-0.5 text-center font-bold">{p.quantity}</td>
                                                                <td className="border px-1 py-0.5 text-center">{p.width}</td>
                                                                <td className="border px-1 py-0.5 text-center">{p.height}</td>
                                                                <td className="border px-1 py-0.5 text-center uppercase">{p.grain === 'horizontal' ? 'H' : p.grain === 'vertical' ? 'V' : '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 border-t-2 border-black pt-4 text-[10px] flex justify-between items-end">
                                <div>
                                    <div className="font-bold uppercase mb-1">Observaciones Generales:</div>
                                    <div className="max-w-md italic">{technicalObservations || "Sin observaciones adicionales."}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">ORDEN DE PRODUCCIÓN: {productionOrderInfo.orderNumber}</div>
                                    <div className="text-gray-400">Generado el {new Date().toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {(printMode === 'SUPPLIES' || printMode === 'PRODUCTION_ORDER') && printMode !== 'PRODUCTION_ORDER' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="font-bold border-b border-black mb-2 uppercase text-lg">A) Resumen de Materiales</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    {Object.entries(summary.globalBoards).map(([name, count]) => (
                                        <li key={name}><strong>{count}</strong> x {name}</li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold border-b border-black mb-2 uppercase text-lg">B) Cantidades de Herrajes</h3>
                                <div className="columns-2 gap-8">
                                    <ul className="list-disc pl-5 space-y-1 break-inside-avoid">
                                        {Object.entries(summary.globalHardware).map(([name, count]) => (
                                            <li key={name} className="flex justify-between items-center text-sm mb-1">
                                                <span>{name}</span>
                                                <strong className="bg-gray-100 px-2 py-0.5 rounded">{count}</strong>
                                            </li>
                                        ))}
                                        {itemsToPrint.flatMap(i => i.modules).flatMap(m => m.extras || []).map((ex, i) => (
                                            <li key={i} className="flex justify-between items-center text-sm mb-1 text-indigo-900">
                                                <span>{ex.description}</span>
                                                <strong className="bg-indigo-50 px-2 py-0.5 rounded">{ex.quantity} {ex.unit}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="mt-8 border-t border-gray-300 pt-4">
                                <h4 className="font-bold uppercase text-sm mb-2">Observaciones:</h4>
                                <div className="border border-gray-300 rounded p-4 min-h-[100px] whitespace-pre-wrap">
                                    {technicalObservations || "Sin observaciones adicionales."}
                                </div>
                            </div>
                        </div>
                    )}

                    {printMode === 'CUTTING' && (
                        <div>
                            {Object.entries(cutList).map(([material, thicknesses]) => (
                                <div key={material} className="mb-8">
                                    <h3 className="font-bold bg-black text-white p-2 uppercase text-sm mb-4">{material}</h3>
                                    {Object.entries(thicknesses).map(([thick, pieces]) => (
                                        <div key={thick} className="mb-6 break-inside-avoid">
                                            <h4 className="font-bold border-b border-gray-300 mb-2 pl-2">Espesor: {thick}</h4>
                                            <table className="w-full text-left text-[10px] border-collapse border border-gray-300 mb-4">
                                                <thead>
                                                    <tr className="bg-gray-100">
                                                        <th className="border px-2 py-1">ID Pieza</th>
                                                        <th className="border px-2 py-1">Ref. Módulo</th>
                                                        <th className="border px-2 py-1 text-center">Cant.</th>
                                                        <th className="border px-2 py-1 text-center">Ancho (mm)</th>
                                                        <th className="border px-2 py-1 text-center">Alto (mm)</th>
                                                        <th className="border px-2 py-1 text-center">Veta</th>
                                                        <th className="border px-2 py-1 text-center">Rotación</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(pieces as any[]).map((p, idx) => (
                                                        <tr key={idx} className="odd:bg-white even:bg-gray-50">
                                                            <td className="border px-2 py-1 font-bold">{p.id}</td>
                                                            <td className="border px-2 py-1">{p.moduleRef}</td>
                                                            <td className="border px-2 py-1 text-center font-bold">{p.quantity}</td>
                                                            <td className="border px-2 py-1 text-center">{p.width}</td>
                                                            <td className="border px-2 py-1 text-center">{p.height}</td>
                                                            <td className="border px-2 py-1 text-center uppercase">{p.grain === 'horizontal' ? 'Horizontal' : p.grain === 'vertical' ? 'Vertical' : 'Libre'}</td>
                                                            <td className="border px-2 py-1 text-center">{p.allowRotation ? 'Sí' : 'No'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            ))}

                            <div className="break-before-page no-print">
                                <h3 className="font-bold bg-black text-white p-2 uppercase text-sm mb-4 flex justify-between items-center">
                                    Herramientas de Taller
                                    <button onClick={handleOptimizeCut} className="bg-white text-black px-2 py-0.5 text-xs rounded font-bold uppercase no-print">
                                        Abrir Visualizador Optimizador
                                    </button>
                                </h3>
                                <p className="text-xs text-gray-500">Nota: El visualizador es una herramienta de referencia. El reporte impreso oficial es el listado superior.</p>
                            </div>
                        </div>
                    )}

                    {printMode === 'COSTS' && (
                        <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded text-sm text-amber-800 mb-6 break-inside-avoid">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <strong className="block mb-1">Nota Confidencial:</strong>
                                        Esta planilla detalla los costos directos de fabricación y el precio final de taller. 
                                        <strong> No incluye el beneficio comercial de Roden.</strong>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold uppercase text-amber-600 block">Lista de Precios Utilizada:</span>
                                        <span className="font-bold">{activeSettings.name || 'Lista Actual'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* RESUMEN GENERAL */}
                             <table className="w-full text-left text-xs border-collapse border border-gray-300 mb-6">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-300 p-2">Ítem</th>
                                        <th className="border border-gray-300 p-2 text-right">Materiales</th>
                                        <th className="border border-gray-300 p-2 text-right">Herrajes</th>
                                        <th className="border border-gray-300 p-2 text-right">M. Obra</th>
                                        <th className="border border-gray-300 p-2 text-right">Terminación</th>
                                        <th className="border border-gray-300 p-2 text-right bg-gray-200 font-bold">Costo Directo</th>
                                        <th className="border border-gray-300 p-2 text-right">Margen Taller</th>
                                        <th className="border border-gray-300 p-2 text-right bg-black text-white font-bold">Precio Taller</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemsToPrint.map((item) => {
                                        const q = calculateItemQuantities(item.modules);
                                        const laborCost = item.labor.workers * item.labor.days * activeSettings.costLaborDay * q.avgComplexity;
                                        
                                        const matCost = 
                                            (q.boards18Color * activeSettings.priceBoard18ColorAglo) +
                                            (q.boards18White * activeSettings.priceBoard18WhiteAglo) +
                                            (q.boards18MDFMelamine * activeSettings.priceBoard18ColorMDF) + 
                                            (q.boards18MDF * activeSettings.priceBoard18MDFCrudo1Face) +
                                            (q.boards15 * activeSettings.priceBoard15WhiteAglo) +
                                            (q.backing55 * activeSettings.priceBacking55Color) +
                                            (q.backing3 * activeSettings.priceBacking3White) +
                                            (q.linearWhite22 * activeSettings.priceEdge22White045) +
                                            (q.linearWhite45 * activeSettings.priceEdge45White045) +
                                            (q.linearColor22 * activeSettings.priceEdge22Color045) +
                                            (q.linearColor45 * activeSettings.priceEdge45Color045) +
                                            (q.linear2mm * activeSettings.priceEdge2mm);

                                        const hwCost = (q.totalHinges * activeSettings.priceHingeStandard) + 
                                                       (q.totalPistons * activeSettings.priceGasPiston) +
                                                       (q.totalSlides * activeSettings.priceSlide500Std) +
                                                       q.totalExtrasCost + activeSettings.priceGlueTin;
                                        
                                        const finishCost = (q.lacquerAreaM2 * activeSettings.priceFinishLacquerSemi) + (q.veneerAreaM2 * activeSettings.priceFinishLustreSemi);
                                        const screwsCost = activeSettings.priceScrews;

                                        const totalDirect = matCost + hwCost + screwsCost + laborCost + finishCost;
                                        const workshopProfit = totalDirect * (costSheetMargin / 100);
                                        const workshopPrice = totalDirect + workshopProfit;

                                        return (
                                            <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                                                <td className="border border-gray-300 p-2 font-bold">{item.name}</td>
                                                <td className="border border-gray-300 p-2 text-right">{formatCurrency(matCost)}</td>
                                                <td className="border border-gray-300 p-2 text-right">{formatCurrency(hwCost)}</td>
                                                <td className="border border-gray-300 p-2 text-right">{formatCurrency(laborCost)}</td>
                                                <td className="border border-gray-300 p-2 text-right">{formatCurrency(finishCost)}</td>
                                                <td className="border border-gray-300 p-2 text-right font-bold bg-gray-100">{formatCurrency(totalDirect)}</td>
                                                <td className="border border-gray-300 p-2 text-right text-gray-500">{costSheetMargin}%</td>
                                                <td className="border border-gray-300 p-2 text-right font-bold text-lg">{formatCurrency(workshopPrice)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-200 border-t-2 border-black">
                                        <td colSpan={5} className="p-3 text-right font-bold uppercase">Totales Generales</td>
                                        <td className="p-3 text-right font-bold">
                                            {formatCurrency(itemsToPrint.reduce((acc, item) => {
                                                const q = calculateItemQuantities(item.modules);
                                                const laborCost = item.labor.workers * item.labor.days * settings.costLaborDay;
                                                const matCost = (q.boards18Color * settings.priceBoard18ColorAglo) + (q.boards18White * settings.priceBoard18WhiteAglo) + (q.boards18MDFMelamine * settings.priceBoard18ColorMDF) + (q.boards18MDF * settings.priceBoard18MDFCrudo1Face) + (q.boards15 * settings.priceBoard15WhiteAglo) + (q.backing55 * settings.priceBacking55Color) + (q.backing3 * settings.priceBacking3White) + (q.linearWhite22 * settings.priceEdge22White045) + (q.linearWhite45 * settings.priceEdge45White045) + (q.linearColor22 * settings.priceEdge22Color045) + (q.linearColor45 * settings.priceEdge45Color045) + (q.linear2mm * settings.priceEdge2mm);
                                                const hwCost = (q.totalHinges * settings.priceHingeStandard) + (q.totalPistons * settings.priceGasPiston) + (q.totalSlides * settings.priceSlide500Std) + q.totalExtrasCost + settings.priceGlueTin;
                                                const finishCost = (q.lacquerAreaM2 * settings.priceFinishLacquerSemi) + (q.veneerAreaM2 * settings.priceFinishLustreSemi);
                                                const screwsCost = settings.priceScrews;
                                                const totalDirect = matCost + hwCost + screwsCost + laborCost + finishCost;
                                                return acc + totalDirect;
                                            }, 0))}
                                        </td>
                                        <td></td>
                                        <td className="p-3 text-right font-bold text-xl bg-black text-white">
                                            {formatCurrency(itemsToPrint.reduce((acc, item) => {
                                                const q = calculateItemQuantities(item.modules);
                                                const laborCost = item.labor.workers * item.labor.days * activeSettings.costLaborDay * q.avgComplexity;
                                                const matCost = (q.boards18Color * activeSettings.priceBoard18ColorAglo) + (q.boards18White * activeSettings.priceBoard18WhiteAglo) + (q.boards18MDFMelamine * activeSettings.priceBoard18ColorMDF) + (q.boards18MDF * activeSettings.priceBoard18MDFCrudo1Face) + (q.boards15 * activeSettings.priceBoard15WhiteAglo) + (q.backing55 * activeSettings.priceBacking55Color) + (q.backing3 * activeSettings.priceBacking3White) + (q.linearWhite22 * activeSettings.priceEdge22White045) + (q.linearWhite45 * activeSettings.priceEdge45White045) + (q.linearColor22 * activeSettings.priceEdge22Color045) + (q.linearColor45 * activeSettings.priceEdge45Color045) + (q.linear2mm * activeSettings.priceEdge2mm);
                                                const hwCost = (q.totalHinges * activeSettings.priceHingeStandard) + (q.totalPistons * activeSettings.priceGasPiston) + (q.totalSlides * activeSettings.priceSlide500Std) + q.totalExtrasCost + activeSettings.priceGlueTin;
                                                const finishCost = (q.lacquerAreaM2 * activeSettings.priceFinishLacquerSemi) + (q.veneerAreaM2 * activeSettings.priceFinishLustreSemi);
                                                const screwsCost = activeSettings.priceScrews;
                                                const totalDirect = matCost + hwCost + screwsCost + laborCost + finishCost;
                                                const workshopProfit = totalDirect * (costSheetMargin / 100);
                                                return acc + (totalDirect + workshopProfit);
                                            }, 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* DETALLE POR ÍTEM */}
                            {itemsToPrint.map((item) => {
                                const q = calculateItemQuantities(item.modules);
                                const laborCost = item.labor.workers * item.labor.days * activeSettings.costLaborDay * q.avgComplexity;
                                return (
                                    <div key={item.id} className="break-inside-avoid mb-8 border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
                                            <span className="font-bold text-sm uppercase">{item.name} — Detalle</span>
                                            <span className="text-xs text-gray-300">{item.modules.length} módulos · {item.labor.workers} operario(s) · {item.labor.days} días</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200">
                                            {/* Materiales */}
                                            <div className="p-4">
                                                <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span> Materiales
                                                </h6>
                                                <table className="w-full text-[10px]">
                                                    <tbody>
                                                        {Object.entries(q.detailedBoards).map(([mat, qty]) => (
                                                            <tr key={mat} className="border-b border-gray-100">
                                                                <td className="py-1 text-gray-700">{mat}</td>
                                                                <td className="py-1 text-right font-bold text-gray-900">{qty} plancha(s)</td>
                                                            </tr>
                                                        ))}
                                                        {q.linearColor22 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Canto Color 22mm</td><td className="py-1 text-right font-bold">{q.linearColor22} m</td></tr>}
                                                        {q.linearWhite22 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Canto Blanco 22mm</td><td className="py-1 text-right font-bold">{q.linearWhite22} m</td></tr>}
                                                        {q.linearColor45 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Canto Color 45mm</td><td className="py-1 text-right font-bold">{q.linearColor45} m</td></tr>}
                                                        {q.linearWhite45 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Canto Blanco 45mm</td><td className="py-1 text-right font-bold">{q.linearWhite45} m</td></tr>}
                                                        {q.linear2mm > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Canto PVC 2mm</td><td className="py-1 text-right font-bold">{q.linear2mm} m</td></tr>}
                                                        {q.lacquerAreaM2 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Laqueado</td><td className="py-1 text-right font-bold">{q.lacquerAreaM2} m²</td></tr>}
                                                        {q.veneerAreaM2 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-700">Enchapado</td><td className="py-1 text-right font-bold">{q.veneerAreaM2} m²</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/* Herrajes y Mano de Obra */}
                                            <div className="p-4">
                                                <h6 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                    <span className="w-2 h-2 bg-amber-500 rounded-full inline-block"></span> Herrajes y Mano de Obra
                                                </h6>
                                                <table className="w-full text-[10px]">
                                                    <tbody>
                                                        {Object.entries(q.detailedHardware).map(([hw, qty]) => (
                                                            <tr key={hw} className="border-b border-gray-100">
                                                                <td className="py-1 text-gray-700">{hw}</td>
                                                                <td className="py-1 text-right font-bold text-gray-900">{qty} un.</td>
                                                            </tr>
                                                        ))}
                                                        {/* Extras */}
                                                        {item.modules.flatMap(m => m.extras || []).map((ex, i) => (
                                                            <tr key={`ex${i}`} className="border-b border-gray-100">
                                                                <td className="py-1 text-gray-700">{ex.description}</td>
                                                                <td className="py-1 text-right font-bold">{ex.quantity} {ex.unit}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="border-t border-gray-300 bg-gray-50">
                                                            <td className="py-1.5 font-bold text-gray-800">Mano de Obra</td>
                                                            <td className="py-1.5 text-right font-bold">{item.labor.workers} op. × {item.labor.days} días</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-1 text-gray-500 text-[9px]">Costo M.O. computado</td>
                                                            <td className="py-1 text-right font-bold text-gray-800">{formatCurrency(laborCost)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                </div>
                <footer className="h-[10mm] bg-gray-300 flex items-center justify-between px-10 border-t border-gray-300 leading-none text-gray-800">
                    <span className="text-xs tracking-wider">Devoto | Buenos Aires | Argentina</span><span className="text-xl font-bold">www.rodenmobel.com</span>
                </footer>
            </div>

            {/* OPTIMIZATION VISUALIZER MODAL */}
            {isOptimizationModalOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 print:hidden">
                    <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Grid size={20} /> Diagramas de Corte</h3>
                                <p className="text-xs text-gray-500">Visualización de placas optimizadas (Heurística Básica)</p>
                            </div>
                            <button onClick={() => setIsOptimizationModalOpen(false)} className="bg-white p-2 rounded-full hover:bg-gray-200 transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar Materials */}
                            <div className="w-64 bg-gray-100 border-r border-gray-200 overflow-y-auto p-2">
                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 px-2">Materiales</h4>
                                {Object.keys(optimizationResult).map(mat => (
                                    <button
                                        key={mat}
                                        onClick={() => setActiveMaterialTab(mat)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                                            activeMaterialTab === mat ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {mat}
                                        <span className="block text-[10px] text-gray-400 font-normal">
                                            {optimizationResult[mat].length} Placas
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Canvas Area */}
                            <div className="flex-1 bg-slate-200 p-8 overflow-y-auto">
                                <div className="max-w-4xl mx-auto space-y-8">
                                    {activeMaterialTab && optimizationResult[activeMaterialTab]?.map((sheet, idx) => (
                                        <div key={idx} className="bg-white shadow-lg p-2 rounded">
                                            <div className="flex justify-between items-center mb-2 px-2">
                                                <h5 className="font-bold text-sm">Placa {idx + 1}</h5>
                                                <span className="text-xs text-gray-400">{sheet.width}x{sheet.height}mm</span>
                                            </div>
                                            <div className="relative border-2 border-gray-800 bg-white" style={{ aspectRatio: `${sheet.width}/${sheet.height}` }}>
                                                {/* Render Pieces */}
                                                {sheet.placements.map((p, i) => (
                                                    <div
                                                        key={i}
                                                        className="absolute border border-gray-400 bg-indigo-100 flex items-center justify-center text-[10px] text-indigo-900 font-medium overflow-hidden"
                                                        style={{
                                                            left: `${(p.x / sheet.width) * 100}%`,
                                                            top: `${(p.y / sheet.height) * 100}%`,
                                                            width: `${(p.width / sheet.width) * 100}%`,
                                                            height: `${(p.height / sheet.height) * 100}%`,
                                                        }}
                                                        title={`${p.id} (${p.width}x${p.height})`}
                                                    >
                                                        <span className="truncate px-1">{p.id}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 text-right text-xs text-gray-500 px-2">
                                                Ocupación: {Math.round((sheet.placements.reduce((acc, p) => acc + (p.width * p.height), 0) / (sheet.width * sheet.height)) * 100)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
      );
  }

  if (printMode === 'ECONOMIC') {
      return (
        <div className="animate-fade-in min-h-screen bg-gray-100/50 print:bg-white flex flex-col items-center font-sans">
            <style>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body * {
                        visibility: hidden;
                    }
                    .print-container, .print-container * {
                        visibility: visible;
                    }
                    .print-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0;
                        padding: 0;
                        background: white;
                        z-index: 9999;
                    }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
            <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-6 pt-6">
                <button onClick={() => setPrintMode('NONE')} className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200"><ArrowLeft size={16} /> Volver</button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"><Printer size={16} /> Imprimir</button>
                </div>
            </div>
            <div className="print-container relative w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none flex flex-col">
                <header className="h-[14mm] bg-black text-white flex items-center justify-between px-10 relative">
                    <div className="flex items-baseline gap-4"><h1 className="text-4xl font-bold tracking-tighter leading-none">rødën</h1><span className="text-3xl font-light text-gray-500 pb-0.5">|</span><span className="text-lg font-medium mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Cotización</span></div>
                    <div className="text-right">
                        <div className="text-sm font-bold flex items-center justify-end gap-2">
                            Ref: {quoteId}
                            {quoteVersion && <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">v{quoteVersion}</span>}
                        </div>
                        <div className="text-xs font-light text-gray-300">1/1</div>
                    </div>
                </header>
                <div className="px-12 py-10 flex-1 flex flex-col text-black leading-relaxed">
                    <div className="mb-6">
                        <p className="font-bold mb-1">Att/ Estimado cliente:</p>
                        {quoteReference && <p className="text-sm font-bold mb-3 text-gray-700">Ref / {quoteReference}</p>}
                        <p className="text-justify text-sm">Por medio de la presente, tenemos el agrado de responder a su solicitud, haciéndole llegar a continuación nuestra mejor propuesta.</p>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-bold border-b border-black mb-4 uppercase text-sm pb-1">Detalle y Precios por Item: {quoteItemTitle}</h3>
                        <div className="space-y-4">
                                    {items.map((item, idx) => {
                                        const prices = getRecalculatedItemPrices(item, activeSettings);
                                        return (
                                            <div key={idx} className="text-sm mb-4 border-b border-gray-200 pb-2 break-inside-avoid">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-bold mb-1 text-base uppercase">• {item.name}</p>
                                                        <div className="pl-4 text-gray-700">
                                                            <p className="italic mb-1 text-xs">Diseño y medidas según proyecto.</p>
                                                            <ul className="list-disc pl-5 space-y-0 text-[10px] text-gray-500 leading-tight">
                                                                {Array.from(new Set(item.modules.flatMap(m => [
                                                                    m.calculateHinges ? HINGE_LABELS[m.hingeType || 'COMMON'] : null,
                                                                    m.calculateSlides ? SLIDE_LABELS[m.slideType || 'TELESCOPIC'] : null,
                                                                    m.hasGasPistons ? 'Pistones a Gas' : null
                                                                ].filter(Boolean)))).map((hw, i) => <li key={i}>{cleanHardwareName(hw as string)}</li>)}
                                                                {item.modules.flatMap(m => m.extras || []).map((ex, i) => <li key={`ex${i}`}>{ex.description} ({ex.quantity} {ex.unit})</li>)}
                                                            </ul>
                                                        </div>
                                                    </div>

                                                    <div className="w-56 shrink-0">
                                                        <table className="w-full text-xs border-collapse">
                                                            <thead>
                                                                <tr className="border-b border-gray-300">
                                                                    <th className="text-left py-1 text-[9px] text-gray-400">Variante</th>
                                                                    <th className="text-right py-1 text-[9px] text-gray-400">Base Aglo</th>
                                                                    <th className="text-right py-1 text-[9px] text-gray-400">Base MDF</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {enabledScenarios.white && (
                                                                    <tr className={`border-b border-gray-100 last:border-0 ${item.modules.every(m => !m.materialFrontName || m.materialFrontName.toLowerCase().includes('blanca')) && item.modules.some(m => m.materialColorName?.toLowerCase().includes('blanca')) ? 'bg-yellow-50 ring-1 ring-yellow-200' : ''}`}>
                                                                        <td className="py-1 text-gray-500 text-[10px] pl-1">Melamina Bca. {item.modules.every(m => !m.materialFrontName || m.materialFrontName.toLowerCase().includes('blanca')) && item.modules.some(m => m.materialColorName?.toLowerCase().includes('blanca')) && <span className="text-[8px] font-bold text-amber-600 ml-1">(Seleccionado)</span>}</td>
                                                                        <td className="py-1 text-right font-bold">{formatCurrency(roundUp10(prices.whiteAglo))}</td>
                                                                        <td className="py-1 text-right font-bold pr-1">{formatCurrency(roundUp10(prices.whiteMDF))}</td>
                                                                    </tr>
                                                                )}
                                                                {enabledScenarios.textured && (
                                                                    <tr className={`border-b border-gray-100 last:border-0 ${item.modules.some(m => m.materialFrontName?.toLowerCase().includes('color') || m.materialFrontName?.toLowerCase().includes('texturada') || (!m.materialFrontName && (m.materialColorName?.toLowerCase().includes('color') || m.materialColorName?.toLowerCase().includes('texturada')))) ? 'bg-yellow-50 ring-1 ring-yellow-200' : ''}`}>
                                                                        <td className="py-1 text-gray-500 text-[10px] pl-1">Melamina Color {item.modules.some(m => m.materialFrontName?.toLowerCase().includes('color') || m.materialFrontName?.toLowerCase().includes('texturada') || (!m.materialFrontName && (m.materialColorName?.toLowerCase().includes('color') || m.materialColorName?.toLowerCase().includes('texturada')))) && <span className="text-[8px] font-bold text-amber-600 ml-1">(Seleccionado)</span>}</td>
                                                                        <td className="py-1 text-right font-bold">{formatCurrency(roundUp10(prices.colorAglo))}</td>
                                                                        <td className="py-1 text-right font-bold pr-1">{formatCurrency(roundUp10(prices.colorMDF))}</td>
                                                                    </tr>
                                                                )}
                                                                {enabledScenarios.lacquer && (
                                                                    <tr className={`border-b border-gray-100 last:border-0 ${item.modules.some(m => m.moduleType?.includes('LACQUER')) ? 'bg-yellow-50 ring-1 ring-yellow-200' : ''}`}>
                                                                        <td className="py-1 text-gray-500 text-[10px] pl-1">Laqueado {item.modules.some(m => m.moduleType?.includes('LACQUER')) && <span className="text-[8px] font-bold text-amber-600 ml-1">(Seleccionado)</span>}</td>
                                                                        <td colSpan={2} className="py-1 text-right font-bold pr-1">{formatCurrency(roundUp10(prices.lacquer))}</td>
                                                                    </tr>
                                                                )}
                                                                {enabledScenarios.veneer && (
                                                                    <tr className={`border-b border-gray-100 last:border-0 ${item.modules.some(m => m.moduleType?.includes('VENEER')) ? 'bg-yellow-50 ring-1 ring-yellow-200' : ''}`}>
                                                                        <td className="py-1 text-gray-500 text-[10px] pl-1">Enchapado {item.modules.some(m => m.moduleType?.includes('VENEER')) && <span className="text-[8px] font-bold text-amber-600 ml-1">(Seleccionado)</span>}</td>
                                                                        <td colSpan={2} className="py-1 text-right font-bold pr-1">{formatCurrency(roundUp10(prices.veneer))}</td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                        </div>
                    </div>

                    <div className="mb-6"><h3 className="font-bold text-sm mb-2">Observaciones:</h3><p className="text-sm whitespace-pre-wrap">{quoteObservations}</p></div>
                    <div className="mb-6"><h3 className="font-bold text-sm mb-2">Condiciones generales:</h3><p className="text-sm whitespace-pre-wrap">{quoteConditions}</p></div>
                    <div className="mt-auto pt-4 text-center text-sm font-medium"><p>Quedamos a disposición. Saludamos cordialmente agradeciendo su consulta.</p></div>
                </div>
                <footer className="h-[10mm] bg-gray-300 flex items-center justify-between px-10 border-t border-gray-300 leading-none text-gray-800"><span className="text-xs tracking-wider">Devoto | Buenos Aires | Argentina</span><span className="text-xl font-bold">www.rodenmobel.com</span></footer>
            </div>
        </div>
      );
  }

  const groupedHistory = savedEstimates.reduce((acc, est) => {
      if (!!est.isArchived !== showArchived) return acc;
      const projectTitle = est.projectId ? getProjectTitleById(est.projectId) : est.customProjectName || 'Sin Nombre';
      if (historySearch && !projectTitle.toLowerCase().includes(historySearch.toLowerCase())) return acc;
      
      const projectKey = est.projectId || est.customProjectName || 'Sin Nombre';
      if (!acc[projectKey]) {
          acc[projectKey] = { name: projectTitle, docs: [] };
      }
      acc[projectKey].docs.push(est);
      return acc;
  }, {} as Record<string, { name: string, docs: SavedEstimate[] }>);

  const historyEntries = Object.entries(groupedHistory).sort((a, b) => {
      const dateA = (a[1] as any).docs[0]?.date || '';
      const dateB = (b[1] as any).docs[0]?.date || '';
      return dateB.localeCompare(dateA);
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col animate-fade-in">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
            <div><h2 className="text-xl font-bold text-roden-black flex items-center gap-2"><Calculator size={20}/> Estimador de Costos</h2></div>
            <div className="flex gap-2">
                <button onClick={() => setView('SETUP')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'SETUP' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Database size={16}/> Precios</button>
                <button onClick={() => setView('MODULES')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'MODULES' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Box size={16}/> Módulos</button>
                <button onClick={() => setView('RESULTS')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'RESULTS' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><DollarSign size={16}/> Resultados</button>
                <div className="w-px h-8 bg-gray-200 mx-2"></div>
                <button onClick={() => setView('HISTORY')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'HISTORY' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><History size={16}/> Historial</button>
                <button onClick={() => setView('PROJECTS')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'PROJECTS' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Package size={16}/> Proyectos</button>
            </div>
        </header>

        <div className="flex-1 p-8 max-w-6xl mx-auto w-full flex flex-col min-h-0">
            {view === 'SETUP' && (
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4"><h3 className="text-lg font-bold">Gestión de Precios</h3><div className="flex gap-4 items-center"><input type="text" placeholder="Nombre Lista" className="border p-2 rounded text-sm w-48" value={newListName} onChange={(e) => setNewListName(e.target.value)} /><button onClick={handleSavePriceList} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-emerald-700"><Save size={14} /> Guardar</button><div className="h-8 w-px bg-gray-200"></div><select className="border p-2 rounded text-sm w-48 bg-gray-50" onChange={(e) => handleLoadPriceList(e.target.value)} value=""><option value="" disabled>Cargar Historial...</option>{priceHistory.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}</select></div></div>
                    
                    <div className="grid grid-cols-2 gap-8">
                        {/* Placas */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Placas</h4>
                            <div className="space-y-2">
                                <div><label className="text-xs block">Placa melamina blanca base aglomerado 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18WhiteAglo} onChange={e => setSettings({...settings, priceBoard18WhiteAglo: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina blanca base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18WhiteMDF} onChange={e => setSettings({...settings, priceBoard18WhiteMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina texturada base aglomerado 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18ColorAglo} onChange={e => setSettings({...settings, priceBoard18ColorAglo: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina texturada base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18ColorMDF} onChange={e => setSettings({...settings, priceBoard18ColorMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa mdf crudo 1 cara blanca 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18MDFCrudo1Face} onChange={e => setSettings({...settings, priceBoard18MDFCrudo1Face: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa madera enchapada base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18VeneerMDF} onChange={e => setSettings({...settings, priceBoard18VeneerMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina blanca 15mm base aglo</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard15WhiteAglo} onChange={e => setSettings({...settings, priceBoard15WhiteAglo: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa fondo blanco 3mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBacking3White} onChange={e => setSettings({...settings, priceBacking3White: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa fondo texturado 5.5mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBacking55Color} onChange={e => setSettings({...settings, priceBacking55Color: Number(e.target.value)})} /></div>
                            </div>
                        </div>

                        {/* Tapacantos, Acabados, MO */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Tapacantos</h4>
                            <div className="space-y-2">
                                <div><label className="text-xs block">Abs 22 x 0.45 blanco</label><input type="number" className="border p-1 w-full rounded" value={settings.priceEdge22White045} onChange={e => setSettings({...settings, priceEdge22White045: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Abs 45 x 0.45 blanco</label><input type="number" className="border p-1 w-full rounded" value={settings.priceEdge45White045} onChange={e => setSettings({...settings, priceEdge45White045: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Abs 22 x 0.45 texturado</label><input type="number" className="border p-1 w-full rounded" value={settings.priceEdge22Color045} onChange={e => setSettings({...settings, priceEdge22Color045: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Abs 45 x 0.45 texturado</label><input type="number" className="border p-1 w-full rounded" value={settings.priceEdge45Color045} onChange={e => setSettings({...settings, priceEdge45Color045: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">PVC 2mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceEdge2mm} onChange={e => setSettings({...settings, priceEdge2mm: Number(e.target.value)})} /></div>
                            </div>

                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Acabados</h4>
                            <div className="space-y-2">
                                <div><label className="text-xs block">Aplicación laca semi mate por m2</label><input type="number" className="border p-1 w-full rounded" value={settings.priceFinishLacquerSemi} onChange={e => setSettings({...settings, priceFinishLacquerSemi: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Aplicación laca brillante por m2</label><input type="number" className="border p-1 w-full rounded" value={settings.priceFinishLacquerGloss} onChange={e => setSettings({...settings, priceFinishLacquerGloss: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Aplicación lustre semi mate por m2</label><input type="number" className="border p-1 w-full rounded" value={settings.priceFinishLustreSemi} onChange={e => setSettings({...settings, priceFinishLustreSemi: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Aplicación lustre brillante por m2</label><input type="number" className="border p-1 w-full rounded" value={settings.priceFinishLustreGloss} onChange={e => setSettings({...settings, priceFinishLustreGloss: Number(e.target.value)})} /></div>
                            </div>

                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2 mt-6">Mano de Obra</h4>
                            <div className="space-y-2">
                                <div><label className="text-xs block">Jornal diario x operario</label><input type="number" className="border p-1 w-full rounded font-bold text-indigo-700 bg-indigo-50" value={settings.costLaborDay} onChange={e => setSettings({...settings, costLaborDay: Number(e.target.value)})} /></div>
                            </div>
                        </div>

                        {/* Herrajes */}
                        <div className="col-span-2 space-y-4 pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Herrajes</h4>
                            <div className="grid grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <div><label className="text-xs block font-bold text-gray-400 mb-2">Bisagras</label></div>
                                    <div><label className="text-xs block">Standard</label><input type="number" className="border p-1 w-full rounded" value={settings.priceHingeStandard} onChange={e => setSettings({...settings, priceHingeStandard: Number(e.target.value)})} /></div>
                                    <div><label className="text-xs block">Cierre suave</label><input type="number" className="border p-1 w-full rounded" value={settings.priceHingeSoftClose} onChange={e => setSettings({...settings, priceHingeSoftClose: Number(e.target.value)})} /></div>
                                    <div><label className="text-xs block">Push</label><input type="number" className="border p-1 w-full rounded" value={settings.priceHingePush} onChange={e => setSettings({...settings, priceHingePush: Number(e.target.value)})} /></div>
                                </div>
                                <div className="space-y-2">
                                    <div><label className="text-xs block font-bold text-gray-400 mb-2">Guías Telescópicas</label></div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <div className="col-span-3 text-[10px] text-gray-400 uppercase">300mm</div>
                                        <input type="number" placeholder="Std" className="border p-1 w-full rounded text-xs" value={settings.priceSlide300Std} onChange={e => setSettings({...settings, priceSlide300Std: Number(e.target.value)})} />
                                        <input type="number" placeholder="Soft" className="border p-1 w-full rounded text-xs" value={settings.priceSlide300Soft} onChange={e => setSettings({...settings, priceSlide300Soft: Number(e.target.value)})} />
                                        <input type="number" placeholder="Push" className="border p-1 w-full rounded text-xs" value={settings.priceSlide300Push} onChange={e => setSettings({...settings, priceSlide300Push: Number(e.target.value)})} />
                                        
                                        <div className="col-span-3 text-[10px] text-gray-400 uppercase mt-1">400mm</div>
                                        <input type="number" placeholder="Std" className="border p-1 w-full rounded text-xs" value={settings.priceSlide400Std} onChange={e => setSettings({...settings, priceSlide400Std: Number(e.target.value)})} />
                                        <input type="number" placeholder="Soft" className="border p-1 w-full rounded text-xs" value={settings.priceSlide400Soft} onChange={e => setSettings({...settings, priceSlide400Soft: Number(e.target.value)})} />
                                        <input type="number" placeholder="Push" className="border p-1 w-full rounded text-xs" value={settings.priceSlide400Push} onChange={e => setSettings({...settings, priceSlide400Push: Number(e.target.value)})} />

                                        <div className="col-span-3 text-[10px] text-gray-400 uppercase mt-1">500mm</div>
                                        <input type="number" placeholder="Std" className="border p-1 w-full rounded text-xs" value={settings.priceSlide500Std} onChange={e => setSettings({...settings, priceSlide500Std: Number(e.target.value)})} />
                                        <input type="number" placeholder="Soft" className="border p-1 w-full rounded text-xs" value={settings.priceSlide500Soft} onChange={e => setSettings({...settings, priceSlide500Soft: Number(e.target.value)})} />
                                        <input type="number" placeholder="Push" className="border p-1 w-full rounded text-xs" value={settings.priceSlide500Push} onChange={e => setSettings({...settings, priceSlide500Push: Number(e.target.value)})} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div><label className="text-xs block font-bold text-gray-400 mb-2">Otros</label></div>
                                    <div><label className="text-xs block">Pistón a gas</label><input type="number" className="border p-1 w-full rounded" value={settings.priceGasPiston} onChange={e => setSettings({...settings, priceGasPiston: Number(e.target.value)})} /></div>
                                    <div><label className="text-xs block">Lata cemento contacto 2.8kg</label><input type="number" className="border p-1 w-full rounded" value={settings.priceGlueTin} onChange={e => setSettings({...settings, priceGlueTin: Number(e.target.value)})} /></div>
                                    <div><label className="text-xs block">Tornillería (Estimado)</label><input type="number" className="border p-1 w-full rounded" value={settings.priceScrews} onChange={e => setSettings({...settings, priceScrews: Number(e.target.value)})} /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'MODULES' && (
                <div className="flex flex-col gap-6 h-full min-h-0">
                    
                    {!isProjectActive ? (
                        <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-xl max-w-2xl mx-auto mt-12 flex flex-col items-center text-center animate-fade-in">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                                <FolderPlus size={32} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Iniciar Nueva Estimación</h3>
                            <p className="text-gray-500 mb-8">Selecciona un proyecto existente o crea uno nuevo para comenzar a agregar módulos.</p>
                            
                            <div className="w-full space-y-4 text-left">
                                <div>
                                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Proyecto / Obra</label>
                                    <select 
                                        className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-black transition-all"
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                    >
                                        <option value="NEW">+ Crear Nueva Obra</option>
                                        {projects
                                            .filter(p => p.status === 'PROPOSAL' || p.status === 'QUOTING')
                                            .map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                </div>
                                
                                {selectedProjectId === 'NEW' && (
                                    <div>
                                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">Nombre de la Obra</label>
                                        <input 
                                            placeholder="Ej: Cocina Residencia Smith"
                                            className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-black transition-all"
                                            value={customProjectName}
                                            onChange={(e) => setCustomProjectName(e.target.value)}
                                        />
                                    </div>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        if (selectedProjectId === 'NEW' && !customProjectName.trim()) {
                                            alert("Por favor ingresa un nombre para el proyecto.");
                                            return;
                                        }
                                        setIsProjectActive(true);
                                    }}
                                    className="w-full bg-roden-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-[0.98]"
                                >
                                    Comenzar a Generar Módulos <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top: Horizontal Add Module Panel */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm shrink-0">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-4">
                                        <h3 className="font-bold text-lg">{editingId ? 'Editar Módulo' : 'Agregar Módulo'}</h3>
                                        <div className="h-6 w-px bg-gray-200"></div>
                                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                                            <FolderPlus size={16} />
                                            {getActiveProjectName()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={() => {
                                                if (confirm("¿Deseas iniciar otro proyecto? Se mantendrán los módulos actuales pero cambiarás el nombre de la obra.")) {
                                                    setIsProjectActive(false);
                                                }
                                            }}
                                            className="text-xs font-bold text-gray-400 hover:text-black flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw size={12} /> Cambiar Proyecto
                                        </button>
                                        {editingId && <button onClick={handleCancelEdit} className="text-xs text-red-500 font-bold hover:underline">Cancelar Edición</button>}
                                    </div>
                                </div>
                                
                                <form onSubmit={handleAddModule} className="flex flex-col gap-4">
                            {/* Row 1: Geometry & Basic Config */}
                            <div className="flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Nombre</label>
                                    <input placeholder="Ej: Bajo 2 Puertas" className="w-full border p-2 rounded text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-1 focus:ring-black" required value={moduleForm.name} onChange={e => handleInputChange('name', e.target.value)}/>
                                </div>
                                
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Ancho</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center" required value={moduleForm.width} onChange={e => handleInputChange('width', Number(e.target.value))} />
                                </div>
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Alto</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center" required value={moduleForm.height} onChange={e => handleInputChange('height', Number(e.target.value))} />
                                </div>
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Prof.</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center" required value={moduleForm.depth} onChange={e => handleInputChange('depth', Number(e.target.value))} />
                                </div>
                                <div className="w-16">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Cant.</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center font-bold bg-indigo-50 text-indigo-700" value={moduleForm.quantity} onChange={e => handleInputChange('quantity', Number(e.target.value))}/>
                                </div>

                                <div className="w-px h-10 bg-gray-200 mx-2 self-center"></div>

                                <div className="flex gap-2">
                                    <div className="w-16">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Puertas</label>
                                        <input type="number" min="0" className="w-full border p-2 rounded text-sm text-center" value={moduleForm.cntDoors} onChange={e => handleInputChange('cntDoors', Number(e.target.value))}/>
                                    </div>
                                    <div className="w-16">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Abatib.</label>
                                        <input type="number" min="0" className="w-full border p-2 rounded text-sm text-center" value={moduleForm.cntFlaps} onChange={e => handleInputChange('cntFlaps', Number(e.target.value))}/>
                                    </div>
                                    <div className="w-16">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Cajones</label>
                                        <input type="number" min="0" className="w-full border p-2 rounded text-sm text-center" value={moduleForm.cntDrawers} onChange={e => handleInputChange('cntDrawers', Number(e.target.value))}/>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Tech Specs & Extras & Buttons */}
                            <div className="flex flex-wrap gap-4 items-center border-t border-gray-100 pt-3">
                                {/* Hardware Toggles */}
                                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={moduleForm.calculateHinges !== false} onChange={e => handleInputChange('calculateHinges', e.target.checked)} title="Calcular Bisagras"/>
                                        <select className={`border p-1.5 rounded text-xs bg-white w-32 ${moduleForm.calculateHinges === false ? 'opacity-50' : ''}`} disabled={moduleForm.calculateHinges === false} value={moduleForm.hingeType} onChange={e => handleInputChange('hingeType', e.target.value)}>{Object.entries(HINGE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={moduleForm.calculateSlides !== false} onChange={e => handleInputChange('calculateSlides', e.target.checked)} title="Calcular Guías"/>
                                        <select className={`border p-1.5 rounded text-xs bg-white w-32 ${moduleForm.calculateSlides === false ? 'opacity-50' : ''}`} disabled={moduleForm.calculateSlides === false} value={moduleForm.slideType} onChange={e => handleInputChange('slideType', e.target.value)}>{Object.entries(SLIDE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
                                    </div>
                                    <div className="flex items-center gap-2 border-l border-gray-300 pl-4">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Canto:</span>
                                        <select className="border p-1.5 rounded text-xs bg-white" value={moduleForm.edgeCategory} onChange={e => handleInputChange('edgeCategory', e.target.value)}><option value="PVC_045">0.45mm</option><option value="PVC_2MM">2mm</option></select>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 border-l border-gray-300 pl-4"><input type="checkbox" className="w-4 h-4" checked={moduleForm.hasGasPistons} onChange={e => handleInputChange('hasGasPistons', e.target.checked)}/><span>Pistones Gas</span></label>
                                </div>

                                {/* Material Configuration Section */}
                                <div className="flex flex-wrap items-center gap-4 bg-amber-50 p-3 rounded-xl border border-amber-200">
                                    <div className="flex items-center gap-3 border-r border-amber-200 pr-4">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-amber-800 uppercase font-bold mb-1">Estructura</label>
                                            <div className="flex gap-1">
                                                <select className="border p-1.5 rounded text-xs bg-white w-24" value={moduleForm.structureCore} onChange={e => handleInputChange('structureCore', e.target.value)}>
                                                    <option value="AGLO">Base Aglo</option>
                                                    <option value="MDF">Base MDF</option>
                                                </select>
                                                <select 
                                                    className="border p-1.5 rounded text-xs bg-white w-32"
                                                    value={moduleForm.materialColorName}
                                                    onChange={e => handleInputChange('materialColorName', e.target.value)}
                                                >
                                                    <option value="">Material a definir</option>
                                                    {BOARD_OPTIONS.map(opt => <option key={opt.value} value={opt.label}>{opt.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 border-r border-amber-200 pr-4">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-amber-800 uppercase font-bold mb-1">Frentes</label>
                                            <div className="flex gap-1">
                                                <select className="border p-1.5 rounded text-xs bg-white w-24" value={moduleForm.frontsCore} onChange={e => handleInputChange('frontsCore', e.target.value)}>
                                                    <option value="AGLO">Base Aglo</option>
                                                    <option value="MDF">Base MDF</option>
                                                </select>
                                                <select 
                                                    className="border p-1.5 rounded text-xs bg-white w-32"
                                                    value={moduleForm.materialFrontName}
                                                    onChange={e => handleInputChange('materialFrontName', e.target.value)}
                                                >
                                                    <option value="">Material a definir</option>
                                                    {BOARD_OPTIONS.map(opt => <option key={opt.value} value={opt.label}>{opt.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-amber-800 uppercase font-bold mb-1">Fondo</label>
                                        <select 
                                            className="border p-1.5 rounded text-xs bg-white w-32" 
                                            value={moduleForm.backingType} 
                                            onChange={e => handleInputChange('backingType', e.target.value)}
                                        >
                                            {BACKING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-amber-800 uppercase font-bold mb-1">Acabado</label>
                                        <select className="border p-1.5 rounded text-xs bg-white w-36" value={moduleForm.moduleType} onChange={e => handleInputChange('moduleType', e.target.value)}>
                                            <option value="MELAMINE_FULL">Melamina</option>
                                            <option value="MELAMINE_STRUCT_LACQUER">Laqueado (Frentes)</option>
                                            <option value="MELAMINE_STRUCT_VENEER">Enchapado (Frentes)</option>
                                            <option value="LACQUER_FULL">Todo Laqueado</option>
                                            <option value="VENEER_FULL">Todo Enchapado</option>
                                        </select>
                                    </div>

                                    {validationWarning && (
                                        <div className="flex items-center gap-2 text-red-600 animate-pulse ml-2 bg-white px-2 py-1 rounded border border-red-200">
                                            <AlertTriangle size={14} />
                                            <span className="text-[10px] font-bold uppercase leading-tight max-w-[150px]">{validationWarning}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Extras Input (Inline) */}
                                <div className="flex-1 flex gap-2 items-center min-w-[250px]">
                                    <div className="flex-1 flex gap-1">
                                        <input type="text" placeholder="Extra (ej: Cubiertero)" className="flex-1 p-1.5 text-xs border rounded" value={newExtra.description} onChange={e => setNewExtra({...newExtra, description: e.target.value})} />
                                        <input type="number" placeholder="#" className="w-10 p-1.5 text-xs border rounded text-center" value={newExtra.quantity} onChange={e => setNewExtra({...newExtra, quantity: Number(e.target.value)})} />
                                        <input type="number" placeholder="$" className="w-24 p-1.5 text-xs border rounded text-right" value={newExtra.unitPrice} onChange={e => setNewExtra({...newExtra, unitPrice: Number(e.target.value)})} />
                                        <button type="button" onClick={handleAddExtra} className="bg-gray-200 text-gray-600 px-2 rounded hover:bg-gray-300"><Plus size={14}/></button>
                                    </div>
                                    {moduleForm.extras && moduleForm.extras.length > 0 && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">+{moduleForm.extras.length} Extras</span>}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
                                        {editingId ? <Save size={16}/> : <Plus size={16}/>} {editingId ? 'Actualizar' : 'Agregar'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Bottom: Lists Split View */}
                    <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                        
                        {/* 1. Pending Modules List */}
                        <div className="flex-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                                <h4 className="font-bold text-gray-700 flex items-center gap-2"><Box size={18}/> Módulos Pendientes ({pendingModules.length})</h4>
                                {pendingModules.length > 0 && (
                                    <button 
                                        onClick={handleOpenItemModal}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md animate-pulse">
                                        <Package size={16}/> Crear Item
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {pendingModules.length === 0 && <p className="text-gray-400 text-center py-8 text-sm">Agrega módulos para componer un Item (Mueble).</p>}
                                {pendingModules.map((mod, i) => (
                                    <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center hover:border-indigo-300 transition-colors group">
                                        <div>
                                            <span className="font-bold text-sm block">{mod.name}</span>
                                            <span className="text-xs text-gray-500 font-mono">({mod.quantity}u) {mod.width}x{mod.height}x{mod.depth}</span>
                                            {mod.extras && mod.extras.length > 0 && <span className="text-[10px] text-indigo-600 ml-2">+{mod.extras.length} extras</span>}
                                        </div>
                                        <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditModule(mod)} className="text-gray-400 hover:text-indigo-600 p-1 bg-white rounded border border-gray-200"><Pencil size={14}/></button>
                                            <button onClick={() => setPendingModules(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 p-1 bg-white rounded border border-gray-200"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Created Items List (Summary) */}
                        <div className="flex-1 bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col min-h-0">
                            <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 border-b border-emerald-200 pb-2"><Check size={18}/> Items Generados ({items.length})</h4>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                {items.length === 0 && <p className="text-emerald-600/50 text-center py-8 text-sm italic">Aquí aparecerán los muebles listos para cotizar. Ve a la pestaña Resultados para seleccionar y exportar.</p>}
                                {items.map((item) => (
                                    <div key={item.id} className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h5 className="font-bold text-lg text-emerald-900">{item.name}</h5>
                                                <p className="text-xs text-gray-500">{item.modules.length} Módulos • {item.labor.workers} Op. / {item.labor.days} Días</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Precios Ref:</div>
                                                <div className="text-sm font-bold text-gray-800">
                                                    Aglo: {formatCurrency(item.scenarioPrices.colorAglo)}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    Laqueado: {formatCurrency(item.scenarioPrices.lacquer)}
                                                </div>
                                                <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 text-xs mt-2 underline">Eliminar</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )}

    {/* RESULTS TAB */}
            {view === 'RESULTS' && (
                <div className="p-8 bg-white rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-2xl font-bold mb-4 text-center">Selección de Items para Presupuesto</h3>
                    <p className="text-center text-gray-500 text-sm mb-8">Selecciona los muebles que deseas incluir en la cotización final para el cliente.</p>
                    
                    <div className="max-w-3xl mx-auto space-y-4 mb-8">
                        {items.length === 0 && <p className="text-center py-8 text-gray-400">No hay items generados. Vuelve a "Módulos" para crear uno.</p>}
                        {items.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => toggleItemSelection(item.id)}
                                className={`flex justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                                    selectedItemIds.has(item.id) 
                                    ? 'bg-indigo-50 border-indigo-500 shadow-md' 
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedItemIds.has(item.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
                                    }`}>
                                        {selectedItemIds.has(item.id) && <Check size={14} className="text-white"/>}
                                    </div>
                                    <div>
                                        <span className="font-bold text-lg block">{item.name}</span>
                                        <span className="text-xs text-gray-500">{item.modules.length} Módulos incluidos</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-gray-400">{item.modules.length} módulos</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex gap-4 justify-center pt-4 border-t border-gray-100">
                        <button 
                            onClick={handleGenerateCostSheet}
                            disabled={selectedItemIds.size === 0}
                            className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                        >
                            <PieChart size={18}/> Generar Planilla de Costos
                        </button>
                        <button 
                            onClick={handleOpenQuoteModal} 
                            disabled={selectedItemIds.size === 0}
                            className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2"
                        >
                            <FileText size={18}/> Generar Presupuesto Cliente
                        </button>
                    </div>
                </div>
            )}

            {/* NEW: HISTORY TAB */}
            {view === 'HISTORY' && (
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold">{showArchived ? 'Archivo de Presupuestos' : 'Historial de Presupuestos'}</h3>
                            <button 
                                onClick={() => setShowArchived(!showArchived)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    showArchived 
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                }`}
                            >
                                {showArchived ? <ArrowLeft size={14}/> : <Archive size={14}/>}
                                {showArchived ? 'Volver al Historial' : 'Ver Archivo'}
                            </button>
                        </div>
                        <div className="flex gap-4 items-center">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                                <input
                                    type="text"
                                    placeholder="Buscar por proyecto..."
                                    className="border pl-9 pr-4 py-2 rounded-xl text-sm w-64 focus:ring-2 focus:ring-black outline-none transition-all"
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                />
                            </div>
                            <select 
                                className="border p-2 rounded-xl text-sm w-48 bg-gray-50 focus:ring-2 focus:ring-black outline-none"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as BudgetStatus | 'ALL')}
                            >
                                <option value="ALL">Todos los Estados</option>
                                {Object.values(BudgetStatus).map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {historyEntries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <History size={48} className="mb-4 opacity-20"/>
                                <p>No se encontraron registros que coincidan con los filtros.</p>
                            </div>
                        ) : (
                            historyEntries.map(([key, project]: [string, any]) => {
                                const isExpanded = expandedCards.has(key);
                                const toggleExpand = () => {
                                    const next = new Set(expandedCards);
                                    if (isExpanded) next.delete(key);
                                    else next.add(key);
                                    setExpandedCards(next);
                                };

                                // Health Semaphore Logic
                                const latestDoc = project.docs[0];
                                const daysInStatus = Math.floor((new Date().getTime() - new Date(latestDoc.date).getTime()) / (1000 * 60 * 60 * 24));
                                const healthColor = daysInStatus < 3 ? 'bg-emerald-500' : daysInStatus < 7 ? 'bg-amber-500' : 'bg-red-500';

                                return (
                                <div key={key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                                    {/* COLLAPSED VIEW (HEADER) */}
                                    <div 
                                        className="px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={toggleExpand}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${healthColor} shadow-sm animate-pulse`}></div>
                                            <div>
                                                <h4 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                                    {project.name}
                                                </h4>
                                                <p className="text-xs text-gray-400 font-medium">
                                                    {project.docs.length} Documentos • {latestDoc.quoteData?.reference || 'Sin Referencia'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="hidden md:flex flex-col items-end">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Estado Comercial</span>
                                                <select
                                                    className={`border-none p-0 text-sm font-bold bg-transparent focus:ring-0 cursor-pointer ${STATUS_COLORS[latestDoc.commercialStatus || 'BORRADOR']}`}
                                                    value={latestDoc.commercialStatus || CommercialStatus.DRAFT}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => handleCommercialStatusChange(latestDoc.id, e.target.value as CommercialStatus)}
                                                >
                                                    {Object.values(CommercialStatus).map(status => (
                                                        <option key={status} value={status} className="text-gray-800">{status}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100' : 'bg-gray-50'}`}>
                                                <ChevronDown size={20} className="text-gray-400"/>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EXPANDED VIEW */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50/30 animate-slide-down">
                                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                {/* QUICK ACTIONS / ICONS */}
                                                <div className="lg:col-span-2 space-y-4">
                                                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Documentación de Obra</h5>
                                                    <div className="grid grid-cols-4 gap-4">
                                                        <button 
                                                            onClick={() => executeViewQuote(latestDoc)}
                                                            className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all group"
                                                        >
                                                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                                                                <FileText size={20}/>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-700">Presupuesto</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => { setPrintMode('COSTS'); setActiveSettings(latestDoc.settingsSnapshot); setTechnicalItems(latestDoc.items || []); }}
                                                            className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl hover:border-amber-500 hover:shadow-lg transition-all group"
                                                        >
                                                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                                                                <PieChart size={20}/>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-700">Costos</span>
                                                        </button>
                                                        <button 
                                                            disabled={!latestDoc.hasTechnicalDefinition}
                                                            onClick={() => executeLoad(latestDoc)}
                                                            className={`flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl transition-all group ${
                                                                latestDoc.hasTechnicalDefinition 
                                                                ? 'hover:border-blue-500 hover:shadow-lg' 
                                                                : 'opacity-40 cursor-not-allowed grayscale'
                                                            }`}
                                                        >
                                                            <div className={`p-3 rounded-xl mb-2 group-hover:scale-110 transition-transform ${latestDoc.hasTechnicalDefinition ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                <ShoppingCart size={20}/>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-700">Insumos</span>
                                                        </button>
                                                        <button 
                                                            disabled={!latestDoc.hasTechnicalDefinition}
                                                            onClick={() => { setPrintMode('CUTTING'); setActiveSettings(latestDoc.settingsSnapshot); }}
                                                            className={`flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl transition-all group ${
                                                                latestDoc.hasTechnicalDefinition 
                                                                ? 'hover:border-emerald-500 hover:shadow-lg' 
                                                                : 'opacity-40 cursor-not-allowed grayscale'
                                                            }`}
                                                        >
                                                            <div className={`p-3 rounded-xl mb-2 group-hover:scale-110 transition-transform ${latestDoc.hasTechnicalDefinition ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                <Scissors size={20}/>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-gray-700">Planilla de Corte</span>
                                                        </button>
                                                    </div>

                                                    {showArchived && (
                                                        <div className="mt-6 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                                            <h6 className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Archive size={12}/> Legajo de Obra Realizada
                                                            </h6>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] mb-4">
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Fecha de Entrega</p>
                                                                    <p className="font-bold text-gray-900">
                                                                        {latestDoc.auditLog?.find(a => a.to === ProductionStatus.READY)?.timestamp 
                                                                            ? new Date(latestDoc.auditLog.find(a => a.to === ProductionStatus.READY)!.timestamp).toLocaleDateString() 
                                                                            : 'N/A'}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Versión Final</p>
                                                                    <p className="font-bold text-gray-900">v{latestDoc.version || 1}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Items / Módulos</p>
                                                                    <p className="font-bold text-gray-900">{latestDoc.items?.length || 0} Items · {latestDoc.modules.length} Módulos</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Estado Final</p>
                                                                    <p className="font-bold text-emerald-600 uppercase">Entregado</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Fecha de Cotización</p>
                                                                    <p className="font-bold text-gray-900">{latestDoc.date ? new Date(latestDoc.date).toLocaleDateString() : 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Referencia / Proyecto</p>
                                                                    <p className="font-bold text-gray-900 truncate">{latestDoc.customProjectName || getProjectTitleById(latestDoc.projectId || '') || '—'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Técnica Definida</p>
                                                                    <p className={`font-bold ${latestDoc.hasTechnicalDefinition ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                        {latestDoc.hasTechnicalDefinition ? 'Sí' : 'No'}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-gray-500 mb-1">Inicio en Taller</p>
                                                                    <p className="font-bold text-gray-900">
                                                                        {latestDoc.auditLog?.find(a => a.to === CommercialStatus.IN_PRODUCTION)?.timestamp
                                                                            ? new Date(latestDoc.auditLog.find(a => a.to === CommercialStatus.IN_PRODUCTION)!.timestamp).toLocaleDateString()
                                                                            : 'N/A'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {/* Resumen de Items */}
                                                            {latestDoc.items && latestDoc.items.length > 0 && (
                                                                <div className="border-t border-indigo-100 pt-3">
                                                                    <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-2">Detalle de Items</p>
                                                                    <div className="space-y-1">
                                                                        {latestDoc.items.map((item: any, idx: number) => (
                                                                            <div key={idx} className="flex justify-between items-center text-[10px]">
                                                                                <span className="font-medium text-gray-700">• {item.name}</span>
                                                                                <span className="text-gray-500">{item.modules?.length || 0} módulos</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between pt-4">
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => { setVinculandoEstimateId(latestDoc.id); setVinculandoProjectId(latestDoc.projectId || ''); }}
                                                                className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all flex items-center gap-2 shadow-md"
                                                            >
                                                                <Link size={14}/> Vincular a Proyecto
                                                            </button>
                                                            <button 
                                                                onClick={() => handleGenerateNewVersion(latestDoc)}
                                                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                                                            >
                                                                <Copy size={14}/> Nueva Versión
                                                            </button>
                                                            <button 
                                                                onClick={() => handleUpdatePrices(latestDoc)}
                                                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
                                                            >
                                                                <ArrowUpCircle size={14}/> Actualizar Precios
                                                            </button>
                                                            <button 
                                                                disabled={latestDoc.commercialStatus !== CommercialStatus.APPROVED}
                                                                onClick={() => handleGenerateProductionOrder(latestDoc.id)}
                                                                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                                                                    latestDoc.commercialStatus === CommercialStatus.APPROVED 
                                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <Package size={14}/> Generar Orden Producción
                                                            </button>
                                                            <button 
                                                                disabled={latestDoc.commercialStatus !== CommercialStatus.APPROVED}
                                                                onClick={() => handleOpenTechnicalDefinition(latestDoc)}
                                                                className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                                                                    latestDoc.commercialStatus === CommercialStatus.APPROVED 
                                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <Hammer size={14}/> Definir Técnica
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleArchive(latestDoc.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Archivar"><Archive size={18}/></button>
                                                            <button onClick={(e) => handleDelete(e, latestDoc.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Borrar"><Trash2 size={18}/></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* STATUS & AUDIT */}
                                                <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <Activity size={12}/> Estado de Producción
                                                        </h5>
                                                        <select
                                                            className="w-full border border-gray-200 p-3 rounded-xl text-sm font-bold bg-gray-50 focus:ring-2 focus:ring-black outline-none"
                                                            value={latestDoc.productionStatus || ProductionStatus.PENDING}
                                                            onChange={(e) => handleProductionStatusChange(latestDoc.id, e.target.value as ProductionStatus)}
                                                        >
                                                            {Object.values(ProductionStatus).filter(s => s !== ProductionStatus.READY).map(status => (
                                                                <option key={status} value={status}>{status}</option>
                                                            ))}
                                                        </select>
                                                        <p className="text-[9px] text-gray-400 mt-1.5 italic">La finalización solo se confirma desde la solapa Taller al entregar la obra.</p>
                                                    </div>

                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                            <Clock size={12}/> Auditoría de Obra
                                                        </h5>
                                                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                                                            {latestDoc.auditLog?.slice().reverse().map((log: any, i: number) => (
                                                                <div key={i} className="text-[10px] border-l-2 border-indigo-500 pl-3 py-1">
                                                                    <p className="text-gray-800 font-bold">{log.from} → {log.to}</p>
                                                                    <p className="text-gray-400">{new Date(log.timestamp).toLocaleString()} • {log.user}</p>
                                                                </div>
                                                            )) || <p className="text-xs text-gray-400 italic">No hay registros aún.</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {view === 'PROJECTS' && (
                <div className="flex flex-col h-full animate-fade-in">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Gestión de Taller</h3>
                            <p className="text-sm text-gray-500">Obras aprobadas y en producción activa.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-xs font-bold text-gray-600">
                                    {savedEstimates.filter(e => e.commercialStatus === CommercialStatus.IN_PRODUCTION).length} En Producción
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2 pb-8">
                        {savedEstimates
                            .filter(e => e.commercialStatus === CommercialStatus.APPROVED || e.commercialStatus === CommercialStatus.IN_PRODUCTION)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(project => {
                                const daysInProduction = Math.floor((new Date().getTime() - new Date(project.date).getTime()) / (1000 * 60 * 60 * 24));
                                
                                return (
                                    <div key={project.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-lg text-gray-900">{project.customProjectName || getProjectTitleById(project.projectId)}</h4>
                                                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{project.quoteData?.reference || 'Sin Ref'}</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                                project.productionStatus === ProductionStatus.READY ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {project.productionStatus || ProductionStatus.PENDING}
                                            </div>
                                        </div>

                                        <div className="space-y-4 flex-1">
                                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Progreso de Taller</p>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-indigo-600 transition-all duration-500" 
                                                            style={{ width: 
                                                                project.productionStatus === ProductionStatus.READY ? '100%' : 
                                                                project.productionStatus === ProductionStatus.ASSEMBLY ? '66%' : 
                                                                project.productionStatus === ProductionStatus.CUTTING ? '33%' : '5%' 
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-600">
                                                        {project.productionStatus === ProductionStatus.READY ? '100%' : 
                                                         project.productionStatus === ProductionStatus.ASSEMBLY ? '66%' : 
                                                         project.productionStatus === ProductionStatus.CUTTING ? '33%' : '5%'}
                                                    </span>
                                                </div>
                                                <select 
                                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-black"
                                                    value={project.productionStatus || ProductionStatus.PENDING}
                                                    onChange={(e) => handleProductionStatusChange(project.id, e.target.value as ProductionStatus)}
                                                >
                                                    {Object.values(ProductionStatus).filter(s => s !== ProductionStatus.READY).map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => { setPrintMode('CUTTING'); setActiveSettings(project.settingsSnapshot); }}
                                                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold text-gray-700"
                                                >
                                                    <Scissors size={14}/> Corte
                                                </button>
                                                <button 
                                                    onClick={() => executeLoad(project)}
                                                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-xs font-bold text-gray-700"
                                                >
                                                    <Package size={14}/> Insumos
                                                </button>
                                            </div>

                                            {/* CONFIRMAR ENTREGA - única forma de finalizar */}
                                            <button
                                                onClick={() => {
                                                    if (confirm(`¿Confirmar entrega de la obra "${project.customProjectName || getProjectTitleById(project.projectId || '')}"? Esta acción la moverá al archivo de obras realizadas.`)) {
                                                        handleProductionStatusChange(project.id, ProductionStatus.READY);
                                                    }
                                                }}
                                                className="w-full flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-xs font-bold shadow-sm"
                                            >
                                                <Check size={14}/> Confirmar Entrega de Obra
                                            </button>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-400"/>
                                                <span className="text-[10px] font-medium text-gray-500">{daysInProduction} días en taller</span>
                                            </div>
                                            {project.isPublished && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                                    <Check size={12}/> Actualizado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        
                        {savedEstimates.filter(e => e.commercialStatus === CommercialStatus.APPROVED || e.commercialStatus === CommercialStatus.IN_PRODUCTION).length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                                <Box size={64} className="mb-4 opacity-10"/>
                                <p className="text-lg font-medium">No hay proyectos activos en taller.</p>
                                <p className="text-sm">Las obras aparecerán aquí cuando sean aprobadas comercialmente.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TECHNICAL DEFINITION MODAL (FROM HISTORY) */}
            {isTechnicalModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl p-0 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2"><Settings size={20}/> Definición Técnica para Producción</h3>
                                <p className="text-sm text-gray-500">
                                    Proyecto: <span className="font-bold text-black">{loadedEstimateInfo?.projectName}</span> • 
                                    Fecha Cotización: {loadedEstimateInfo?.date ? new Date(loadedEstimateInfo.date).toLocaleDateString() : '-'}
                                </p>
                            </div>
                            <button onClick={handleConfirmTechnicalDefinition}><X className="text-gray-400 hover:text-black"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                            {technicalItems.map((item, itemIdx) => (
                                <div key={item.id} className="mb-8 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={technicalSelectedIds.has(item.id)}
                                                onChange={() => handleToggleTechnicalItem(item.id)}
                                                className="w-5 h-5 cursor-pointer accent-black"
                                                title="Incluir Item en Reporte"
                                            />
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2"><Box size={16}/> {item.name}</h4>
                                        </div>
                                        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-300 font-medium">{item.modules.length} Módulos</span>
                                    </div>
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-gray-200 text-gray-500 bg-gray-50/50">
                                                <th className="p-3 w-40">Módulo</th>
                                                <th className="p-3">Estructura (Caja)</th>
                                                <th className="p-3">Frentes (Puertas/Cajones)</th>
                                                <th className="p-3">Herrajes (Confirmación)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.modules.map((mod) => (
                                                <tr key={mod.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                                                    <td className="p-3 font-medium align-top">
                                                        <div className="text-sm">{mod.name}</div>
                                                        <div className="text-gray-400 text-[10px]">{mod.width}x{mod.height}x{mod.depth}</div>
                                                    </td>
                                                    
                                                    {/* STRUCTURE DEFINITION */}
                                                    <td className="p-3 align-top">
                                                        <div className="flex gap-2 mb-1">
                                                            <select 
                                                                className="border p-1 rounded bg-white w-20 font-bold"
                                                                value={mod.structureCore || 'AGLO'}
                                                                onChange={(e) => updateTechnicalModule(item.id, mod.id, 'structureCore', e.target.value)}
                                                            >
                                                                <option value="AGLO">Aglo</option>
                                                                <option value="MDF">MDF</option>
                                                            </select>
                                                            <input 
                                                                type="text" 
                                                                className="border p-1 rounded flex-1 min-w-[120px]" 
                                                                value={mod.materialColorName}
                                                                onChange={(e) => updateTechnicalModule(item.id, mod.id, 'materialColorName', e.target.value)}
                                                                placeholder="Material Estructura"
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* FRONTS DEFINITION */}
                                                    <td className="p-3 align-top">
                                                        {(mod.cntDoors > 0 || mod.cntDrawers > 0) ? (
                                                            <div className="flex gap-2 mb-1">
                                                                <select 
                                                                    className="border p-1 rounded bg-white w-20 font-bold"
                                                                    value={mod.frontsCore || 'AGLO'}
                                                                    onChange={(e) => updateTechnicalModule(item.id, mod.id, 'frontsCore', e.target.value)}
                                                                >
                                                                    <option value="AGLO">Aglo</option>
                                                                    <option value="MDF">MDF</option>
                                                                </select>
                                                                <input 
                                                                    type="text" 
                                                                    className="border p-1 rounded flex-1 min-w-[120px]" 
                                                                    value={mod.materialFrontName || mod.materialColorName}
                                                                    onChange={(e) => updateTechnicalModule(item.id, mod.id, 'materialFrontName', e.target.value)}
                                                                    placeholder="Material Frentes"
                                                                />
                                                            </div>
                                                        ) : <span className="text-gray-300">-</span>}
                                                    </td>

                                                    {/* HARDWARE */}
                                                    <td className="p-3 space-y-1 align-top">
                                                        {(mod.cntDoors > 0 || mod.cntFlaps > 0) && (
                                                            <select className="w-full border p-1 rounded text-[10px]" value={mod.hingeType} onChange={(e) => updateTechnicalModule(item.id, mod.id, 'hingeType', e.target.value)}>
                                                                {Object.entries(HINGE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                                            </select>
                                                        )}
                                                        {mod.cntDrawers > 0 && (
                                                            <select className="w-full border p-1 rounded text-[10px]" value={mod.slideType} onChange={(e) => updateTechnicalModule(item.id, mod.id, 'slideType', e.target.value)}>
                                                                {Object.entries(SLIDE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                                            </select>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}

                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <label className="block font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <FileCheck size={18}/> Observaciones Generales para Reporte Técnico
                                </label>
                                <textarea 
                                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black outline-none min-h-[120px] text-sm"
                                    placeholder="Ingrese aquí detalles de entrega, instrucciones de montaje, especificaciones de cantos especiales, etc..."
                                    value={technicalObservations}
                                    onChange={(e) => setTechnicalObservations(e.target.value)}
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                            <button onClick={() => setIsTechnicalModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-bold hover:bg-white transition-colors">Cancelar</button>
                            <button onClick={handleConfirmAssociationAndGenerate} className="bg-roden-black text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 flex items-center gap-2 shadow-lg">
                                <Printer size={16}/> Confirmar y Generar Documentos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAssociateModalOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Link size={20}/> Vincular a Proyecto</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Para mantener el historial ordenado, vincula esta definición técnica a un proyecto existente. 
                            Esto actualizará automáticamente la información en la sección de Taller.
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Seleccionar Proyecto</label>
                                <select 
                                    className="w-full border p-2 rounded-lg bg-white"
                                    value={targetProjectId}
                                    onChange={(e) => setTargetProjectId(e.target.value)}
                                >
                                    <option value="">-- Sin vincular (Solo Historial) --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title} ({p.status})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsAssociateModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-bold hover:text-black">Volver</button>
                            <button onClick={handleConfirmAssociationAndGenerate} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg">
                                Finalizar y Ver Reporte
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isItemModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <h3 className="text-xl font-bold mb-4">Crear Item (Mueble Completo)</h3>
                        <p className="text-sm text-gray-500 mb-4">Estás agrupando {pendingModules.length} módulos. Define los costos de mano de obra y rentabilidad para este conjunto.</p>
                        
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold block mb-1">Nombre del Item</label><input autoFocus type="text" className="border p-2 rounded w-full" placeholder="Ej: Bajo Mesada Cocina" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold block mb-1">Operarios</label><input type="number" className="border p-2 rounded w-full" value={itemForm.workers} onChange={e => setItemForm({...itemForm, workers: Number(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold block mb-1">Días Fabricación</label><input type="number" className="border p-2 rounded w-full" value={itemForm.days} onChange={e => setItemForm({...itemForm, days: Number(e.target.value)})}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold block mb-1">% Beneficio Taller</label><input type="number" className="border p-2 rounded w-full" value={itemForm.marginWorkshop} onChange={e => setItemForm({...itemForm, marginWorkshop: Number(e.target.value)})}/></div>
                                <div><label className="text-xs font-bold block mb-1">% Beneficio Roden</label><input type="number" className="border p-2 rounded w-full" value={itemForm.marginRoden} onChange={e => setItemForm({...itemForm, marginRoden: Number(e.target.value)})}/></div>
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button onClick={() => setIsItemModalOpen(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold text-gray-600">Cancelar</button>
                                <button onClick={handleCreateItem} disabled={!itemForm.name} className="flex-1 bg-black text-white py-2 rounded-lg font-bold disabled:opacity-50">Generar Item</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCostSheetModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2"><PieChart size={20}/> Generar Planilla de Costos</h3>
                            <button onClick={() => setIsCostSheetModalOpen(false)}><X className="text-gray-400 hover:text-black"/></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            Genera un reporte detallado para uso interno del taller. 
                        </p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Vincular a Proyecto</label>
                                <select 
                                    className="w-full border p-2 rounded-lg bg-white"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    <option value="NEW">-- Nuevo Proyecto / Nombre Personalizado --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedProjectId === 'NEW' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Proyecto</label>
                                    <input 
                                        type="text" 
                                        className="w-full border p-2 rounded-lg"
                                        placeholder="Ingrese nombre..."
                                        value={customProjectName}
                                        onChange={e => setCustomProjectName(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Lista de Precios</label>
                                <select 
                                    className="w-full border p-2 rounded-lg bg-white"
                                    value={activeSettings.id || 'current'}
                                    onChange={(e) => {
                                        if (e.target.value === 'current') {
                                            setActiveSettings({ ...settings, id: 'current', name: 'Lista Actual' });
                                        } else {
                                            const list = priceHistory.find(h => h.id === e.target.value);
                                            if (list) setActiveSettings({ ...list.settings, id: list.id, name: list.name });
                                        }
                                    }}
                                >
                                    <option value="current">Lista Actual (En edición)</option>
                                    {priceHistory.map(h => (
                                        <option key={h.id} value={h.id}>{h.name} ({new Date(h.date).toLocaleDateString()})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Margen Beneficio Taller (%)</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-3 rounded-lg text-lg font-bold"
                                    value={costSheetMargin} 
                                    onChange={e => setCostSheetMargin(Number(e.target.value))}
                                />
                                <p className="text-xs text-gray-400 mt-1">Este porcentaje se aplicará sobre el costo directo total.</p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsCostSheetModalOpen(false)} className="px-4 py-2 text-gray-500 text-sm font-bold hover:text-black">Cancelar</button>
                            <button 
                                onClick={() => {
                                    setPrintMode('COSTS');
                                    setIsCostSheetModalOpen(false);
                                }} 
                                className="bg-amber-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 shadow-lg flex items-center gap-2"
                            >
                                <FileText size={16}/> Generar Planilla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PRICE LIST SELECTION MODAL */}
            {isPriceListModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg">Seleccionar Lista de Precios</h3>
                            <button onClick={() => setIsPriceListModalOpen(false)} className="text-gray-400 hover:text-black"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500">Elige la lista de precios que se aplicará a este reporte para asegurar la estabilidad de los costos.</p>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                <button 
                                    onClick={() => handleSelectPriceList(settings)}
                                    className="w-full text-left p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50 hover:border-indigo-300 transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="font-bold text-indigo-900 block">Lista Actual (En Pantalla)</span>
                                            <span className="text-xs text-indigo-600">Precios configurados actualmente</span>
                                        </div>
                                        <ChevronRight size={18} className="text-indigo-400 group-hover:translate-x-1 transition-transform"/>
                                    </div>
                                </button>

                                {priceHistory.map(list => (
                                    <button 
                                        key={list.id}
                                        onClick={() => handleSelectPriceList(list.settings)}
                                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-gray-50 transition-all group"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-gray-900 block">{list.name}</span>
                                                <span className="text-xs text-gray-400">{new Date(list.date).toLocaleDateString()}</span>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform"/>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showQuoteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Datos del Presupuesto</h3><button onClick={() => setShowQuoteModal(false)}><X className="text-gray-400 hover:text-black"/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Título del Presupuesto</label><input autoFocus className="w-full border p-3 rounded-lg outline-none focus:ring-1 focus:ring-black" placeholder="Ej: Amoblamiento Casa Lote 20" value={quoteItemTitle} onChange={(e) => setQuoteItemTitle(e.target.value)}/></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Referencia / Cliente / Obra</label><input className="w-full border p-3 rounded-lg outline-none focus:ring-1 focus:ring-black" placeholder="Ej: Familia Perez - Obra Canning" value={quoteReference} onChange={(e) => setQuoteReference(e.target.value)}/></div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                                <textarea className="w-full border p-3 rounded-lg outline-none focus:ring-1 focus:ring-black text-sm h-20" value={quoteObservations} onChange={(e) => setQuoteObservations(e.target.value)}></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pago y Condiciones</label>
                                <textarea className="w-full border p-3 rounded-lg outline-none focus:ring-1 focus:ring-black text-sm h-20" value={quoteConditions} onChange={(e) => setQuoteConditions(e.target.value)}></textarea>
                            </div>

                            <div className="pt-2 border-t border-gray-100"><label className="block text-sm font-medium text-gray-700 mb-2">Seleccionar Alternativas a Mostrar</label><div className="space-y-2">
                                <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.white} onChange={e => setEnabledScenarios({...enabledScenarios, white: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Melamina Blanca</span></label>
                                <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.textured} onChange={e => setEnabledScenarios({...enabledScenarios, textured: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Melamina Texturada / Color</span></label>
                                <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.lacquer} onChange={e => setEnabledScenarios({...enabledScenarios, lacquer: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Laqueado</span></label>
                                <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.veneer} onChange={e => setEnabledScenarios({...enabledScenarios, veneer: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Enchapado</span></label>
                            </div></div>
                            <button onClick={handleGenerateQuote} className="w-full bg-roden-black text-white py-3 rounded-lg font-bold mt-4">Confirmar y Ver Presupuesto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Production Order Modal */}
            {isProductionOrderModalOpen && (
                <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-roden-black">Generar Orden de Producción</h3>
                                <button onClick={() => setIsProductionOrderModalOpen(false)} className="text-gray-400 hover:text-black">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descripción del Item</label>
                                    <textarea 
                                        value={productionOrderForm.itemDescription}
                                        onChange={(e) => setProductionOrderForm(prev => ({ ...prev, itemDescription: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none min-h-[100px]"
                                        placeholder="Ej: Mueble de cocina completo según diseño..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Fecha Inicio</label>
                                        <input 
                                            type="date"
                                            value={productionOrderForm.startDate}
                                            onChange={(e) => setProductionOrderForm(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Fecha Entrega Est.</label>
                                        <input 
                                            type="date"
                                            value={productionOrderForm.estimatedDeliveryDate}
                                            onChange={(e) => setProductionOrderForm(prev => ({ ...prev, estimatedDeliveryDate: e.target.value }))}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Operarios (separados por coma)</label>
                                    <input 
                                        type="text"
                                        value={productionOrderForm.assignedOperators}
                                        onChange={(e) => setProductionOrderForm(prev => ({ ...prev, assignedOperators: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none"
                                        placeholder="Ej: Juan Perez, Alberto Gomez"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-100 flex gap-3">
                                <button 
                                    onClick={() => setIsProductionOrderModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveProductionOrder}
                                    className="flex-1 px-4 py-2 bg-roden-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                                >
                                    Generar Orden
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT ESTIMATE MODAL */}
            {isEditEstimateModalOpen && editingEstimate && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Pencil size={20}/> Editar Presupuesto
                                <span className="text-xs font-normal bg-gray-200 px-2 py-0.5 rounded text-gray-600">v{editingEstimate.version}</span>
                            </h3>
                            <button onClick={() => setIsEditEstimateModalOpen(false)}><X className="text-gray-400 hover:text-black"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                    <input className="w-full border p-2 rounded" value={editingEstimate.quoteData?.title || ''} onChange={e => handleUpdateEditingEstimate('quoteData.title', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                                    <input className="w-full border p-2 rounded" value={editingEstimate.quoteData?.reference || ''} onChange={e => handleUpdateEditingEstimate('quoteData.reference', e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lista de Precios</label>
                                <select 
                                    className="w-full border p-2 rounded bg-gray-50"
                                    value={editingEstimate.financialsSnapshot?.id || ''}
                                    onChange={e => {
                                        const list = priceHistory.find(h => h.id === e.target.value);
                                        if (list) handleUpdateEditingEstimate('financialsSnapshot', { ...list.settings, id: list.id, name: list.name });
                                    }}
                                >
                                    <option value="">Lista Actual del Presupuesto</option>
                                    {priceHistory.map(h => <option key={h.id} value={h.id}>{h.name} ({new Date(h.date).toLocaleDateString()})</option>)}
                                </select>
                            </div>

                            {/* GESTIÓN DE ÍTEMS */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Ítems del Presupuesto</label>
                                <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                                    {(editingEstimate.items || []).map(item => {
                                        const isRemoved = (editingEstimate as any)._removedItemIds?.includes(item.id);
                                        return (
                                            <div key={item.id} className={`flex items-center justify-between p-2 rounded border ${isRemoved ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white border-gray-200'}`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isRemoved ? 'bg-red-400' : 'bg-emerald-400'}`}></div>
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                    <span className="text-xs text-gray-400">{item.modules?.length || 0} módulos</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const removedIds = (editingEstimate as any)._removedItemIds || [];
                                                        if (isRemoved) {
                                                            setEditingEstimate(prev => prev ? { ...prev, _removedItemIds: removedIds.filter((id: string) => id !== item.id) } as any : null);
                                                        } else {
                                                            setEditingEstimate(prev => prev ? { ...prev, _removedItemIds: [...removedIds, item.id] } as any : null);
                                                        }
                                                    }}
                                                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${isRemoved ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                >
                                                    {isRemoved ? '↩ Restaurar' : '✕ Quitar'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {/* Ítems disponibles para agregar (del workspace actual) */}
                                    {items.filter(i => !(editingEstimate.items || []).some(ei => ei.id === i.id)).length > 0 && (
                                        <div className="border-t border-dashed border-gray-300 pt-2 mt-2">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Agregar ítems del workspace actual:</p>
                                            {items.filter(i => !(editingEstimate.items || []).some(ei => ei.id === i.id)).map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-2 rounded border border-dashed border-gray-200 bg-gray-50 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                        <span className="text-sm font-medium text-gray-600">{item.name}</span>
                                                        <span className="text-xs text-gray-400">{item.modules?.length || 0} módulos</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setEditingEstimate(prev => prev ? {
                                                                ...prev,
                                                                items: [...(prev.items || []), item]
                                                            } : null);
                                                        }}
                                                        className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                                    >
                                                        + Agregar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Alternativas a Mostrar</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['white', 'textured', 'lacquer', 'veneer'].map(s => (
                                        <label key={s} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={(editingEstimate.quoteData?.enabledScenarios as any)?.[s] ?? (s === 'white' || s === 'textured')} 
                                                onChange={e => handleUpdateEditingEstimate(`quoteData.enabledScenarios.${s}`, e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm capitalize">{s === 'white' ? 'Melamina Blanca' : s === 'textured' ? 'Melamina Color' : s === 'lacquer' ? 'Laqueado' : 'Enchapado'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* TERMINACIÓN FINAL (Para aprobación) */}
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <label className="block text-sm font-bold text-indigo-700 mb-2 flex items-center gap-2">
                                    <CheckCircle size={16}/> Terminación Final para Aprobación
                                </label>
                                <p className="text-[10px] text-indigo-600 mb-3">Selecciona la opción definitiva que el cliente ha elegido para este presupuesto.</p>
                                <select 
                                    className="w-full border border-indigo-200 p-2.5 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editingEstimate.finalTerminationScenario || ''}
                                    onChange={e => handleSetFinalTermination(e.target.value as any)}
                                >
                                    <option value="">-- No definida aún --</option>
                                    {(editingEstimate.quoteData?.enabledScenarios.white) && <option value="white">Melamina Blanca</option>}
                                    {(editingEstimate.quoteData?.enabledScenarios.textured) && <option value="textured">Melamina Color / Texturada</option>}
                                    {(editingEstimate.quoteData?.enabledScenarios.lacquer) && <option value="lacquer">Laqueado</option>}
                                    {(editingEstimate.quoteData?.enabledScenarios.veneer) && <option value="veneer">Enchapado</option>}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                                    <textarea className="w-full border p-2 rounded text-xs h-20" value={editingEstimate.quoteData?.observations || DEFAULT_OBSERVATIONS} onChange={e => handleUpdateEditingEstimate('quoteData.observations', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones</label>
                                    <textarea className="w-full border p-2 rounded text-xs h-20" value={editingEstimate.quoteData?.conditions || DEFAULT_CONDITIONS} onChange={e => handleUpdateEditingEstimate('quoteData.conditions', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-between gap-3 bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setIsEditEstimateModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold hover:text-black">Cancelar</button>
                            <div className="flex gap-3">
                                <button onClick={() => handleSaveEditedEstimate(false)} className="border border-gray-300 bg-white text-gray-700 px-5 py-2 rounded-lg font-bold hover:bg-gray-50 transition-colors">Guardar</button>
                                <button onClick={() => handleSaveEditedEstimate(true)} className="bg-roden-black text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
                                    <FileText size={16}/> Ver Presupuesto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: VINCULAR A PROYECTO */}
            {vinculandoEstimateId && (
                <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Link size={18}/> Vincular a Proyecto</h3>
                            <button onClick={() => setVinculandoEstimateId(null)}><X className="text-gray-400 hover:text-black"/></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Vinculá esta estimación a un proyecto existente. El estado comercial pasará automáticamente a <strong>En Producción</strong>, conectando el estimador con la gestión de proyectos y taller.
                        </p>
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Proyecto</label>
                            <select
                                className="w-full border border-gray-200 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-black outline-none"
                                value={vinculandoProjectId}
                                onChange={e => setVinculandoProjectId(e.target.value)}
                            >
                                <option value="">-- Sin vincular (Solo historial) --</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title} ({p.status})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={() => setVinculandoEstimateId(null)} className="px-4 py-2 text-gray-500 font-bold hover:text-black text-sm">Cancelar</button>
                            <button onClick={handleConfirmVincular} className="bg-roden-black text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 shadow-lg">
                                Confirmar Vinculación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {costComparisonAlert && costComparisonAlert.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-red-50 px-6 py-4 border-b border-red-200 flex items-center gap-3">
                            <AlertTriangle size={20} className="text-red-500"/>
                            <h3 className="font-bold text-lg text-red-700">¡Atención: Cambio Significativo de Costo!</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-700">
                                La modificación técnica ha resultado en un cambio de costo superior al 5%.
                                Por favor, revisa los detalles antes de confirmar.
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="font-medium text-gray-500">Costo Original:</div>
                                <div className="font-bold text-right">{formatCurrency(costComparisonAlert.originalCost)}</div>
                                <div className="font-medium text-gray-500">Costo Actualizado:</div>
                                <div className="font-bold text-right text-red-600">{formatCurrency(costComparisonAlert.updatedCost)}</div>
                                <div className="font-medium text-gray-500">Diferencia:</div>
                                <div className={`font-bold text-right ${costComparisonAlert.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(costComparisonAlert.difference)} ({costComparisonAlert.percentage.toFixed(2)}%)
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button 
                                onClick={costComparisonAlert.onCancel}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={costComparisonAlert.onConfirm}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                            >
                                Confirmar Cambio
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    </div>
  );
};

export default CostEstimator;
