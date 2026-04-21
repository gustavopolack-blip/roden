
import React, { useState, useEffect } from 'react';
import { 
  CostSettings, CabinetModule, CalculatedPart, Project, ModuleType, PriceListHistory, SavedEstimate, EdgeCategory,
  CostModule, CostSnapshot, CommercialConfig, MaterialConfig, BudgetStatus, ProductionOrder, ProductionOrderStatus,
  CommercialStatus, ProductionStatus, AuditEntry, Client, User
} from '../types';
import { 
  Database, Plus, Trash2, 
  DollarSign, Calculator, Box, FileText,
  Hammer, TrendingUp, Save, History,
  Search, Printer, Scissors, Pencil, X, AlertTriangle, ArrowLeft, ListPlus, Package, Check, Layers, Settings, ChevronRight, FileCheck, ArrowDown, Link, Download, Grid, PieChart, ShoppingCart, FolderPlus, ArrowRight, RefreshCw, Archive, Eye, Clock, Calendar, ChevronDown, ChevronUp, Share2, Activity, CheckCircle, Copy, ArrowUpCircle, Zap
} from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';
import { generateCutPlan, Sheet } from '../utils/cutOptimizer';
import { SPECIAL_MODULE_TEMPLATES, getTemplate, calculateSpecialModuleCost, SPECIAL_MANUAL_ID, SpecialModuleParams, ManualItem } from '../utils/specialModules';
import { supabase } from '../services/supabaseClient';

interface CostEstimatorProps {
    projects?: Project[];
    clients?: Client[];
    savedEstimates?: SavedEstimate[]; 
    userRole: string;
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
        baseConfig?: number; // legacy field from old saved estimates
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
    { label: 'Melamina Blanca MDP 18mm', value: 'priceBoard18WhiteAglo' },
    { label: 'Melamina Blanca MDF 18mm', value: 'priceBoard18WhiteMDF' },
    { label: 'Melamina Color MDP 18mm', value: 'priceBoard18ColorAglo' },
    { label: 'Melamina Color MDF 18mm', value: 'priceBoard18ColorMDF' },
    { label: 'MDF Crudo 1 Cara Blanca 18mm', value: 'priceBoard18MDFCrudo1Face' },
    { label: 'Enchapado Kiri 18mm MDF', value: 'priceBoard18VeneerMDF' },
    { label: 'Melamina Blanca 15mm MDP', value: 'priceBoard15WhiteAglo' },
    { label: 'Fondo Blanco 3mm', value: 'priceBacking3White' },
    { label: 'Fondo Color 5.5mm', value: 'priceBacking55Color' },
];

const CostEstimator: React.FC<CostEstimatorProps> = ({ 
    projects = [], 
    clients = [],
    savedEstimates = [], 
    userRole,
    onSaveEstimate, 
    onDeleteEstimate,
    onAddProductionOrder,
    initialProjectId
}) => {
  const [view, setView] = useState<'SETUP' | 'MODULES' | 'RESULTS' | 'HISTORY'>('MODULES');
    const [printMode, setPrintMode] = useState<'NONE' | 'SUPPLIES' | 'CUTTING' | 'COSTS' | 'COSTS_CUTS' | 'ECONOMIC' | 'PRODUCTION_ORDER'>('NONE');
    
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
      observations: string;
      linkedProjectId: string;
  }>({ itemDescription: '', startDate: '', estimatedDeliveryDate: '', assignedOperators: '', observations: '', linkedProjectId: '' });

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

  // Estado item templates (historial)
  const [itemTemplates, setItemTemplates] = useState<any[]>([]);
  const [isTemplatesPanelOpen, setIsTemplatesPanelOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Cargar templates desde Supabase al montar
  useEffect(() => {
      const loadTemplates = async () => {
          const { data, error } = await supabase
              .from('item_templates')
              .select('*')
              .order('created_at', { ascending: false });
          if (!error && data) setItemTemplates(data);
      };
      loadTemplates();
  }, []);

  // Estado módulos especiales
  const [moduleKind, setModuleKind] = useState<'STANDARD' | 'SPECIAL' | 'MANUAL'>('STANDARD');
  const [specialTemplateId, setSpecialTemplateId] = useState<string>('');
  const [specialOptions, setSpecialOptions] = useState<Record<string, string>>({});
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [newManualItem, setNewManualItem] = useState<ManualItem>({ id: '', description: '', quantity: 1, unit: 'un', unitPrice: 0 });

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

  useEffect(() => {
    const loadPriceLists = async () => {
      const { data, error } = await supabase.from('price_lists').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading price lists:', error);
        return;
      }
      setPriceHistory(data.map(d => ({ id: d.id, date: d.created_at, name: d.name, settings: d.settings || {} })));
    };
    loadPriceLists();
  }, []);
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
      // PLACAS — Lista Mech Feb 2026 + IVA 21%
      priceBoard18WhiteAglo: 78460,      // Faplac 18mm Aglo Blanco
      priceBoard18WhiteMDF: 97595,       // Faplac 18mm MDF Blanco
      priceBoard18ColorAglo: 93651,      // Faplac 18mm Aglo Clásicas
      priceBoard18ColorMDF: 114475,      // Faplac 18mm MDF Clásicas
      priceBoard18MDFCrudo1Face: 93308,  // Faplac 18mm 1C MDF Blanco
      priceBoard18VeneerMDF: 150105,     // Kiri 18mm MDF (enchapado)
      priceBoard15WhiteAglo: 70323,      // Faplac 15mm Tundra Aglo
      priceBacking3White: 33152,         // Fondo MDF 3mm Blanco Laca
      priceBacking55Color: 26775,        // Trupan 5.5mm 260x183

      // TAPACANTOS — Lista Mech Feb 2026 + IVA 21%
      priceEdge22White045: 284,          // Rehau 0,45x22 Blanco
      priceEdge45White045: 419,          // Rehau 0,45x29 Blanco (estándar)
      priceEdge22Color045: 551,          // Rehau 0,45x22 Color (promedio)
      priceEdge45Color045: 877,          // Rehau 0,45x29 Color (promedio)
      priceEdge2mm: 1764,                // Rehau 2mm (promedio)

      // HERRAJES — IVA incluido
      priceHingeStandard: 1000,
      priceHingeSoftClose: 1600,
      priceHingePush: 1400,

      priceSlide300Std: 3300,
      priceSlide300Soft: 7000,
      priceSlide300Push: 7000,
      priceSlide400Std: 4300,
      priceSlide400Soft: 8500,
      priceSlide400Push: 8500,
      priceSlide500Std: 5500,
      priceSlide500Soft: 10000,
      priceSlide500Push: 10000,

      priceGasPiston: 3000,
      priceGlueTin: 30250,
      priceScrews: 30000, // Tornillería fija por Item (no por módulo)

      // ACABADOS
      priceFinishLacquerSemi: 45000,
      priceFinishLacquerGloss: 55000,
      priceFinishLustreSemi: 48000,
      priceFinishLustreGloss: 58000,

      // MANO DE OBRA
      costLaborDay: 35000
  });

  const [activeSettings, setActiveSettings] = useState<CostSettings & { id?: string; name?: string }>(settings);


  // --- HELPERS ---

  const roundUp10 = (val: number) => {
      return Math.ceil(val / 10) * 10;
  };

  const formatCurrency = (amount: number) => {
      const safe = (amount == null || isNaN(amount as number)) ? 0 : (amount as number);
      return `$${safe.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getProjectTitleById = (id?: string) => {
      const p = projects.find(prj => prj.id === id);
      return (p ? p.title : 'Desconocido') || 'Sin Título';
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
        // Módulo especial: usar las piezas pre-calculadas por el template
        if ((mod as any).isSpecialModule && (mod as any).specialParts?.length > 0) {
            return (mod as any).specialParts as CalculatedPart[];
        }
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

          // Área de terminación según tipo + coeficiente de seguridad 1.15
          // MELAMINE_STRUCT_LACQUER/VENEER → solo frentes (W×H)
          // LACQUER_FULL / VENEER_FULL     → exterior completo (frente + laterales + techo + piso)
          const FINISH_SAFETY = 1.15;
          const visibleExteriorArea = frontArea + sidesArea + topBottomArea;
          const baseFinishArea = (mType === 'LACQUER_FULL' || mType === 'VENEER_FULL')
              ? visibleExteriorArea
              : frontArea; // MELAMINE_STRUCT → solo frente
          const finishArea = baseFinishArea * FINISH_SAFETY;

          if (mType && mType.includes('LACQUER')) lacquerArea += finishArea * qty;
          else if (mType && mType.includes('VENEER')) veneerArea += finishArea * qty;

          parts.forEach(p => {
              const area = p.width * p.height * p.quantity * qty;
              const perimeter = (p.width + p.height) * 2 * p.quantity * qty;
              const isFront = p.name.includes('Frente') || p.name.includes('Puerta');

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
              if (mod.edgeCategory === 'PVC_2MM') {
                  if (p.material.includes('18mm') || p.material.includes('15mm')) linear2mm += perimeter;
              } else {
                  const safeMatName = (currentMatName || '').toLowerCase();
                  const isSpecialFront = p.material === '18mm_MDFCrudo' || p.material === '18mm_Kiri';
                  const isWhiteMat = !isSpecialFront && (safeMatName.includes('blanco') || safeMatName.includes('white'));
                  const isFrontPiece = p.name.includes('Frente') || p.name.includes('Puerta');
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
                  const isWhitePiece = p.material.includes('White') || p.material === '18mm_White';
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
          lacquerAreaM2: Math.round(lacquerArea * 100) / 100,  // ya está en m²
          veneerAreaM2:  Math.round(veneerArea  * 100) / 100,  // ya está en m²
          totalHinges, totalPistons, totalSlides, totalExtrasCost,
          // Report Details
          detailedBoards,
          detailedHardware,
          avgComplexity: parseFloat((totalAreaForComplexity > 0 ? totalComplexityFactor / totalAreaForComplexity : 1.0).toFixed(2))
      };
  };

  // ─────────────────────────────────────────────────────────────
  // ENGINE ÚNICO — calcula costo directo y precio taller
  // para un conjunto de módulos con override de escenario.
  // Usa calculateModuleParts (Engine A) como única fuente de verdad
  // geométrica. La MO siempre viene del parámetro laborCost (workers×days×rate).
  // ─────────────────────────────────────────────────────────────
  const calculateFinancialsForScenario = (
      currentModules: ExtendedCabinetModule[],
      laborCost: number,
      margins: { workshop: number; roden: number },
      scenarioOverride: Partial<CabinetModule> = {},
      snapshotOverride?: CostSnapshot
  ) => {
      const S: any = snapshotOverride || activeSettings;
      const SHEET_AREA = 2750 * 1830;
      const WASTE = 1.20;
      const WASTE_VENEER = 1.25;
      const WASTE_3MM = 1.10;
      const WASTE_55MM = 1.10;
      const WASTE_15MM = 1.20;

      // Resolver precio de placa por tipo de material
      // IMPORTANTE: los precios en la lista son por PLACA ENTERA (2750×1830mm = 5.0325m²)
      // El costo por m² = precio_placa / SHEET_AREA_M2
      const SHEET_AREA_M2 = (2750 * 1830) / 1_000_000; // 5.0325 m²
      const SHEET_AREA_M2_55 = (2600 * 1830) / 1_000_000; // 4.758 m² — Trupan 5.5mm

      const pricePerM2 = (pricePerSheet: number): number => pricePerSheet / SHEET_AREA_M2;
      const pricePerM2_55 = (pricePerSheet: number): number => pricePerSheet / SHEET_AREA_M2_55;

      const resolvePriceBody = (isWhite: boolean, isMDF: boolean): number => {
          if (isMDF)    return pricePerM2(isWhite ? S.priceBoard18WhiteMDF   : S.priceBoard18ColorMDF);
          return               pricePerM2(isWhite ? S.priceBoard18WhiteAglo  : S.priceBoard18ColorAglo);
      };
      const resolvePriceFront = (frontMat: '18mm_White' | '18mm_Color' | '18mm_MDF', frontIsMDF: boolean): number => {
          if (frontMat === '18mm_MDF')   return pricePerM2(S.priceBoard18MDFCrudo1Face || S.priceBoard18ColorMDF);
          if (frontMat === '18mm_White') return pricePerM2(frontIsMDF ? S.priceBoard18WhiteMDF : S.priceBoard18WhiteAglo);
          return pricePerM2(frontIsMDF ? S.priceBoard18ColorMDF : S.priceBoard18ColorAglo);
      };

      let totalDirectCost = 0;
      let totalMaterialCostBase = 0;
      let totalHardwareCost = 0;

      currentModules.forEach(rawMod => {
          const mod = { ...rawMod, ...scenarioOverride };
          const qty = mod.quantity || 1;

          // ── Resolver materiales del escenario ──
          // Si el scenarioOverride fuerza isMDFCore, tiene prioridad sobre los valores del módulo
          const overridesMDF = 'isMDFCore' in scenarioOverride;
          const structCore = overridesMDF
              ? (scenarioOverride.isMDFCore ? 'MDF' : 'AGLO')
              : (mod.structureCore || (mod.isMDFCore ? 'MDF' : 'AGLO'));
          const frontsCore = overridesMDF
              ? (scenarioOverride.isMDFCore ? 'MDF' : 'AGLO')
              : (mod.frontsCore || (mod.isMDFCore ? 'MDF' : 'AGLO'));
          const isWhiteStruct = !!mod.isWhiteStructure;
          const mType = mod.moduleType || 'MELAMINE_FULL';

          let carcassMat: '18mm_White' | '18mm_Color' | '18mm_MDF';
          if (structCore === 'MDF') carcassMat = '18mm_MDF';
          else carcassMat = isWhiteStruct ? '18mm_White' : '18mm_Color';

          let frontMat: '18mm_White' | '18mm_Color' | '18mm_MDF';
          if (mType.includes('LACQUER') || mType.includes('VENEER') || frontsCore === 'MDF') {
              frontMat = '18mm_MDF';
          } else {
              const frontName = (mod.materialFrontName || '').toLowerCase();
              const isFrontWhite = frontName
                  ? (frontName.includes('blanc') || frontName.includes('white'))
                  : isWhiteStruct;
              frontMat = isFrontWhite ? '18mm_White' : '18mm_Color';
          }

          const isVeneer  = mType.includes('VENEER');
          const isLacquer = mType.includes('LACQUER');

          // ── Precio por placa ──
          // isWhiteStruct determina blanca/color independientemente del core (MDF/MDP)
          const priceBody  = resolvePriceBody(
              isWhiteStruct,           // blanca o color — independiente del core
              structCore === 'MDF'     // MDF o MDP
          );
          // Para frentes: isFrontWhite también independiente del core
          const isFrontWhiteForPrice = frontMat === '18mm_White' || 
              (frontMat !== '18mm_MDF' && (mod.materialFrontName ? 
                  (mod.materialFrontName.toLowerCase().includes('blanc') || mod.materialFrontName.toLowerCase().includes('white')) 
                  : isWhiteStruct));
          const priceFront = resolvePriceFront(frontMat, frontsCore === 'MDF');

          // ── Calcular piezas ──
          const parts = calculateModuleParts(mod);
          


          let costMat = 0;
          let linearEdge22 = 0; // tapacanto interior 22mm — estructura y cajones
          let linearEdge45 = 0; // tapacanto visible 45mm  — frentes y piezas especiales

          parts.forEach(p => {
              const areaMM2 = p.width * p.height * p.quantity * qty;
              const areaM2  = areaMM2 / 1_000_000;
              const isFront = p.name.includes('Frente') || p.name.includes('Puerta');
              const perimMM = (p.width + p.height) * 2 * p.quantity * qty;

              if (p.material === '18mm_White' || p.material === '18mm_Color' || p.material === '18mm_MDF') {
                  if (isFront) {
                      costMat += areaM2 * priceFront * (isVeneer ? WASTE_VENEER : WASTE);
                      linearEdge45 += perimMM / 1000; // frentes melamina: tapacanto visible 45mm
                  } else {
                      costMat += areaM2 * priceBody * WASTE;
                      linearEdge22 += perimMM / 1000; // estructura/cajones: tapacanto interior 22mm
                  }
              } else if (p.material === '18mm_MDFCrudo') {
                  // Frentes para laquear: MDF crudo 1 cara blanca
                  costMat += areaM2 * pricePerM2(S.priceBoard18MDFCrudo1Face || 0) * WASTE;
                  linearEdge45 += perimMM / 1000; // siempre tapacanto color visible 45mm
              } else if (p.material === '18mm_Kiri') {
                  // Frentes enchapados: placa Kiri MDF
                  costMat += areaM2 * pricePerM2(S.priceBoard18VeneerMDF || 0) * WASTE_VENEER;
                  linearEdge45 += perimMM / 1000; // siempre tapacanto color visible 45mm
              } else if (p.material === '3mm_White') {
                  costMat += areaM2 * pricePerM2(S.priceBacking3White  || 0) * WASTE_3MM;
              } else if (p.material === '5.5mm_Color' || p.material.includes('55')) {
                  costMat += areaM2 * pricePerM2_55(S.priceBacking55Color || 0) * WASTE_55MM;
              } else if (p.material === '15mm_White') {
                  costMat += areaM2 * pricePerM2(S.priceBoard15WhiteAglo || 0) * WASTE_15MM;
              }
          });

          // ── Tapacanto ──
          // 22mm: bordes interiores (estructura, cajones)  — precio más económico
          // 45mm: bordes visibles (frentes, piezas especiales) — precio estándar visible
          let costEdge = 0;
          if (mod.edgeCategory === 'PVC_2MM') {
              costEdge = (linearEdge22 + linearEdge45) * (S.priceEdge2mm || 0);
          } else {
              const bodyIsWhite = carcassMat === '18mm_White';
              // Frentes laqueados/enchapados: siempre tapacanto color (MDFCrudo y Kiri no son blancos)
              const frontsAreWhite = frontMat === '18mm_White' && !isLacquer && !isVeneer;
              const price22 = bodyIsWhite  ? (S.priceEdge22White045 || 0) : (S.priceEdge22Color045 || 0);
              const price45 = frontsAreWhite ? (S.priceEdge45White045 || 0) : (S.priceEdge45Color045 || 0);
              costEdge = linearEdge22 * price22 + linearEdge45 * price45;
          }

          // ── Acabado (laca / enchapado) ──
          const frontAreaM2 = parts
              .filter(p => p.name.includes('Frente') || p.name.includes('Puerta'))
              .reduce((a, p) => a + (p.width * p.height * p.quantity * qty) / 1_000_000, 0);

          let costFinish = 0;
          if (isLacquer) costFinish = frontAreaM2 * 1.15 * (S.priceFinishLacquerSemi || 0);
          else if (isVeneer) costFinish = frontAreaM2 * 1.15 * (S.priceFinishLustreSemi || 0);

          // ── Herrajes ──
          let costHW = 0;
          if (mod.calculateHinges) {
              const H = mod.height || 0;
              const hingesPerDoor = H > 1500 ? 4 : H > 900 ? 3 : 2;
              const hingeCount = ((mod.cntDoors || 0) * hingesPerDoor) + ((mod.cntFlaps || 0) * 2);
              const priceHinge = mod.hingeType === 'SOFT_CLOSE' ? (S.priceHingeSoftClose || 0)
                               : mod.hingeType === 'PUSH'       ? (S.priceHingePush || 0)
                               : (S.priceHingeStandard || 0);
              costHW += hingeCount * priceHinge * qty;
          }
          if (mod.calculateSlides) {
              const depth = mod.depth || 0;
              let priceSlide = S.priceSlide500Std || 0;
              if (depth < 400) priceSlide = mod.slideType === 'TELESCOPIC_SOFT' ? (S.priceSlide300Soft || 0) : (S.priceSlide300Std || 0);
              else if (depth < 500) priceSlide = mod.slideType === 'TELESCOPIC_SOFT' ? (S.priceSlide400Soft || 0) : (S.priceSlide400Std || 0);
              else priceSlide = mod.slideType === 'TELESCOPIC_SOFT' ? (S.priceSlide500Soft || 0) : (S.priceSlide500Std || 0);
              costHW += (mod.cntDrawers || 0) * priceSlide * qty;
          }
          if (mod.hasGasPistons) {
              costHW += (mod.cntFlaps || 0) * (S.priceGasPiston || 0) * qty;
          }
          // Extras del módulo
          (mod.extras || []).forEach((ex: any) => {
              costHW += ex.unitPrice * ex.quantity;
          });

          const modDirectCost = costMat + costEdge + costFinish + costHW;
          totalMaterialCostBase += costMat + costEdge + costFinish;
          totalHardwareCost     += costHW;
          totalDirectCost       += modDirectCost;
      });

      // ── Agregar MO y costos fijos ──
      // Costos fijos por ítem: tornillería + cemento (igual que la planilla de costos)
      const fixedCosts = (S.priceScrews || 0) + (S.priceGlueTin || 0);
      totalDirectCost += laborCost + fixedCosts;

      const priceWorkshop = totalDirectCost * (1 + (margins.workshop ?? 35) / 100);
      const finalPrice    = priceWorkshop   * (1 + (margins.roden ?? 0) / 100);

      return {
          finalPrice,
          totalHardwareCost,
          totalMaterialCostBase,
          totalDirectCost,
          d: totalDirectCost,
          w: priceWorkshop,
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
      
      const laborCost = itemForm.workers * itemForm.days * activeSettings.costLaborDay;
      const margins = { workshop: itemForm.marginWorkshop, roden: itemForm.marginRoden };

      // Detectar si todos los módulos son manuales
      const isFullyManual = pendingModules.length > 0 &&
          pendingModules.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);

      let newItem: EstimatorItem;

      if (isFullyManual) {
          // Ítem manual: costo directo = suma de ítems del módulo (materiales) + mano de obra
          // Sobre ese costo directo se aplican beneficio taller y beneficio roden
          const totalExtras = pendingModules.reduce((sum, m) => {
              return sum + (m.extras || []).reduce((s: number, ex: any) => s + ex.unitPrice * ex.quantity, 0);
          }, 0);
          const costoDirecto = totalExtras + laborCost;
          const wm = 1 + (margins.workshop / 100);
          const wr = 1 + (margins.roden / 100);
          const precioTaller  = costoDirecto * wm;
          const manualFinalPrice = precioTaller * wr;

          newItem = {
              id: `item${Date.now()}`,
              name: itemForm.name,
              modules: [...pendingModules],
              labor: { workers: itemForm.workers, days: itemForm.days },
              margins: margins,
              isManualItem: true,
              scenarioPrices: {
                  whiteAglo: manualFinalPrice,
                  whiteMDF: manualFinalPrice,
                  colorAglo: manualFinalPrice,
                  colorMDF: manualFinalPrice,
                  whiteLacqAglo: manualFinalPrice,
                  whiteLacqMDF: manualFinalPrice,
                  colorLacqAglo: manualFinalPrice,
                  colorLacqMDF: manualFinalPrice,
                  whiteVenrAglo: manualFinalPrice,
                  whiteVenrMDF: manualFinalPrice,
                  colorVenrAglo: manualFinalPrice,
                  colorVenrMDF: manualFinalPrice,
                  baseConfig: precioTaller, // precio taller (sin beneficio Roden)
              },
              details: {
                  totalHardwareCost: laborCost,
                  totalMaterialCostBase: totalExtras,
                  manualCostoDirecto: costoDirecto,
                  manualPrecioTaller: precioTaller,
                  manualPrecioFinal: manualFinalPrice,
              }
          } as any;
      } else {
          // Ítem estándar: 12 escenarios — engine unificado (mismo que planilla de costos).
          // Se construye un ítem temporal y se llama a getRecalculatedItemPrices con activeSettings.
          const tempItem: EstimatorItem = {
              id: 'temp',
              name: itemForm.name,
              modules: [...pendingModules],
              labor: { workers: itemForm.workers, days: itemForm.days },
              margins: margins,
              scenarioPrices: { whiteAglo: 0, whiteMDF: 0, colorAglo: 0, colorMDF: 0, lacquer: 0, veneer: 0 },
              details: { totalHardwareCost: 0, totalMaterialCostBase: 0 }
          };
          const rp = getRecalculatedItemPrices(tempItem, activeSettings);

          newItem = {
              id: `item${Date.now()}`,
              name: itemForm.name,
              modules: [...pendingModules],
              labor: { workers: itemForm.workers, days: itemForm.days },
              margins: margins,
              scenarioPrices: {
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
              } as any,
              details: {
                  totalHardwareCost: (rp as any).totalDirectCost,
                  totalMaterialCostBase: 0
              }
          };
      }

      setItems(prev => [...prev, newItem]);
      setPendingModules([]);
      setIsItemModalOpen(false);

      // Guardar automáticamente en Supabase como template reutilizable
      const templateToSave = {
          name:    newItem.name,
          modules: newItem.modules,
          labor:   newItem.labor,
          margins: newItem.margins,
      };
      supabase.from('item_templates').insert(templateToSave).then(({ data, error }) => {
          if (!error) {
              setItemTemplates(prev => [{
                  ...templateToSave,
                  id:         `tpl_${Date.now()}`,
                  created_at: new Date().toISOString()
              }, ...prev]);
          }
      });
  };

  // Cargar template: copia módulos al área de trabajo
  const handleLoadTemplate = (template: any, editMode: boolean = false) => {
      if (pendingModules.length > 0) {
          if (!confirm('Hay módulos pendientes. Se reemplazarán con los del template. ¿Continuar?')) return;
      }
      const clonedModules = JSON.parse(JSON.stringify(template.modules)).map((m: any) => ({
          ...m,
          id: `m${Date.now()}_${Math.random().toString(36).slice(2,6)}`
      }));
      setPendingModules(clonedModules);
      setItemForm({
          name:          template.name,
          workers:       template.labor?.workers  ?? 2,
          days:          template.labor?.days      ?? 3,
          marginWorkshop:template.margins?.workshop ?? 35,
          marginRoden:   template.margins?.roden    ?? 25,
      });
      setIsTemplatesPanelOpen(false);
      if (!editMode) {
          // En modo copia directa, abre modal de Item pre-cargado
          setIsItemModalOpen(true);
      }
      // En modo edición, el usuario modifica los módulos pendientes y crea el Item manualmente
  };

  const deleteItem = (id: string) => {
      if(confirm('¿Eliminar este item del presupuesto?')) {
          setItems(prev => prev.filter(i => i.id !== id));
      }
  };

  const handleEditItem = (item: EstimatorItem) => {
      if (pendingModules.length > 0) {
          if (!confirm("Hay módulos pendientes que se moverán al final de la lista si editas este item. ¿Continuar?")) {
              return;
          }
      }
      // Move item modules back to pending
      setPendingModules(prev => [...prev, ...item.modules]);
      
      // Load item data into form for re-creation
      setItemForm({
          name: item.name,
          workers: item.labor.workers,
          days: item.labor.days,
          marginWorkshop: item.margins.workshop,
          marginRoden: item.margins.roden
      });
      
      // Remove from items list
      setItems(prev => prev.filter(i => i.id !== item.id));
      
      // Scroll to top or provide feedback? 
      // The user will see modules back in the pending list.
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
      // Usar lista activa directamente — sin modal de selección
      setQuoteItemTitle("Amoblamiento Integral");
      setQuoteReference(getActiveProjectName());
      setQuoteId(generateQuoteId());
      setShowQuoteModal(true);
  };

  const handleSelectPriceList = (listSettings: CostSettings, id?: string, name?: string) => {
      // Si hay un presupuesto pendiente de actualización, ejecutar eso
      if (updatePricesEstimate) {
          handleConfirmUpdatePrices(listSettings, id, name);
          return;
      }
      // Caso legacy (no debería usarse para nuevos flujos)
      setActiveSettings({ ...listSettings, id, name });
      setIsPriceListModalOpen(false);
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
              priceListId: (activeSettings.id && activeSettings.id !== 'current') ? activeSettings.id : null,
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

  const [updatePricesEstimate, setUpdatePricesEstimate] = useState<SavedEstimate | null>(null);

  const handleUpdatePrices = (originalEstimate: SavedEstimate) => {
      // Abrir modal de selección de lista para recalcular
      setUpdatePricesEstimate(originalEstimate);
      setIsPriceListModalOpen(true);
  };

  const handleConfirmUpdatePrices = (listSettings: CostSettings, id?: string, name?: string) => {
      if (!updatePricesEstimate || !onSaveEstimate) return;
      const newVersion: SavedEstimate = {
          ...updatePricesEstimate,
          id: `est${Date.now()}`,
          date: new Date().toISOString(),
          version: (updatePricesEstimate.version || 1) + 1,
          parentId: updatePricesEstimate.id,
          isLatest: true,
          settingsSnapshot: { ...listSettings, id, name } as any,
          priceListId: (id && id !== 'current') ? id : null,
          auditLog: [
              ...(updatePricesEstimate.auditLog || []),
              {
                  from: updatePricesEstimate.commercialStatus || 'N/A',
                  to: updatePricesEstimate.commercialStatus || 'N/A',
                  timestamp: new Date().toISOString(),
                  user: `Sistema (Actualización de Precios — ${name || 'Lista Actual'})`
              }
          ]
      };
      onSaveEstimate(newVersion);
      setUpdatePricesEstimate(null);
      setIsPriceListModalOpen(false);
      alert(`Nueva versión v${newVersion.version} con precios de "${name || 'Lista Actual'}".`);
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

      // Si todos los ítems son manuales: no hay recálculo ni comparación de costos.
      // El precio queda exactamente igual al presupuesto aprobado.
      const allManual = technicalItems.length > 0 && technicalItems.every(item =>
          (item as any).isManualItem ||
          item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID)
      );

      if (allManual) {
          const updatedEstimate: SavedEstimate = {
              ...originalEstimateForComparison,
              items: technicalItems,
              hasTechnicalDefinition: true,
              date: new Date().toISOString(),
          };
          onSaveEstimate(updatedEstimate);
          setIsTechnicalModalOpen(false);
          return;
      }

      // 1. Calculate the updated cost based on technicalItems
      // Ítems manuales dentro de un presupuesto mixto: conservan su precio original
      // Usar el mismo engine unificado (getRecalculatedItemPrices) con el snapshot histórico del presupuesto.
      const budgetHistSnap = (originalEstimateForComparison.settingsSnapshot || activeSettings) as CostSettings;
      const updatedTotalDirectCost = technicalItems.reduce((sum, item) => {
          if ((item as any).isManualItem || item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID)) {
              return sum + (item.details?.totalMaterialCostBase || 0) + (item.details?.totalHardwareCost || 0);
          }
          const prices = getRecalculatedItemPrices(item, budgetHistSnap);
          return sum + (prices as any).totalDirectCost;
      }, 0);

      const updatedFinalPrice = technicalItems.reduce((sum, item) => {
          if ((item as any).isManualItem || item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID)) {
              // Precio manual: preservar el del presupuesto aprobado
              return sum + (item.scenarioPrices?.colorAglo || (item as any).details?.manualPrecioFinal || 0);
          }
          const prices = getRecalculatedItemPrices(item, budgetHistSnap);
          return sum + prices.colorAglo;
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
      if (!budget) return;

      // Validar que tenga definición técnica antes de enviar a producción
      if (!budget.hasTechnicalDefinition) {
          alert('Este presupuesto no tiene Definición Técnica confirmada.\nDefiní materiales, colores y cores antes de generar la Orden de Producción.');
          return;
      }

      setProductionOrderForm({
          itemDescription: budget.quoteData?.title || budget.customProjectName || '',
          startDate: new Date().toISOString().split('T')[0],
          estimatedDeliveryDate: '',
          assignedOperators: '',
          observations: '',
          linkedProjectId: (budget.projectId && budget.projectId !== 'NEW') ? budget.projectId : '',
      });
      setSelectedBudgetIdForProduction(budgetId);
      setIsProductionOrderModalOpen(true);
  };

  const handleSaveProductionOrder = async () => {
      if (!selectedBudgetIdForProduction) return;
      
      const budget = savedEstimates?.find(b => b.id === selectedBudgetIdForProduction);
      if (!budget) return;

      // Extraer módulos desde items (presupuestos ECONOMIC tienen módulos en items[n].modules)
      const allModules = budget.items
          ? budget.items.flatMap((item: any) => item.modules || [])
          : budget.modules || [];

      // Calcular lista de materiales y herrajes desde los módulos técnicos
      const materialsSummary = allModules.length > 0
          ? calculateItemQuantities(allModules)
          : null;

      const newOrder = {
          // Columnas existentes en DB
          order_number: `OP-${Date.now().toString().slice(-6)}`,
          project_id: productionOrderForm.linkedProjectId || (budget.projectId === 'NEW' ? null : budget.projectId),
          start_date: productionOrderForm.startDate,
          delivery_date: productionOrderForm.estimatedDeliveryDate,
          status: ProductionOrderStatus.PENDING,
          items: allModules,
          assigned_operators: productionOrderForm.assignedOperators.split(',').map((s: string) => s.trim()).filter(Boolean),
          // Columnas adicionales
          clientName: (() => {
              const pid = productionOrderForm.linkedProjectId || (budget.projectId !== 'NEW' ? budget.projectId : null);
              return pid ? getProjectTitleById(pid) : budget.customProjectName || 'Sin Nombre';
          })(),
          itemDescription: productionOrderForm.itemDescription,
          estimatedDeliveryDate: productionOrderForm.estimatedDeliveryDate,
          budgetId: budget.id,
          linkedProjectId: productionOrderForm.linkedProjectId || (budget.projectId === 'NEW' ? null : budget.projectId),
          observations: productionOrderForm.observations,
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
              priceListId: (activeSettings.id && activeSettings.id !== 'current') ? activeSettings.id : null,
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
      const groupedByMaterial: Record<string, { id: string, label: string, width: number, height: number, quantity: number, grain: 'horizontal' | 'vertical' | 'free' }[]> = {};

      itemsToProcess.forEach(item => {
          item.modules.forEach(mod => {
              const parts = calculateModuleParts(mod);
              parts.forEach(part => {
                  // Resolver clave de material legible
                  let materialKey = part.material as string;
                  if (materialKey === '18mm_White')    materialKey = mod.materialColorName?.includes('blanc') ? mod.materialColorName : 'Melamina Blanca 18mm';
                  else if (materialKey === '18mm_Color')    materialKey = mod.materialColorName || 'Melamina Color 18mm';
                  else if (materialKey === '18mm_MDF')      materialKey = 'Melamina Blanca MDF 18mm';
                  else if (materialKey === '18mm_MDFCrudo') materialKey = 'MDF Crudo 1 Cara 18mm';
                  else if (materialKey === '18mm_Kiri')     materialKey = 'Enchapado Kiri 18mm';
                  else if (materialKey === '15mm_White')    materialKey = 'Melamina Blanca 15mm';
                  else if (materialKey === '3mm_White')     materialKey = 'Fondo 3mm Blanco';
                  else if (materialKey === '5.5mm_Color' || materialKey.includes('55mm')) materialKey = 'Fondo 5.5mm Color';

                  if (!groupedByMaterial[materialKey]) groupedByMaterial[materialKey] = [];

                  // Pasar el grain de la pieza al optimizador
                  const grain = (part.grain === 'horizontal' || part.grain === 'vertical') ? part.grain : 'free';

                  groupedByMaterial[materialKey].push({
                      id:       `${mod.name.substring(0,4)}_${part.name.substring(0,4)}`,
                      label:    `${part.name} (${mod.name})`,
                      width:    Math.round(part.width),
                      height:   Math.round(part.height),
                      quantity: part.quantity * (mod.quantity || 1),
                      grain,
                  });
              });
          });
      });

      const results: Record<string, Sheet[]> = {};
      const allUnplaceable: { material: string; id: string; label?: string; reason: string }[] = [];

      Object.keys(groupedByMaterial).forEach(material => {
          const n = material.toLowerCase();
          const isTrupan = n.includes('5.5') || n.includes('trupan') || n.includes('kiri');
          const input = {
              pieces:      groupedByMaterial[material],
              sheetWidth:  isTrupan ? 2600 : 2750,
              sheetHeight: 1830,
              kerf:        3,
          };
          const { sheets, unplaceable } = generateCutPlan(input);
          results[material] = sheets;
          unplaceable.forEach(u => allUnplaceable.push({ material, ...u }));
      });

      if (allUnplaceable.length > 0) {
          const msg = allUnplaceable.map(u => `• ${u.label || u.id} (${u.material}): ${u.reason}`).join('\n');
          alert(`Atención — Piezas que no pudieron ubicarse:\n\n${msg}`);
      }

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
          setActiveSettings({ ...estimate.settingsSnapshot, id: estimate.priceListId, name: estimate.priceListName });
          
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
      // Abrir directamente sin pasar por modal de edición — usar datos guardados tal cual
      const qd = estimate.quoteData;
      setItems((estimate.items || estimate.modules || []) as any);
      setSettings(estimate.settingsSnapshot);
      setActiveSettings({ ...estimate.settingsSnapshot, id: estimate.priceListId, name: (estimate as any).priceListName });
      setSelectedItemIds(new Set(((estimate.items || estimate.modules || []) as any[]).map((i: any) => i.id)));
      setQuoteItemTitle(qd?.title || 'Amoblamiento Integral');
      setQuoteReference(qd?.reference || estimate.customProjectName || getProjectTitleById(estimate.projectId || ''));
      setQuoteId(qd?.id || estimate.id.substring(0, 8).toUpperCase());
      setQuoteVersion(estimate.version);
      setQuoteObservations(qd?.observations || DEFAULT_OBSERVATIONS);
      setQuoteConditions(qd?.conditions || DEFAULT_CONDITIONS);
      if (qd?.enabledScenarios) setEnabledScenarios(qd.enabledScenarios as any);
      setEditingEstimate(estimate);
      setView('RESULTS');
      setPrintMode('ECONOMIC');
  };

  const handleDelete = (e: any, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('¿Eliminar este legajo y todas sus versiones? Esta acción no se puede deshacer.')) return;
      // Eliminar todas las versiones del grupo (mismo projectId o mismo id raíz)
      const toDelete = savedEstimates?.filter(est => {
          if (est.id === id) return true;
          // versiones del mismo legajo comparten projectId y customProjectName
          const target = savedEstimates.find(e => e.id === id);
          if (!target) return false;
          const sameProject = target.projectId && est.projectId === target.projectId;
          const sameName    = target.customProjectName && est.customProjectName === target.customProjectName;
          return sameProject || sameName;
      }) || [];
      if (toDelete.length > 1) {
          if (!confirm(`Este legajo tiene ${toDelete.length} versiones. ¿Eliminar todas?`)) return;
          toDelete.forEach(est => { if (onDeleteEstimate) onDeleteEstimate(est.id); });
      } else {
          if (onDeleteEstimate) onDeleteEstimate(id);
      }
  };

  const handleAddModule = (e: React.FormEvent) => {
      e.preventDefault();

      if (moduleKind === 'SPECIAL' && specialTemplateId) {
          const template = getTemplate(specialTemplateId);
          if (!template) return;
          const params: SpecialModuleParams = {
              width:  moduleForm.width  || 600,
              height: moduleForm.height || 720,
              depth:  moduleForm.depth  || 580,
          };
          const result = template.calculate(params, specialOptions);
          const newMod: ExtendedCabinetModule = {
              ...moduleForm,
              id:         `m${Date.now()}`,
              name:       moduleForm.name || template.name,
              moduleType: 'SPECIAL' as any,
              // Piezas reales — el engine las procesa igual que un módulo estándar
              extras:     [],  // sin extras de costo fijo
              isSpecialModule:    true,
              specialTemplateId,
              specialParts:       result.parts,   // piezas para despiece
              specialHardware:    result.hardware, // herrajes del template
              specialLaborDays:   result.laborDays,
          } as any;
          setPendingModules(prev => [...prev, newMod]);

      } else if (moduleKind === 'MANUAL') {
          if (!moduleForm.name) { alert('Ingresá un nombre para el módulo'); return; }
          const totalManual = manualItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const newMod: ExtendedCabinetModule = {
              ...moduleForm,
              id:         `m${Date.now()}`,
              moduleType: 'MANUAL' as any,
              extras:     manualItems.map(i => ({ ...i, id: i.id || `mi_${Date.now()}` })),
              isSpecialModule: true,
              specialTemplateId: SPECIAL_MANUAL_ID,
          } as any;
          setPendingModules(prev => [...prev, newMod]);
          setManualItems([]);

      } else {
          // Módulo estándar
          if (editingId) {
              setPendingModules(prev => prev.map(m => m.id === editingId ? { ...moduleForm, id: editingId } as ExtendedCabinetModule : m));
              setEditingId(null);
          } else {
              const newMod = { ...moduleForm, id: `m${Date.now()}` } as ExtendedCabinetModule;
              setPendingModules(prev => [...prev, newMod]);
          }
      }

      setModuleForm(INITIAL_MODULE_FORM);
      setModuleKind('STANDARD');
      setSpecialTemplateId('');
      setSpecialOptions({});
  };

  const handleInputChange = (field: keyof ExtendedCabinetModule, value: any) => {
      setModuleForm(prev => {
          const next = { ...prev, [field]: value };
          
          // Auto-forzar frontsCore = MDF cuando el acabado lo requiere
          const isLacquer = next.moduleType?.includes('LACQUER');
          const isVeneer  = next.moduleType?.includes('VENEER');
          if (isLacquer || isVeneer) {
              next.frontsCore = 'MDF';
          }
          setValidationWarning(null);
          
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
        const snapshot = editingEstimate.settingsSnapshot;
        
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
        if (!estimateToUpdate) return;

        const projectId = vinculandoProjectId || estimateToUpdate.projectId;

        // 1. Actualizar estimate — vincular al proyecto y pasar a En Producción
        onSaveEstimate({
            ...estimateToUpdate,
            projectId,
            commercialStatus: CommercialStatus.IN_PRODUCTION,
            auditLog: [...(estimateToUpdate.auditLog || []), {
                from: estimateToUpdate.commercialStatus || 'N/A',
                to: CommercialStatus.IN_PRODUCTION,
                timestamp: new Date().toISOString(),
                user: 'Usuario Actual'
            }]
        });

        // 2. Generar OP automáticamente y asociarla al proyecto
        if (onAddProductionOrder && projectId) {
            const projectTitle = getProjectTitleById(projectId);
            const allModules = (estimateToUpdate.items || []).flatMap((item: any) => item.modules || []);
            const newOrder: any = {
                order_number: `OP-${Date.now().toString().slice(-6)}`,
                project_id: projectId,
                start_date: new Date().toISOString().split('T')[0],
                delivery_date: '',
                status: ProductionOrderStatus.PENDING,
                items: allModules,
                assigned_operators: [],
                clientName: projectTitle,
                itemDescription: estimateToUpdate.quoteData?.title || estimateToUpdate.customProjectName || projectTitle,
                estimatedDeliveryDate: '',
                budgetId: estimateToUpdate.id,
                linkedProjectId: projectId,
            };
            onAddProductionOrder(newOrder);
        }

        alert(`Estimación vinculada al proyecto y Orden de Producción generada.`);
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
  const handleSavePriceList = async () => {
      if (!newListName.trim()) return;
      const newList = { id: crypto.randomUUID(), date: new Date().toISOString(), name: newListName, settings: { ...settings } };
      
      // Save to Supabase
      console.log("[handleSavePriceList] Attempting to save (simplified):", {
          id: newList.id,
          name: newList.name,
          created_at: newList.date
      });
      const { error } = await supabase.from('price_lists').insert({
          id: newList.id,
          name: newList.name,
          settings: newList.settings,
          created_at: newList.date
      });
      
      if (error) {
          console.error('Error saving price list:', error);
          alert('Error al guardar la lista de precios: ' + error.message);
          return;
      }
      console.log("[handleSavePriceList] Success!");
      
      setActiveSettings({ ...newList.settings, id: newList.id, name: newList.name });
      setPriceHistory([newList, ...priceHistory]);
      setNewListName('');
  };
  const handleLoadPriceList = (id: string) => {
      const h = priceHistory.find(x => x.id === id);
      if (h && confirm('¿Cargar lista?')) {
          setSettings({ ...h.settings });
          setActiveSettings({ ...h.settings, id: h.id, name: h.name });
      }
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
      // Usar lista activa directamente — ir directo a la planilla
      setIsCostSheetModalOpen(true);
  };

  const getRecalculatedItemPrices = (item: EstimatorItem, snapshot: CostSettings) => {
      // Guard: item puede venir de Supabase con estructura incompleta
      if (!item?.labor || !item?.margins || !item?.modules) {
          return { whiteAglo: 0, whiteMDF: 0, colorAglo: 0, colorMDF: 0, whiteLacqAglo: 0, whiteLacqMDF: 0, colorLacqAglo: 0, colorLacqMDF: 0, whiteVenrAglo: 0, whiteVenrMDF: 0, colorVenrAglo: 0, colorVenrMDF: 0, baseConfig: 0, totalDirectCost: 0 };
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
                   baseConfig: taller, totalDirectCost: directCost };
      }

      const S: any = snapshot;
      const laborCost  = (item.labor.workers || 1) * (item.labor.days || 1) * snapshot.costLaborDay;
      const margins    = item.margins;
      const fixedCosts = (S.priceScrews || 0) + (S.priceGlueTin || 0);
      // Extras del módulo: costo fijo independiente del escenario de material
      const extrasCost = (item.modules as any[]).flatMap((m: any) => m.extras || [])
          .reduce((a: number, e: any) => a + (e.unitPrice || 0) * (e.quantity || 0), 0);

      // ── Mismo lookup de precios que usa la planilla de costos ──
      const boardPrice = (name: string, count: number): number => {
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

      const hwPrice = (name: string, qty: number): number => {
          const n = name.toLowerCase();
          let unitPrice = 0;
          if      (n.includes('estándar') || n.includes('standard'))      unitPrice = S.priceHingeStandard || 0;
          else if (n.includes('cierre suave') && n.includes('bisag'))     unitPrice = S.priceHingeSoftClose || 0;
          else if (n.includes('push') && n.includes('bisag'))             unitPrice = S.priceHingePush || 0;
          else if (n.includes('pistón') || n.includes('piston'))          unitPrice = S.priceGasPiston || 0;
          else if (n.includes('guías') || n.includes('guia')) {
              const len = parseInt(name.match(/\((\d+)mm\)/)?.[1] || '300');
              const isS = n.includes('suave'); const isP = n.includes('push');
              if      (len <= 300) unitPrice = isS ? (S.priceSlide300Soft || 0) : isP ? (S.priceSlide300Push || 0) : (S.priceSlide300Std || 0);
              else if (len <= 400) unitPrice = isS ? (S.priceSlide400Soft || 0) : isP ? (S.priceSlide400Push || 0) : (S.priceSlide400Std || 0);
              else                 unitPrice = isS ? (S.priceSlide500Soft || 0) : isP ? (S.priceSlide500Push || 0) : (S.priceSlide500Std || 0);
          }
          return unitPrice * qty;
      };

      // ── Engine unificado: mismo pipeline que planilla de costos ──
      // calculateItemQuantities → precios por placa entera → margen
      const calc = (override: Partial<CabinetModule>) => {
          const q = calculateItemQuantities(item.modules, override);
          const mType    = (override.moduleType as string) || 'MELAMINE_FULL';
          const finArea  = mType.includes('LACQUER') ? q.lacquerAreaM2 : mType.includes('VENEER') ? q.veneerAreaM2 : 0;
          const finPrice = mType.includes('LACQUER') ? (S.priceFinishLacquerSemi || 0) : mType.includes('VENEER') ? (S.priceFinishLustreSemi || 0) : 0;
          const tPlacas  = Object.entries(q.detailedBoards).filter(([, v]) => (v as number) > 0).reduce((a, [n, c]) => a + boardPrice(n, c as number), 0);
          const tTapac   = (q.linearWhite22 * (S.priceEdge22White045 || 0)) + (q.linearWhite45 * (S.priceEdge45White045 || 0))
                         + (q.linearColor22 * (S.priceEdge22Color045 || 0)) + (q.linearColor45 * (S.priceEdge45Color045 || 0))
                         + (q.linear2mm * (S.priceEdge2mm || 0));
          const tHerrajes = Object.entries(q.detailedHardware).reduce((a, [n, qty]) => a + hwPrice(n, qty as number), 0) + extrasCost;
          const d = tPlacas + tTapac + tHerrajes + fixedCosts + finArea * finPrice + laborCost;
          const w = d * (1 + (margins.workshop ?? 35) / 100);
          return { d, finalPrice: w * (1 + (margins.roden ?? 0) / 100) };
      };

      const whiteAglo     = calc({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'AGLO' });
      const whiteMDF      = calc({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF'  });
      const colorAglo     = calc({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'AGLO' });
      const colorMDF      = calc({ moduleType: 'MELAMINE_FULL',          isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF'  });
      const whiteLacqAglo = calc({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
      const whiteLacqMDF  = calc({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
      const colorLacqAglo = calc({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
      const colorLacqMDF  = calc({ moduleType: 'MELAMINE_STRUCT_LACQUER', isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
      const whiteVenrAglo = calc({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: true,  isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
      const whiteVenrMDF  = calc({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: true,  isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });
      const colorVenrAglo = calc({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: false, isMDFCore: false, structureCore: 'AGLO', frontsCore: 'MDF' });
      const colorVenrMDF  = calc({ moduleType: 'MELAMINE_STRUCT_VENEER',  isWhiteStructure: false, isMDFCore: true,  structureCore: 'MDF',  frontsCore: 'MDF' });

      return {
          whiteAglo:     whiteAglo.finalPrice,
          whiteMDF:      whiteMDF.finalPrice,
          colorAglo:     colorAglo.finalPrice,
          colorMDF:      colorMDF.finalPrice,
          whiteLacqAglo: whiteLacqAglo.finalPrice,
          whiteLacqMDF:  whiteLacqMDF.finalPrice,
          colorLacqAglo: colorLacqAglo.finalPrice,
          colorLacqMDF:  colorLacqMDF.finalPrice,
          whiteVenrAglo: whiteVenrAglo.finalPrice,
          whiteVenrMDF:  whiteVenrMDF.finalPrice,
          colorVenrAglo: colorVenrAglo.finalPrice,
          colorVenrMDF:  colorVenrMDF.finalPrice,
          baseConfig:    colorAglo.finalPrice,
          totalDirectCost: colorAglo.d,
          // Aliases para compatibilidad con render del presupuesto
          lacquer: whiteLacqAglo.finalPrice,
          veneer:  whiteVenrAglo.finalPrice,
      };
  };

  if (printMode === 'SUPPLIES' || printMode === 'CUTTING' || printMode === 'COSTS' || printMode === 'COSTS_CUTS' || printMode === 'PRODUCTION_ORDER') {
      const itemsToPrint = technicalItems.length > 0 ? technicalItems : items.filter(i => selectedItemIds.has(i.id));
      const summary = calculateGlobalSummary(itemsToPrint);
      const cutList = (printMode === 'CUTTING' || printMode === 'COSTS' || printMode === 'COSTS_CUTS') ? getDecomposedCutList() : {};

      return (
        <div className="animate-fade-in min-h-screen bg-gray-100/50 print:bg-white flex flex-col items-center font-sans">
             <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    html, body, #root, .animate-fade-in, .min-h-screen { margin:0 !important; padding:0 !important; background:white !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                    .no-print { display: none !important; }
                    head, header[role="banner"] { display: none !important; }
                    /* Cada hoja A4 es un div autónomo */
                    .a4-page { width:210mm !important; height:297mm !important; overflow:hidden !important; break-after:page !important; page-break-after:always !important; display:flex !important; flex-direction:column !important; background:white !important; }
                    .a4-page:last-child { break-after:avoid !important; page-break-after:avoid !important; }
                    .a4-hdr { flex-shrink:0; height:16mm !important; }
                    .a4-ftr { flex-shrink:0; height:12mm !important; }
                    .a4-body { flex:1; overflow:hidden !important; padding:4mm 8mm !important; }
                }
                @media screen {
                    .a4-page { width:210mm; min-height:297mm; display:flex; flex-direction:column; background:white; box-shadow:0 4px 24px rgba(0,0,0,0.15); margin-bottom:28px; }
                    .a4-hdr { flex-shrink:0; }
                    .a4-ftr { flex-shrink:0; margin-top:auto; }
                    .a4-body { flex:1; padding:6mm 10mm; }
                }
            `}</style>
             <div className="no-print w-full max-w-[210mm] flex flex-col gap-4 mb-6 pt-6">
                <div className="flex justify-between items-center">
                    <button onClick={() => { setPrintMode('NONE'); setShowQuoteModal(false); }} className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200"><ArrowLeft size={16} /> Volver</button>
                    <div className="flex gap-2">
                        {printMode === 'COSTS' && !editingEstimate && onSaveEstimate && (
                            <button
                                onClick={() => { setPendingPrintType('COSTS'); setShowQuoteModal(true); }}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Archive size={16}/> Guardar en Historial
                            </button>
                        )}
                        {printMode === 'COSTS' && editingEstimate && (
                            <button
                                onClick={() => { handleArchive(editingEstimate.id); alert('Planilla archivada en historial.'); }}
                                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center gap-2"
                            >
                                <Archive size={16}/> Archivar
                            </button>
                        )}
                        <button
                        onClick={() => {
                            const isChrome = navigator.userAgent.includes('Chrome');
                            const isFirefox = navigator.userAgent.includes('Firefox');
                            let instrucciones = 'Para imprimir sin encabezado ni pie de página del navegador:\n\n';
                            if (isChrome) {
                                instrucciones += 'Chrome:\n→ En el diálogo de impresión, hacé clic en "Más opciones"\n→ Desactivá "Encabezados y pies de página"';
                            } else if (isFirefox) {
                                instrucciones += 'Firefox:\n→ En el diálogo de impresión, ir a "Página"\n→ Desactivá encabezado y pie de página en ambos desplegables';
                            } else {
                                instrucciones += '→ En el diálogo de impresión, buscá "Encabezados y pies de página" y desactivalo\n→ Escala: 100%';
                            }
                            instrucciones += '\n\nEsta configuración se guarda para futuras impresiones.';
                            alert(instrucciones);
                            window.print();
                        }}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
                    >
                        <Printer size={16} /> Imprimir Documento
                    </button>
                    </div>
                </div>
                
                {(printMode === 'COSTS' || printMode === 'COSTS_CUTS') && (
                    <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
                        <button
                            onClick={() => setPrintMode('COSTS')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${printMode === 'COSTS' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <FileText size={16}/> Planilla Resumen
                        </button>
                        <button
                            onClick={() => setPrintMode('COSTS_CUTS')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${printMode === 'COSTS_CUTS' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Grid size={16}/> Listado de Cortes
                        </button>
                    </div>
                )}
                {printMode !== 'COSTS' && printMode !== 'COSTS_CUTS' && (
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

            {/* ══ DOCUMENTO A4 — hojas autónomas con header/footer ══ */}
            <div className="flex flex-col items-center print:block">

                {/* Componente header A4 reutilizable */}
                {/* Componente footer A4 reutilizable */}

                {(() => {
                    const docTitle = printMode === 'COSTS' ? 'Planilla de Costos'
                                   : printMode === 'COSTS_CUTS' ? 'Listado de Cortes'
                                   : printMode === 'CUTTING' ? 'Listado de Corte'
                                   : printMode === 'PRODUCTION_ORDER' ? 'Orden de Producción'
                                   : 'Reporte Técnico';
                    const projName = getActiveProjectName();
                    const dateStr  = new Date().toLocaleDateString('es-AR');
                    const listName = (editingEstimate?.settingsSnapshot as any)?.name || activeSettings.name || 'Lista Actual';

                    const Hdr = ({ n, total }: { n: number, total: number }) => (
                        <div className="a4-hdr bg-black text-white flex items-center justify-between"
                             style={{ padding: '0 10mm' }}>
                            <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
                                <span style={{ fontSize:'22px', fontWeight:700, letterSpacing:'-0.5px', lineHeight:'1' }}>rødën</span>
                                <span style={{ fontSize:'16px', fontWeight:300, color:'#666' }}>|</span>
                                <span style={{ fontSize:'12px', fontWeight:500 }}>{docTitle}</span>
                            </div>
                            <div style={{ textAlign:'right' }}>
                                <div style={{ fontSize:'11px', fontWeight:700 }}>{projName}</div>
                                <div style={{ fontSize:'9px', color:'#aaa' }}>{dateStr} · {listName}</div>
                                <div style={{ fontSize:'9px', color:'#777' }}>Hoja {n} de {total}</div>
                            </div>
                        </div>
                    );

                    const Ftr = () => (
                        <div className="a4-ftr bg-gray-900 text-white flex items-center justify-between"
                             style={{ padding: '0 10mm', borderTop: '1px solid #333' }}>
                            <span style={{ fontSize:'9px', color:'#888', letterSpacing:'0.5px' }}>Devoto | Buenos Aires | Argentina</span>
                            <span style={{ fontSize:'11px', fontWeight:700 }}>www.rodenmobel.com</span>
                            <span style={{ fontSize:'9px', color:'#888' }}>rødën {new Date().getFullYear()}</span>
                        </div>
                    );

                    // ── CALCULAR TOTAL DE HOJAS ──
                    // Hoja 1: siempre (contenido principal)
                    // Hoja 2+: planilla de cortes (solo si printMode === 'COSTS')
                    const cutEntries = (printMode === 'COSTS' || printMode === 'COSTS_CUTS') ? Object.entries(cutList) : [];
                    const totalPages = printMode === 'COSTS' ? 2 : printMode === 'COSTS_CUTS' ? 1 : 1;

                    return (
                        <>
                            {printMode !== 'COSTS' && printMode !== 'COSTS_CUTS' && (
                            <>
                            <div className="a4-page">
                                <Hdr n={1} total={totalPages} />
                                <div className="a4-body">

                    <div className="border-b border-gray-300 pb-4 mb-6 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold uppercase mb-0.5">{getActiveProjectName()}</h2>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">
                                {printMode === 'SUPPLIES' ? 'Reporte Técnico de Materiales' : 
                                 printMode === 'CUTTING' ? 'Listado de Corte' : 
                                 printMode === 'PRODUCTION_ORDER' ? 'Orden de Producción' :
                                 'Planilla de Costos de Producción'}
                            </p>
                        </div>
                        {printMode === 'COSTS' && (
                            <div className="text-right">
                                <span className="text-[10px] font-bold uppercase text-gray-400 block">Lista de precios</span>
                                <span className="text-sm font-bold text-gray-700">{activeSettings.name || 'Lista Actual'}</span>
                            </div>
                        )}
                        {printMode === 'PRODUCTION_ORDER' && (
                            <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                                <div><strong>Orden N°:</strong> {productionOrderInfo.orderNumber}</div>
                                <div><strong>Inicio:</strong>
                                    <input type="date" className="ml-1 border rounded px-1 py-0.5 text-xs no-print" value={productionOrderInfo.startDate} onChange={e => setProductionOrderInfo({...productionOrderInfo, startDate: e.target.value})}/>
                                    <span className="hidden print:inline ml-1">{productionOrderInfo.startDate ? new Date(productionOrderInfo.startDate).toLocaleDateString() : '—'}</span>
                                </div>
                                <div><strong>Entrega:</strong>
                                    <input type="date" className="ml-1 border rounded px-1 py-0.5 text-xs no-print" value={productionOrderInfo.deliveryDate} onChange={e => setProductionOrderInfo({...productionOrderInfo, deliveryDate: e.target.value})}/>
                                    <span className="hidden print:inline ml-1">{productionOrderInfo.deliveryDate ? new Date(productionOrderInfo.deliveryDate).toLocaleDateString() : '—'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {printMode === 'PRODUCTION_ORDER' && (
                        <div className="space-y-0">

                            {/* ── SECCIÓN 1: Ítems y configuración ── */}
                            <div className="border-b border-gray-200 px-0 py-4">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">1 — Ítems y configuración</p>
                                <div className="space-y-2">
                                    {itemsToPrint.map((item, idx) => {
                                        const isManualItem = (item as any).isManualItem ||
                                            item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);

                                        if (isManualItem) {
                                            return (
                                                <div key={item.id} className="bg-gray-50 rounded px-3 py-2 text-[10px]">
                                                    <div className="font-bold text-sm text-gray-900">{idx + 1}. {item.name}</div>
                                                </div>
                                            );
                                        }

                                        const q = calculateItemQuantities(item.modules);
                                        const hasLacquer = q.lacquerAreaM2 > 0;
                                        const hasVeneer  = q.veneerAreaM2  > 0;
                                        const structDesc = item.modules[0]?.isWhiteStructure ? 'Mel. Blanca' : 'Mel. Color';
                                        const coreDesc   = item.modules[0]?.structureCore === 'MDF' ? 'MDF' : 'Aglo';
                                        const frontDesc  = hasLacquer ? 'Frentes Laca Semi Mate'
                                                         : hasVeneer  ? 'Frentes Enchapado Kiri'
                                                         : (item.modules[0]?.materialFrontName || 'Melamina');
                                        const slideDesc  = SLIDE_LABELS[item.modules[0]?.slideType as keyof typeof SLIDE_LABELS] || 'Telescópicas estándar';
                                        return (
                                            <div key={item.id} className="bg-gray-50 rounded px-3 py-2 grid grid-cols-4 gap-3 text-[10px]">
                                                <div className="font-bold text-sm text-gray-900 col-span-1">{idx + 1}. {item.name}</div>
                                                <div className="text-gray-600"><span className="text-gray-400 block text-[9px] uppercase">Estructura</span>{structDesc} {coreDesc}</div>
                                                <div className="text-gray-600"><span className="text-gray-400 block text-[9px] uppercase">Terminación</span>{frontDesc}</div>
                                                <div className="text-gray-600"><span className="text-gray-400 block text-[9px] uppercase">MO estimada</span>{item.labor?.workers || 1} op. · {item.labor?.days || 1} días</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── SECCIÓN 2: Placas + Herrajes (en columnas) — solo si hay ítems no manuales ── */}
                            {itemsToPrint.some(item => !((item as any).isManualItem || item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID))) && (
                            <div className="border-b border-gray-200 py-4 grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">2 — Placas y tableros</p>
                                    <table className="w-full text-[10px]">
                                        <tbody>
                                            {Object.entries(summary.globalBoards).map(([name, count]) => (
                                                <tr key={name} className="border-b border-gray-100">
                                                    <td className="py-1 text-gray-800">{name}</td>
                                                    <td className="py-1 text-right font-bold">{count} ud.</td>
                                                </tr>
                                            ))}
                                            {/* Terminaciones especiales */}
                                            {itemsToPrint.some(item => calculateItemQuantities(item.modules).lacquerAreaM2 > 0) && (
                                                <tr className="border-b border-gray-100 bg-amber-50">
                                                    <td className="py-1 text-amber-800">Aplicación laca semi mate</td>
                                                    <td className="py-1 text-right font-bold text-amber-800">
                                                        {itemsToPrint.reduce((acc, item) => acc + calculateItemQuantities(item.modules).lacquerAreaM2, 0).toFixed(1)} m²
                                                    </td>
                                                </tr>
                                            )}
                                            {itemsToPrint.some(item => calculateItemQuantities(item.modules).veneerAreaM2 > 0) && (
                                                <tr className="border-b border-gray-100 bg-amber-50">
                                                    <td className="py-1 text-amber-800">Aplicación enchapado</td>
                                                    <td className="py-1 text-right font-bold text-amber-800">
                                                        {itemsToPrint.reduce((acc, item) => acc + calculateItemQuantities(item.modules).veneerAreaM2, 0).toFixed(1)} m²
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">3 — Herrajes y accesorios</p>
                                    <table className="w-full text-[10px]">
                                        <tbody>
                                            {Object.entries(summary.globalHardware).map(([name, count]) => (
                                                <tr key={name} className="border-b border-gray-100">
                                                    <td className="py-1 text-gray-800">{name}</td>
                                                    <td className="py-1 text-right font-bold">{count}</td>
                                                </tr>
                                            ))}
                                            {/* Tapacantos */}
                                            {(() => {
                                                const totQ = calculateItemQuantities(itemsToPrint.flatMap(i => i.modules));
                                                return (<>
                                                    {totQ.linearColor45 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-800">Tapacanto Color 29mm</td><td className="py-1 text-right font-bold">{totQ.linearColor45} m</td></tr>}
                                                    {totQ.linearWhite45 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-800">Tapacanto Blanco 29mm</td><td className="py-1 text-right font-bold">{totQ.linearWhite45} m</td></tr>}
                                                    {totQ.linearColor22 > 0 && <tr className="border-b border-gray-100"><td className="py-1 text-gray-800">Tapacanto Color 22mm</td><td className="py-1 text-right font-bold">{totQ.linearColor22} m</td></tr>}
                                                    {totQ.linear2mm > 0    && <tr className="border-b border-gray-100"><td className="py-1 text-gray-800">Tapacanto PVC 2mm</td><td className="py-1 text-right font-bold">{totQ.linear2mm} m</td></tr>}
                                                </>);
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            )}

                            {/* ── SECCIÓN: Ítems Especiales Manuales ── */}
                            {(() => {
                                const manualMods = itemsToPrint.flatMap(item =>
                                    item.modules?.filter((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID) || []
                                );
                                if (manualMods.length === 0) return null;
                                const allExtras = manualMods.flatMap((m: any) => m.extras || []);
                                if (allExtras.length === 0) return null;
                                return (
                                <div className="py-4">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Ítems Especiales</p>
                                    <table className="w-full text-[9px] border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-300">
                                                <th className="py-0.5 text-left font-medium text-gray-500">Descripción</th>
                                                <th className="py-0.5 text-center font-medium text-gray-500 w-12">Cant.</th>
                                                <th className="py-0.5 text-center font-medium text-gray-500 w-10">Un.</th>
                                                <th className="py-0.5 text-right font-medium text-gray-500 w-20">P. Unit.</th>
                                                <th className="py-0.5 text-right font-medium text-gray-500 w-20">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allExtras.map((ex: any, i: number) => (
                                                <tr key={i} className="border-b border-gray-100">
                                                    <td className="py-1 text-gray-800">{ex.description}</td>
                                                    <td className="py-1 text-center">{ex.quantity}</td>
                                                    <td className="py-1 text-center text-gray-500">{ex.unit}</td>
                                                    <td className="py-1 text-right">{formatCurrency(ex.unitPrice)}</td>
                                                    <td className="py-1 text-right font-bold">{formatCurrency(ex.unitPrice * ex.quantity)}</td>
                                                </tr>
                                            ))}
                                            <tr className="border-t border-gray-300 bg-gray-50">
                                                <td className="py-1 font-bold text-gray-800" colSpan={4}>Total Ítems Especiales</td>
                                                <td className="py-1 text-right font-bold">{formatCurrency(allExtras.reduce((s: number, ex: any) => s + ex.unitPrice * ex.quantity, 0))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                );
                            })()}

                            {/* ── SECCIÓN 3: Planilla de cortes — solo si hay ítems no manuales ── */}
                            {itemsToPrint.some(item => !((item as any).isManualItem || item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID))) && (
                            <div className="py-4">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">4 — Planilla de cortes</p>
                                {Object.entries(cutList).map(([material, thicknesses]) => (
                                    <div key={material} className="mb-4">
                                        <p className="text-[9px] font-bold uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded mb-1">{material}</p>
                                        {Object.entries(thicknesses).map(([thick, pieces]) => (
                                            <table key={thick} className="w-full text-[9px] border-collapse mb-2">
                                                <thead>
                                                    <tr className="border-b border-gray-300">
                                                        <th className="py-0.5 text-left font-medium text-gray-500">Pieza</th>
                                                        <th className="py-0.5 text-center font-medium text-gray-500">Cant.</th>
                                                        <th className="py-0.5 text-center font-medium text-gray-500">Ancho</th>
                                                        <th className="py-0.5 text-center font-medium text-gray-500">Largo</th>
                                                        <th className="py-0.5 text-center font-medium text-gray-500">Veta</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(pieces as any[]).map((p, pidx) => (
                                                        <tr key={pidx} className="border-b border-gray-100">
                                                            <td className="py-0.5 text-gray-800">{p.moduleRef.substring(0, 20)}</td>
                                                            <td className="py-0.5 text-center font-bold">{p.quantity}</td>
                                                            <td className="py-0.5 text-center">{p.width}</td>
                                                            <td className="py-0.5 text-center">{p.height}</td>
                                                            <td className="py-0.5 text-center font-bold">{p.grain === 'horizontal' ? 'H' : p.grain === 'vertical' ? 'V' : '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            )}

                            {/* ── OBSERVACIONES ── */}
                            <div className="border-t-2 border-black pt-4 flex justify-between items-end text-[10px] mt-4">
                                <div className="flex-1 mr-8">
                                    <p className="font-bold uppercase mb-1 text-gray-700">Observaciones</p>
                                    <textarea
                                        className="w-full border rounded p-1 text-[10px] resize-none no-print"
                                        rows={2}
                                        placeholder="Notas para el taller..."
                                        value={technicalObservations}
                                        onChange={e => setTechnicalObservations(e.target.value)}
                                    />
                                    <p className="hidden print:block italic text-gray-500">{technicalObservations || 'Sin observaciones.'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-bold text-gray-800">{productionOrderInfo.orderNumber}</p>
                                    <p className="text-gray-400">rødën taller · {new Date().toLocaleDateString('es-AR')}</p>
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


                                </div>{/* fin a4-body hoja 1 */}
                                <Ftr />
                            </div>{/* fin a4-page hoja 1 */}
                            </>
                            )}

                    {printMode === 'COSTS' && itemsToPrint.map((item, itemIndex) => {

                        const S = (editingEstimate?.settingsSnapshot || activeSettings) as typeof activeSettings;
                        const costSnapshot: CostSnapshot = { ...S, currency: 'ARS', timestamp: '' } as CostSnapshot;
                        const q = calculateItemQuantities(item.modules);
                        const margins = item.margins || { workshop: 35, roden: 0 };
                        const laborCost = (item.labor?.workers || 1) * (item.labor?.days || 1) * S.costLaborDay;
                        const fixedCosts = S.priceScrews + S.priceGlueTin;

                        // ── Ítem manual: planilla simplificada (solo MO + beneficios, sin materiales ni terminaciones) ──
                        const isManualItem = (item as any).isManualItem ||
                            item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);

                        if (isManualItem) {
                            const totalExtras = item.modules.reduce((sum: number, m: any) =>
                                sum + (m.extras || []).reduce((s: number, ex: any) => s + ex.unitPrice * ex.quantity, 0), 0);
                            const costoDirecto = totalExtras + laborCost;
                            const wm = 1 + (margins.workshop / 100);
                            const wr = 1 + ((margins.roden ?? 0) / 100);
                            const precioTaller = costoDirecto * wm;
                            const precioFinal  = precioTaller * wr;
                            return (
                                <React.Fragment key={item.id}>
                                    <div className="a4-page" style={{ fontSize:'12px' }}>
                                        <Hdr n={itemIndex + 1} total={itemsToPrint.length} />
                                        <div className="a4-body" style={{ padding:'4mm 9mm 0 9mm' }}>
                                            {/* TÍTULO */}
                                            <div style={{ background:'#111', color:'#fff', padding:'2.5mm 4mm', marginBottom:'4mm', borderRadius:'2px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                <span style={{ fontWeight:700, fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{item.name}</span>
                                                <span style={{ fontSize:'9px', color:'#bbb' }}>Ítem Manual · {item.labor?.workers||1} op. × {item.labor?.days||1} días</span>
                                            </div>

                                            {/* MATERIALES — ítems del módulo manual */}
                                            {totalExtras > 0 && (
                                                <>
                                                    <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Materiales y trabajos</p>
                                                    <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'4mm' }}>
                                                        <tbody>
                                                            {item.modules?.flatMap((m: any) => m.extras || []).map((ex: any, i: number) => (
                                                                <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                                    <td style={{ padding:'2px 0', color:'#374151' }}>{ex.description}</td>
                                                                    <td style={{ padding:'2px 0', textAlign:'right', color:'#9ca3af', width:'40px' }}>{ex.quantity} {ex.unit}</td>
                                                                    <td style={{ padding:'2px 0', textAlign:'right', fontWeight:500, width:'80px' }}>{formatCurrency(ex.unitPrice * ex.quantity)}</td>
                                                                </tr>
                                                            ))}
                                                            <tr style={{ borderTop:'1px solid #d1d5db', background:'#f9fafb' }}>
                                                                <td style={{ padding:'2px 0', fontWeight:700, color:'#111' }} colSpan={2}>Subtotal materiales</td>
                                                                <td style={{ padding:'2px 0', textAlign:'right', fontWeight:700, width:'80px' }}>{formatCurrency(totalExtras)}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </>
                                            )}

                                            {/* MANO DE OBRA */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Mano de obra</p>
                                            <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'4mm' }}>
                                                <tbody>
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'2px 0', color:'#374151' }}>{item.labor?.workers||1} op. × {item.labor?.days||1} días × {formatCurrency(S.costLaborDay)}/día</td>
                                                        <td style={{ padding:'2px 0', textAlign:'right', fontWeight:600, width:'80px' }}>{formatCurrency(laborCost)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            {/* RESUMEN */}
                                            <div style={{ background:'#111', color:'#fff', borderRadius:'2px', padding:'3mm 4mm', maxWidth:'240px', marginLeft:'auto' }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Materiales</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(totalExtras)}</span>
                                                </div>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Mano de obra</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(laborCost)}</span>
                                                </div>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px', borderTop:'1px solid #333', paddingTop:'2px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Costo directo</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(costoDirecto)}</span>
                                                </div>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Beneficio taller ({margins.workshop}%)</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(precioTaller - costoDirecto)}</span>
                                                </div>
                                                {(margins.roden ?? 0) > 0 && (
                                                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                                                        <span style={{ fontSize:'9px', color:'#aaa' }}>Beneficio Roden ({margins.roden}%)</span>
                                                        <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(precioFinal - precioTaller)}</span>
                                                    </div>
                                                )}
                                                <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #444', paddingTop:'2px', marginTop:'2px' }}>
                                                    <span style={{ fontSize:'12px', fontWeight:700 }}>PRECIO FINAL</span>
                                                    <span style={{ fontSize:'14px', fontWeight:700 }}>{formatCurrency(precioFinal)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Ftr />
                                    </div>
                                </React.Fragment>
                            );
                        }

                        // ── Configuración real del ítem (primer módulo como referencia) ──
                        const m0 = item.modules[0] || {} as any;
                        const realMT   = m0.moduleType || 'MELAMINE_FULL';
                        const realWhite = !!m0.isWhiteStructure;
                        const realMDF   = (m0.structureCore || 'AGLO') === 'MDF';

                        const descRealConfig = (() => {
                            const core  = realMDF ? 'MDF' : 'MDP';
                            const color = realWhite ? 'Blanca' : 'Color';
                            if (realMT === 'LACQUER_FULL')           return `Todo Laqueado`;
                            if (realMT === 'VENEER_FULL')            return `Todo Enchapado Kiri`;
                            if (realMT === 'MELAMINE_STRUCT_LACQUER') return `Mel. ${color} ${core} + Frentes Laqueados`;
                            if (realMT === 'MELAMINE_STRUCT_VENEER')  return `Mel. ${color} ${core} + Frentes Enchapados`;
                            return `Melamina ${color} ${core}`;
                        })();

                        // ── Terminación del ítem real ──
                        const hasLacquer = q.lacquerAreaM2 > 0;
                        const hasVeneer  = q.veneerAreaM2  > 0;
                        const finishAreaM2  = hasLacquer ? q.lacquerAreaM2 : hasVeneer ? q.veneerAreaM2 : 0;
                        const finishPriceM2 = hasLacquer ? (S.priceFinishLacquerSemi || 0) : hasVeneer ? (S.priceFinishLustreSemi || 0) : 0;
                        const finishLabel   = hasLacquer
                            ? (realMT === 'LACQUER_FULL' ? 'Laca Semi Mate — todo el mueble' : 'Laca Semi Mate — frentes')
                            : hasVeneer
                            ? (realMT === 'VENEER_FULL'  ? 'Enchapado Kiri — todo el mueble' : 'Enchapado Kiri — frentes')
                            : null;

                        // ── Precio de herrajes: lookup según nombre ──
                        const hwPrice = (name: string, qty: number): number => {
                            const n = name.toLowerCase();
                            let unitPrice = 0;
                            if      (n.includes('estándar') || n.includes('standard'))      unitPrice = S.priceHingeStandard;
                            else if (n.includes('cierre suave') && n.includes('bisag'))     unitPrice = S.priceHingeSoftClose;
                            else if (n.includes('push') && n.includes('bisag'))             unitPrice = S.priceHingePush;
                            else if (n.includes('pistón') || n.includes('piston'))          unitPrice = S.priceGasPiston;
                            else if (n.includes('guías') || n.includes('guia')) {
                                const len = parseInt(name.match(/\((\d+)mm\)/)?.[1] || '300');
                                const isS = n.includes('suave'); const isP = n.includes('push');
                                if      (len <= 300) unitPrice = isS ? S.priceSlide300Soft : isP ? S.priceSlide300Push : S.priceSlide300Std;
                                else if (len <= 400) unitPrice = isS ? S.priceSlide400Soft : isP ? S.priceSlide400Push : S.priceSlide400Std;
                                else                 unitPrice = isS ? S.priceSlide500Soft : isP ? S.priceSlide500Push : S.priceSlide500Std;
                            }
                            return unitPrice * qty;
                        };

                        // ── Precio de placas por nombre ──
                        const boardPrice = (name: string, count: number): number => {
                            const n = name.toLowerCase();
                            let p = S.priceBoard18WhiteAglo;
                            if      (n.includes('trupan') || n.includes('5.5'))            p = S.priceBacking55Color;
                            else if (n.includes('fondo') && n.includes('3'))               p = S.priceBacking3White;
                            else if (n.includes('15mm'))                                    p = S.priceBoard15WhiteAglo;
                            else if (n.includes('laquear') || n.includes('crudo'))         p = S.priceBoard18MDFCrudo1Face;
                            else if (n.includes('kiri') || n.includes('veneer'))           p = S.priceBoard18VeneerMDF;
                            else if (n.includes('color') && n.includes('mdf'))             p = S.priceBoard18ColorMDF;
                            else if (n.includes('color'))                                  p = S.priceBoard18ColorAglo;
                            else if (n.includes('blanca') && n.includes('mdf'))            p = S.priceBoard18WhiteMDF;
                            return p * count;
                        };

                        // ── Subtotales de la configuración real ──
                        const totalPlacas   = Object.entries(q.detailedBoards).filter(([,v])=>v>0).reduce((a,[n,c])=>a+boardPrice(n,c),0);
                        const totalTapac    = (q.linearWhite22*S.priceEdge22White045)+(q.linearWhite45*S.priceEdge45White045)+(q.linearColor22*S.priceEdge22Color045)+(q.linearColor45*S.priceEdge45Color045)+(q.linear2mm*S.priceEdge2mm);
                        const totalHerrajes = Object.entries(q.detailedHardware).reduce((a,[n,qty])=>a+hwPrice(n,qty),0) + (item.modules?.flatMap((m:any)=>m.extras||[]).reduce((a:number,e:any)=>a+e.unitPrice*e.quantity,0));
                        const totalFijos    = fixedCosts;
                        const totalFinish   = finishAreaM2 * finishPriceM2;
                        const totalMaterials = totalPlacas + totalTapac + totalHerrajes + totalFijos + totalFinish;
                        const totalDirectCost = totalMaterials + laborCost;
                        const totalWorkshop   = totalDirectCost * (1 + (margins.workshop ?? 35) / 100);

                        // ── 14 terminaciones — mismo engine que la planilla (placas enteras) ──
                        const calc = (override: any) => {
                            if (!item?.modules?.length) return { d: 0, w: 0 };
                            const qOver = calculateItemQuantities(item.modules, override);

                            // Calcular acabado según override
                            const mType = override.moduleType || realMT;
                            const finArea = mType.includes('LACQUER') ? qOver.lacquerAreaM2
                                          : mType.includes('VENEER')  ? qOver.veneerAreaM2 : 0;
                            const finPrice = mType.includes('LACQUER') ? (S.priceFinishLacquerSemi || 0)
                                           : mType.includes('VENEER')  ? (S.priceFinishLustreSemi || 0) : 0;
                            const tPlacas  = Object.entries(qOver.detailedBoards).filter(([,v])=>v>0).reduce((a,[n,c])=>a+boardPrice(n,c as number),0);
                            const tTapac   = (qOver.linearWhite22*S.priceEdge22White045)+(qOver.linearWhite45*S.priceEdge45White045)+(qOver.linearColor22*S.priceEdge22Color045)+(qOver.linearColor45*S.priceEdge45Color045)+(qOver.linear2mm*S.priceEdge2mm);
                            const tHerrajes= Object.entries(qOver.detailedHardware).reduce((a,[n,qty])=>a+hwPrice(n,qty as number),0);
                            const tFinish  = finArea * finPrice;
                            const d = tPlacas + tTapac + tHerrajes + fixedCosts + tFinish + laborCost;
                            return { d, w: d * (1 + (margins.workshop ?? 35) / 100) };
                        };
                                        const terminaciones = [
                                            { k:'wa',  label:'Melamina Blanca MDP',           isReal: realMT==='MELAMINE_FULL' && realWhite && !realMDF,  r: calc({ moduleType:'MELAMINE_FULL',          isWhiteStructure:true,  isMDFCore:false, structureCore:'AGLO', frontsCore:'AGLO' }) },
                                            { k:'wm',  label:'Melamina Blanca MDF',           isReal: realMT==='MELAMINE_FULL' && realWhite && realMDF,   r: calc({ moduleType:'MELAMINE_FULL',          isWhiteStructure:true,  isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF'  }) },
                                            { k:'ca',  label:'Melamina Color MDP',            isReal: realMT==='MELAMINE_FULL' && !realWhite && !realMDF, r: calc({ moduleType:'MELAMINE_FULL',          isWhiteStructure:false, isMDFCore:false, structureCore:'AGLO', frontsCore:'AGLO' }) },
                                            { k:'cm',  label:'Melamina Color MDF',            isReal: realMT==='MELAMINE_FULL' && !realWhite && realMDF,  r: calc({ moduleType:'MELAMINE_FULL',          isWhiteStructure:false, isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF'  }) },
                                            { k:'wla', label:'Bl. MDP + Frentes Laqueados',   isReal: realMT==='MELAMINE_STRUCT_LACQUER' && realWhite && !realMDF, r: calc({ moduleType:'MELAMINE_STRUCT_LACQUER', isWhiteStructure:true,  isMDFCore:false, structureCore:'AGLO', frontsCore:'MDF' }) },
                                            { k:'wlm', label:'Bl. MDF + Frentes Laqueados',   isReal: realMT==='MELAMINE_STRUCT_LACQUER' && realWhite && realMDF,  r: calc({ moduleType:'MELAMINE_STRUCT_LACQUER', isWhiteStructure:true,  isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                            { k:'cla', label:'Col. MDP + Frentes Laqueados',  isReal: realMT==='MELAMINE_STRUCT_LACQUER' && !realWhite && !realMDF, r: calc({ moduleType:'MELAMINE_STRUCT_LACQUER', isWhiteStructure:false, isMDFCore:false, structureCore:'AGLO', frontsCore:'MDF' }) },
                                            { k:'clm', label:'Col. MDF + Frentes Laqueados',  isReal: realMT==='MELAMINE_STRUCT_LACQUER' && !realWhite && realMDF,  r: calc({ moduleType:'MELAMINE_STRUCT_LACQUER', isWhiteStructure:false, isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                            { k:'wva', label:'Bl. MDP + Frentes Enchapados',  isReal: realMT==='MELAMINE_STRUCT_VENEER'  && realWhite && !realMDF, r: calc({ moduleType:'MELAMINE_STRUCT_VENEER',  isWhiteStructure:true,  isMDFCore:false, structureCore:'AGLO', frontsCore:'MDF' }) },
                                            { k:'wvm', label:'Bl. MDF + Frentes Enchapados',  isReal: realMT==='MELAMINE_STRUCT_VENEER'  && realWhite && realMDF,  r: calc({ moduleType:'MELAMINE_STRUCT_VENEER',  isWhiteStructure:true,  isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                            { k:'cva', label:'Col. MDP + Frentes Enchapados', isReal: realMT==='MELAMINE_STRUCT_VENEER'  && !realWhite && !realMDF, r: calc({ moduleType:'MELAMINE_STRUCT_VENEER',  isWhiteStructure:false, isMDFCore:false, structureCore:'AGLO', frontsCore:'MDF' }) },
                                            { k:'cvm', label:'Col. MDF + Frentes Enchapados', isReal: realMT==='MELAMINE_STRUCT_VENEER'  && !realWhite && realMDF,  r: calc({ moduleType:'MELAMINE_STRUCT_VENEER',  isWhiteStructure:false, isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                            { k:'lf',  label:'Todo Laqueado',                  isReal: realMT==='LACQUER_FULL',  r: calc({ moduleType:'LACQUER_FULL',  isWhiteStructure:false, isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                            { k:'vf',  label:'Todo Enchapado Kiri',            isReal: realMT==='VENEER_FULL',   r: calc({ moduleType:'VENEER_FULL',   isWhiteStructure:false, isMDFCore:true,  structureCore:'MDF',  frontsCore:'MDF' }) },
                                        ];
                        const realTerm = terminaciones.find(t => t.isReal);

                        // Planilla de cortes de este ítem
                        const itemCutList = (() => {
                            const grouped: Record<string, Record<string, any[]>> = {};
                            item.modules.forEach((mod: any) => {
                                const parts = calculateModuleParts(mod);
                                const qty = mod.quantity || 1;
                                parts.forEach((part: any) => {
                                    const n = part.material?.toLowerCase() || '';
                                    let matLabel = 'Otros';
                                    let espesor = '18mm';
                                    if      (n.includes('5.5mm'))  { matLabel = 'Fondo Trupan 5.5mm Color';    espesor = '5.5mm'; }
                                    else if (n.includes('3mm'))    { matLabel = 'Fondo MDF 3mm Blanco';         espesor = '3mm';   }
                                    else if (n.includes('15mm'))   { matLabel = 'Mel. Blanca 15mm MDP (Cajón)'; espesor = '15mm';  }
                                    else if (n.includes('color') && n.includes('mdf'))  matLabel = 'Mel. Color 18mm MDF';
                                    else if (n.includes('color'))                        matLabel = 'Mel. Color 18mm MDP';
                                    else if (n.includes('white') || n.includes('blanca')) {
                                        matLabel = realMDF ? 'Mel. Blanca 18mm MDF' : 'Mel. Blanca 18mm MDP';
                                    }
                                    else if (n.includes('crudo') || n.includes('laqu')) matLabel = 'MDF Crudo 18mm 1 Cara (Frentes Laca)';
                                    else if (n.includes('kiri')  || n.includes('vene')) matLabel = 'MDF Enchapado Kiri 18mm';
                                    if (!grouped[matLabel]) grouped[matLabel] = {};
                                    if (!grouped[matLabel][espesor]) grouped[matLabel][espesor] = [];
                                    const w = Math.floor(part.width || 0);
                                    const h = Math.floor(part.height || 0);
                                    grouped[matLabel][espesor].push({
                                        pieza:    part.name,
                                        destino:  mod.name,
                                        mayor:    Math.max(w, h),
                                        menor:    Math.min(w, h),
                                        cantidad: part.quantity * qty,
                                        veta:     part.grain === 'horizontal' ? 'H' : part.grain === 'vertical' ? 'V' : '—',
                                    });
                                });
                            });
                            return grouped;
                        })();

                        const totalItemPages = 2; // 1 costos + 1 cortes
                        const pageBase = itemIndex * totalItemPages;

                        return (
                            <React.Fragment key={item.id}>

                            {/* ════════════════════════════════════
                                HOJA A: PLANILLA DE COSTOS DEL ÍTEM
                            ════════════════════════════════════ */}
                            <div className="a4-page" style={{ fontSize:'12px' }}>
                                <Hdr n={pageBase+1} total={itemsToPrint.length * totalItemPages} />
                                <div className="a4-body" style={{ padding:'4mm 9mm 0 9mm' }}>

                                    {/* ── TÍTULO DEL ÍTEM ── */}
                                    <div style={{ background:'#111', color:'#fff', padding:'2.5mm 4mm', marginBottom:'3mm', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'2px' }}>
                                        <span style={{ fontWeight:700, fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{item.name}</span>
                                        <span style={{ fontSize:'9px', color:'#bbb' }}>
                                            Config: {descRealConfig} · {item.modules.length} mód. · {item.labor?.workers||1} op. × {item.labor?.days||1} días
                                        </span>
                                    </div>

                                    {/* ── CUERPO: 2 COLUMNAS ── */}
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4mm', marginBottom:'3mm' }}>

                                        {/* COLUMNA IZQ: Placas + Tapacantos + Herrajes */}
                                        <div>
                                            {/* PLACAS */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Placas y tableros</p>
                                            <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'3mm' }}>
                                                <tbody>
                                                    {Object.entries(q.detailedBoards).filter(([,v])=>(v as number)>0).map(([name, count]) => {
                                                        const bp = boardPrice(name, count as number);
                                                        return (
                                                            <tr key={name} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                                <td style={{ padding:'1.5px 0', color:'#374151', lineHeight:'1.3' }}>{name}</td>
                                                                <td style={{ padding:'1.5px 0', textAlign:'right', color:'#9ca3af', width:'32px', whiteSpace:'nowrap' }}>{count as number} ud</td>
                                                                <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:500, width:'72px', whiteSpace:'nowrap' }}>{formatCurrency(bp)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Tapacantos */}
                                                    {q.linearWhite22>0 && <tr style={{borderBottom:'1px solid #f3f4f6'}}><td style={{padding:'1.5px 0',color:'#374151'}}>Tapacanto Blanco 22mm ABS 0.45</td><td style={{padding:'1.5px 0',textAlign:'right',color:'#9ca3af',width:'32px'}}>{q.linearWhite22}m</td><td style={{padding:'1.5px 0',textAlign:'right',fontWeight:500,width:'72px'}}>{formatCurrency(q.linearWhite22*S.priceEdge22White045)}</td></tr>}
                                                    {q.linearWhite45>0 && <tr style={{borderBottom:'1px solid #f3f4f6'}}><td style={{padding:'1.5px 0',color:'#374151'}}>Tapacanto Blanco 29mm ABS 0.45</td><td style={{padding:'1.5px 0',textAlign:'right',color:'#9ca3af',width:'32px'}}>{q.linearWhite45}m</td><td style={{padding:'1.5px 0',textAlign:'right',fontWeight:500,width:'72px'}}>{formatCurrency(q.linearWhite45*S.priceEdge45White045)}</td></tr>}
                                                    {q.linearColor22>0 && <tr style={{borderBottom:'1px solid #f3f4f6'}}><td style={{padding:'1.5px 0',color:'#374151'}}>Tapacanto Color 22mm ABS 0.45</td><td style={{padding:'1.5px 0',textAlign:'right',color:'#9ca3af',width:'32px'}}>{q.linearColor22}m</td><td style={{padding:'1.5px 0',textAlign:'right',fontWeight:500,width:'72px'}}>{formatCurrency(q.linearColor22*S.priceEdge22Color045)}</td></tr>}
                                                    {q.linearColor45>0 && <tr style={{borderBottom:'1px solid #f3f4f6'}}><td style={{padding:'1.5px 0',color:'#374151'}}>Tapacanto Color 29mm ABS 0.45</td><td style={{padding:'1.5px 0',textAlign:'right',color:'#9ca3af',width:'32px'}}>{q.linearColor45}m</td><td style={{padding:'1.5px 0',textAlign:'right',fontWeight:500,width:'72px'}}>{formatCurrency(q.linearColor45*S.priceEdge45Color045)}</td></tr>}
                                                    {q.linear2mm>0     && <tr style={{borderBottom:'1px solid #f3f4f6'}}><td style={{padding:'1.5px 0',color:'#374151'}}>Tapacanto PVC 2mm</td><td style={{padding:'1.5px 0',textAlign:'right',color:'#9ca3af',width:'32px'}}>{q.linear2mm}m</td><td style={{padding:'1.5px 0',textAlign:'right',fontWeight:500,width:'72px'}}>{formatCurrency(q.linear2mm*S.priceEdge2mm)}</td></tr>}
                                                    <tr style={{ borderTop:'1px solid #d1d5db', background:'#f9fafb' }}>
                                                        <td style={{ padding:'2px 0', fontWeight:700, color:'#111' }} colSpan={2}>Subtotal placas + tapac.</td>
                                                        <td style={{ padding:'2px 0', textAlign:'right', fontWeight:700, width:'72px' }}>{formatCurrency(totalPlacas + totalTapac)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            {/* HERRAJES */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Herrajes y fijos</p>
                                            <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'2mm' }}>
                                                <tbody>
                                                    {Object.entries(q.detailedHardware).map(([hw, qty]) => (
                                                        <tr key={hw} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                            <td style={{ padding:'1.5px 0', color:'#374151' }}>{hw}</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', color:'#9ca3af', width:'32px' }}>{qty as number} un</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:500, width:'72px' }}>{formatCurrency(hwPrice(hw, qty as number))}</td>
                                                        </tr>
                                                    ))}
                                                    {item.modules?.flatMap((m:any)=>m.extras||[]).map((ex:any, ei:number) => (
                                                        <tr key={ei} style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                            <td style={{ padding:'1.5px 0', color:'#374151' }}>{ex.description}</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', color:'#9ca3af', width:'32px' }}>{ex.quantity} {ex.unit}</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:500, width:'72px' }}>{formatCurrency(ex.unitPrice * ex.quantity)}</td>
                                                        </tr>
                                                    ))}
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'1.5px 0', color:'#374151' }}>Tornillería y bulones (kit fijo)</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', color:'#9ca3af', width:'32px' }}>1 kit</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:500, width:'72px' }}>{formatCurrency(S.priceScrews)}</td>
                                                    </tr>
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'1.5px 0', color:'#374151' }}>Adhesivo PVA / Cemento (kit fijo)</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', color:'#9ca3af', width:'32px' }}>1 kit</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:500, width:'72px' }}>{formatCurrency(S.priceGlueTin)}</td>
                                                    </tr>
                                                    <tr style={{ borderTop:'1px solid #d1d5db', background:'#f9fafb' }}>
                                                        <td style={{ padding:'2px 0', fontWeight:700, color:'#111' }} colSpan={2}>Subtotal herrajes + fijos</td>
                                                        <td style={{ padding:'2px 0', textAlign:'right', fontWeight:700, width:'72px' }}>{formatCurrency(totalHerrajes + totalFijos)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* COLUMNA DER: Terminación + MO + Cuadro */}
                                        <div>
                                            {/* TERMINACIÓN APLICADA */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Terminación aplicada</p>
                                            <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'3mm' }}>
                                                <tbody>
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'1.5px 0', color:'#374151' }}>Sup. frentes (×1.15)</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', color:'#6b7280' }}>
                                                            {(item.modules.reduce((a:number,m:any)=>a+(m.width||0)*(m.height||0)/1e6*(m.quantity||1),0)*1.15).toFixed(2)} m²
                                                        </td>
                                                    </tr>
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'1.5px 0', color:'#374151' }}>Sup. exterior total (×1.15)</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', color:'#6b7280' }}>
                                                            {(item.modules.reduce((a:number,m:any)=>{const W=m.width||0,H=m.height||0,D=m.depth||0;return a+(W*H+2*H*D+2*W*D)/1e6*(m.quantity||1);},0)*1.15).toFixed(2)} m²
                                                        </td>
                                                    </tr>
                                                    {finishLabel && (
                                                        <tr style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a' }}>
                                                            <td style={{ padding:'1.5px 0', color:'#92400e', fontWeight:600 }}>{finishLabel}</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:700, color:'#92400e' }}>
                                                                {finishAreaM2.toFixed(1)} m² × {formatCurrency(finishPriceM2)}/m² = {formatCurrency(totalFinish)}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {!finishLabel && (
                                                        <tr><td colSpan={2} style={{ padding:'1.5px 0', color:'#9ca3af', fontStyle:'italic' }}>Sin terminación especial (melamina estándar)</td></tr>
                                                    )}
                                                </tbody>
                                            </table>

                                            {/* MANO DE OBRA */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>Mano de obra</p>
                                            <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'3mm' }}>
                                                <tbody>
                                                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                                                        <td style={{ padding:'1.5px 0', color:'#374151' }}>{item.labor?.workers||1} op. × {item.labor?.days||1} días × {formatCurrency(S.costLaborDay)}/día</td>
                                                        <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight:600, width:'72px' }}>{formatCurrency(laborCost)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>

                                            {/* RESUMEN COSTO REAL */}
                                            <div style={{ background:'#111', color:'#fff', borderRadius:'2px', padding:'2.5mm 3mm', marginBottom:'3mm' }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Costo directo ({descRealConfig})</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(totalDirectCost)}</span>
                                                </div>
                                                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5px' }}>
                                                    <span style={{ fontSize:'9px', color:'#aaa' }}>Beneficio taller ({margins.workshop}%)</span>
                                                    <span style={{ fontSize:'9px', color:'#ddd' }}>{formatCurrency(totalWorkshop - totalDirectCost)}</span>
                                                </div>
                                                <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1px solid #444', paddingTop:'2px', marginTop:'2px' }}>
                                                    <span style={{ fontSize:'12px', fontWeight:700 }}>PRECIO TALLER</span>
                                                    <span style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>{formatCurrency(totalWorkshop)}</span>
                                                </div>
                                            </div>

                                            {/* 14 TERMINACIONES — configuración real destacada */}
                                            <p style={{ fontSize:'10px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'2px', borderBottom:'1px solid #e5e7eb', paddingBottom:'1px' }}>
                                                Comparativa 14 terminaciones · Benef. {margins.workshop}%
                                            </p>
                                            <table style={{ width:'100%', fontSize:'9.5px', borderCollapse:'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom:'1.5px solid #374151', background:'#f9fafb' }}>
                                                        <th style={{ padding:'2px 0', textAlign:'left', fontWeight:600, color:'#4b5563' }}>Terminación</th>
                                                        <th style={{ padding:'2px 3px', textAlign:'right', fontWeight:600, color:'#4b5563', width:'64px' }}>Costo dir.</th>
                                                        <th style={{ padding:'2px 3px', textAlign:'right', fontWeight:600, color:'#b45309', width:'60px' }}>Benef.</th>
                                                        <th style={{ padding:'2px 0', textAlign:'right', fontWeight:700, color:'#111', width:'72px' }}>P. Taller</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {terminaciones.map((t) => (
                                                        <tr key={t.k} style={{
                                                            borderBottom: '1px solid #f3f4f6',
                                                            background: t.isReal ? '#f0fdf4' : 'transparent',
                                                            fontWeight: t.isReal ? 700 : 400,
                                                        }}>
                                                            <td style={{ padding:'1.5px 0', color: t.isReal ? '#166534' : '#374151', display:'flex', alignItems:'center', gap:'3px' }}>
                                                                {t.isReal && <span style={{ fontSize:'8px', background:'#16a34a', color:'#fff', borderRadius:'2px', padding:'0 2px', fontWeight:700, whiteSpace:'nowrap' }}>✓</span>}
                                                                {t.label}
                                                            </td>
                                                            <td style={{ padding:'1.5px 3px', textAlign:'right', color: t.isReal ? '#166534' : '#6b7280', width:'64px' }}>{formatCurrency(t.r.d)}</td>
                                                            <td style={{ padding:'1.5px 3px', textAlign:'right', color:'#b45309', width:'60px' }}>{formatCurrency(t.r.w - t.r.d)}</td>
                                                            <td style={{ padding:'1.5px 0', textAlign:'right', fontWeight: t.isReal ? 800 : 600, color: t.isReal ? '#166534' : '#111', width:'72px' }}>{formatCurrency(t.r.w)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>{/* fin grid 2 col */}

                                </div>{/* fin a4-body costos */}
                                <Ftr />
                            </div>{/* fin a4-page costos */}

                            {/* ════════════════════════════════════
                                HOJA B: PLANILLA DE CORTES DEL ÍTEM
                            ════════════════════════════════════ */}
                            <div className="a4-page" style={{ fontSize:'12px' }}>
                                <Hdr n={pageBase+2} total={itemsToPrint.length * totalItemPages} />
                                <div className="a4-body" style={{ padding:'4mm 9mm' }}>

                                    <div style={{ borderBottom:'2px solid #111', paddingBottom:'2px', marginBottom:'4mm', display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                                        <span style={{ fontWeight:700, fontSize:'12px', textTransform:'uppercase' }}>Planilla de Cortes — {item.name}</span>
                                        <span style={{ fontSize:'9px', color:'#6b7280' }}>{descRealConfig} · {item.modules.length} módulos</span>
                                    </div>

                                    {Object.entries(itemCutList).map(([matLabel, thicknesses]) => (
                                        <div key={matLabel} style={{ marginBottom:'4mm' }}>
                                            <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', color:'#fff', background:'#374151', padding:'2px 4px', marginBottom:'2px', letterSpacing:'0.5px' }}>
                                                {matLabel}
                                            </p>
                                            {Object.entries(thicknesses).map(([, pieces]) => (
                                                <table style={{ width:'100%', fontSize:'12px', borderCollapse:'collapse', marginBottom:'3mm' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom:'1.5px solid #374151', background:'#f9fafb' }}>
                                                            <th style={{ padding:'2px 3px', textAlign:'left', fontWeight:600, color:'#4b5563' }}>Pieza</th>
                                                            <th style={{ padding:'2px 3px', textAlign:'left', fontWeight:600, color:'#4b5563' }}>Destino</th>
                                                            <th style={{ padding:'2px 3px', textAlign:'center', fontWeight:600, color:'#4b5563', width:'52px' }}>Mayor (mm)</th>
                                                            <th style={{ padding:'2px 3px', textAlign:'center', fontWeight:600, color:'#4b5563', width:'52px' }}>Menor (mm)</th>
                                                            <th style={{ padding:'2px 3px', textAlign:'center', fontWeight:600, color:'#4b5563', width:'40px' }}>Cant.</th>
                                                            <th style={{ padding:'2px 3px', textAlign:'center', fontWeight:600, color:'#4b5563', width:'36px' }}>Veta</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(pieces as any[]).map((p, pi) => (
                                                            <tr key={pi} style={{ borderBottom:'1px solid #f3f4f6', background: pi%2===0?'#fff':'#fafafa' }}>
                                                                <td style={{ padding:'1.5px 3px', color:'#374151' }}>{p.pieza}</td>
                                                                <td style={{ padding:'1.5px 3px', color:'#6b7280' }}>{p.destino}</td>
                                                                <td style={{ padding:'1.5px 3px', textAlign:'center', fontWeight:600 }}>{p.mayor}</td>
                                                                <td style={{ padding:'1.5px 3px', textAlign:'center', fontWeight:600 }}>{p.menor}</td>
                                                                <td style={{ padding:'1.5px 3px', textAlign:'center', fontWeight:700 }}>{p.cantidad}</td>
                                                                <td style={{ padding:'1.5px 3px', textAlign:'center', color: p.veta==='H'?'#1d4ed8':p.veta==='V'?'#7c3aed':'#9ca3af', fontWeight:700 }}>{p.veta}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ))}
                                        </div>
                                    ))}
                                    {Object.keys(itemCutList).length === 0 && (
                                        <p style={{ color:'#9ca3af', fontStyle:'italic' }}>Sin piezas calculadas para este ítem.</p>
                                    )}

                                </div>{/* fin a4-body cortes */}
                                <Ftr />
                            </div>{/* fin a4-page cortes */}

                            </React.Fragment>
                        );
                    })}

                            {/* ═══ HOJA 2: PLANILLA DE CORTES ═══ */}
                            {(printMode === 'COSTS' || printMode === 'COSTS_CUTS') && (
                                <div className="a4-page">
                                    <Hdr n={printMode === 'COSTS_CUTS' ? 1 : 2} total={totalPages} />
                                    <div className="a4-body">
                                        <div style={{ borderBottom:'2px solid #111', paddingBottom:'4px', marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                            <span style={{ fontWeight:700, fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Planilla de Cortes</span>
                                            <span style={{ fontSize:'10px', color:'#6b7280' }}>{itemsToPrint.length} ítem(s) · {itemsToPrint.reduce((a,i) => a + i.modules.length, 0)} módulos</span>
                                        </div>
                                        {Object.entries(cutList).map(([material, thicknesses]) => (
                                            <div key={material} style={{ marginBottom:'8px' }}>
                                                <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', color:'#6b7280', background:'#f3f4f6', padding:'2px 4px', marginBottom:'3px' }}>{material}</p>
                                                {Object.entries(thicknesses as any).map(([thick, pieces]) => (
                                                    <table key={thick} style={{ width:'100%', fontSize:'11px', borderCollapse:'collapse', marginBottom:'4px' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom:'1px solid #d1d5db', background:'#f9fafb' }}>
                                                                <th style={{ padding:'2px 2px', textAlign:'left', fontWeight:600, color:'#6b7280' }}>Pieza</th>
                                                                <th style={{ padding:'2px 2px', textAlign:'center', fontWeight:600, color:'#6b7280', width:'32px' }}>Cant.</th>
                                                                <th style={{ padding:'2px 2px', textAlign:'center', fontWeight:600, color:'#6b7280', width:'44px' }}>Ancho</th>
                                                                <th style={{ padding:'2px 2px', textAlign:'center', fontWeight:600, color:'#6b7280', width:'44px' }}>Largo</th>
                                                                <th style={{ padding:'2px 2px', textAlign:'center', fontWeight:600, color:'#6b7280', width:'32px' }}>Veta</th>
                                                                <th style={{ padding:'2px 2px', textAlign:'left', fontWeight:600, color:'#6b7280' }}>Ítem</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(pieces as any[]).map((p, pidx) => (
                                                                <tr key={pidx} style={{ borderBottom:'1px solid #f3f4f6', background: pidx%2===0 ? '#fff' : '#fafafa' }}>
                                                                    <td style={{ padding:'1.5px 2px', color:'#374151' }}>{p.moduleRef?.substring(0, 22)}</td>
                                                                    <td style={{ padding:'1.5px 2px', textAlign:'center', fontWeight:700 }}>{p.quantity}</td>
                                                                    <td style={{ padding:'1.5px 2px', textAlign:'center' }}>{p.width}</td>
                                                                    <td style={{ padding:'1.5px 2px', textAlign:'center' }}>{p.height}</td>
                                                                    <td style={{ padding:'1.5px 2px', textAlign:'center', fontWeight:700 }}>{p.grain === 'horizontal' ? 'H' : p.grain === 'vertical' ? 'V' : '—'}</td>
                                                                    <td style={{ padding:'1.5px 2px', color:'#9ca3af' }}>{(p as any).itemName || ''}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ))}
                                            </div>
                                        ))}
                                        {Object.keys(cutList).length === 0 && (
                                            <p style={{ fontSize:'12px', color:'#9ca3af', fontStyle:'italic' }}>Sin piezas calculadas.</p>
                                        )}
                                    </div>
                                    <Ftr />
                                </div>
                            )}

                        </>
                    );
                })()}

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
                    @page { margin: 10mm; size: A4; }
                    html, body, #root, .animate-fade-in, .min-h-screen { margin:0 !important; padding:0 !important; background:white !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                    .no-print { display: none !important; }
                }
            `}</style>
            <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-6 pt-6">
                <button onClick={() => setPrintMode('NONE')} className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200"><ArrowLeft size={16} /> Volver</button>
                <div className="flex gap-2">
                    {!editingEstimate && onSaveEstimate && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                            <Archive size={14}/> Guardado en Historial
                        </div>
                    )}
                    <button
                        onClick={() => {
                            const isChrome = navigator.userAgent.includes('Chrome');
                            const isFirefox = navigator.userAgent.includes('Firefox');
                            let instrucciones = 'Para imprimir sin encabezado ni pie de página del navegador:\n\n';
                            if (isChrome) {
                                instrucciones += 'Chrome:\n→ En el diálogo, hacé clic en "Más opciones"\n→ Desactivá "Encabezados y pies de página"';
                            } else if (isFirefox) {
                                instrucciones += 'Firefox:\n→ En el diálogo, ir a "Página"\n→ Desactivá encabezado y pie en los desplegables';
                            } else {
                                instrucciones += '→ En el diálogo, buscá "Encabezados y pies de página" y desactivalo';
                            }
                            instrucciones += '\n\nEsta configuración se guarda para futuras impresiones.';
                            alert(instrucciones);
                            window.print();
                        }}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
                    >
                        <Printer size={16}/> Imprimir
                    </button>
                </div>
            </div>
            <div className="print-container relative w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none flex flex-col">
                <header className="h-[14mm] bg-black text-white flex items-center justify-between px-10 relative">
                    <div className="flex items-baseline gap-4"><h1 className="text-4xl font-bold tracking-tighter leading-none">rødën</h1><span className="text-3xl font-light text-gray-500 pb-0.5">|</span><span className="text-lg font-medium mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>Cotización</span></div>
                    <div className="text-right">
                        <div className="text-sm font-bold flex items-center justify-end gap-2">
                            Ref: {quoteId}
                        </div>
                        {quoteVersion && <div className="text-[10px] text-gray-300 mt-0.5">v{quoteVersion}</div>}
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
                                    {(selectedItemIds.size > 0 ? items.filter(i => selectedItemIds.has(i.id)) : items).map((item, idx) => {
                                        // Siempre recalcular con engine actual usando snapshot del presupuesto
                                        const budgetSnapshot = (editingEstimate?.settingsSnapshot || activeSettings) as CostSettings;
                                        const prices = getRecalculatedItemPrices(item, budgetSnapshot);
                                        return (
                                            <div key={idx} className="text-sm mb-4 border-b border-gray-200 pb-2 break-inside-avoid">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-1">
                                                        <p className="font-bold mb-1 text-base uppercase">• {item.name}</p>
                                                        {/* Ítem manual: sin detalle de materiales ni herrajes */}
                                                        {!((item as any).isManualItem || item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID)) && (
                                                        <div className="pl-4 text-gray-700">
                                                            <p className="italic mb-1 text-xs">Diseño y medidas según proyecto.</p>
                                                            <ul className="list-disc pl-5 space-y-0 text-[10px] text-gray-500 leading-tight">
                                                                {Array.from(new Set(item.modules?.flatMap(m => [
                                                                    m.calculateHinges ? HINGE_LABELS[m.hingeType || 'COMMON'] : null,
                                                                    m.calculateSlides ? SLIDE_LABELS[m.slideType || 'TELESCOPIC'] : null,
                                                                    m.hasGasPistons ? 'Pistones a Gas' : null
                                                                ].filter(Boolean)))).map((hw, i) => <li key={i}>{cleanHardwareName(hw as string)}</li>)}
                                                                {item.modules?.flatMap(m => m.extras || []).map((ex, i) => <li key={`ex${i}`}>{ex.description} ({ex.quantity} {ex.unit})</li>)}
                                                            </ul>
                                                        </div>
                                                        )}
                                                    </div>

                                                    {/* PRECIOS — un renglón por configuración, sin tabla ni títulos */}
                                                    <div className="w-64 shrink-0 flex flex-col gap-0.5">
                                                        {(() => {
                                                            // Ítem manual: solo precio, sin leyenda de material
                                                            const isManualItem = (item as any).isManualItem ||
                                                                item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);

                                                            if (isManualItem) {
                                                                return (
                                                                    <div className="flex justify-end items-baseline border-b border-gray-300 pb-1.5 mb-1">
                                                                        <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatCurrency(roundUp10(prices.colorAglo))}</span>
                                                                    </div>
                                                                );
                                                            }

                                                            // Detectar configuración real del item
                                                            const hasLacquer = item.modules?.some((m: any) => (m.moduleType || '').includes('LACQUER'));
                                                            const hasVeneer  = item.modules?.some((m: any) => (m.moduleType || '').includes('VENEER'));
                                                            const isWhite    = item.modules?.every((m: any) => m.isWhiteStructure);
                                                            const isMDF      = item.modules?.every((m: any) => m.structureCore === 'MDF');

                                                            // Descripción larga de la configuración real
                                                            let configDescLocal = '';
                                                            if (hasLacquer) {
                                                                const struc = isMDF ? 'Melamina MDF' : (isWhite ? 'Melamina Blanca MDP' : 'Melamina Color MDP');
                                                                configDescLocal = `${struc} + Frentes Laca Semi Mate`;
                                                            } else if (hasVeneer) {
                                                                const struc = isMDF ? 'Melamina MDF' : (isWhite ? 'Melamina Blanca MDP' : 'Melamina Color MDP');
                                                                configDescLocal = `${struc} + Frentes Enchapado Kiri`;
                                                            } else if (isWhite && isMDF) {
                                                                configDescLocal = 'Melamina Blanca MDF';
                                                            } else if (isWhite) {
                                                                configDescLocal = 'Melamina Blanca MDP';
                                                            } else if (isMDF) {
                                                                configDescLocal = 'Melamina Color MDF';
                                                            } else {
                                                                configDescLocal = 'Melamina Color MDP';
                                                            }

                                                            let configPrice = prices.colorAglo;
                                                            if (hasLacquer) configPrice = prices.lacquer;
                                                            else if (hasVeneer) configPrice = prices.veneer;
                                                            else if (isWhite && isMDF) configPrice = prices.whiteMDF;
                                                            else if (isWhite) configPrice = prices.whiteAglo;
                                                            else if (isMDF) configPrice = prices.colorMDF;

                                                            return (
                                                                // Configuración original: negrita, sin fondo
                                                                <div className="flex justify-between items-baseline border-b border-gray-300 pb-1.5 mb-1">
                                                                    <span className="text-[10px] font-bold text-gray-800 leading-tight mr-3">{configDescLocal}</span>
                                                                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatCurrency(roundUp10(configPrice))}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Alternativas: sin negrita, tono gris — excluir la que ya es configuración principal */}
                                                        {(() => {
                                                            const isManualItem = (item as any).isManualItem ||
                                                                item.modules?.every((m: any) => m.specialTemplateId === SPECIAL_MANUAL_ID);
                                                            if (isManualItem) return null;
                                                            const hasLacquer = item.modules?.some((m: any) => (m.moduleType || '').includes('LACQUER'));
                                                            const hasVeneer  = item.modules?.some((m: any) => (m.moduleType || '').includes('VENEER'));
                                                            const isWhite    = item.modules?.every((m: any) => m.isWhiteStructure);
                                                            const isMDF      = item.modules?.every((m: any) => m.structureCore === 'MDF');
                                                            let configDesc = '';
                                                            if (hasLacquer) configDesc = (isMDF ? 'Melamina MDF' : (isWhite ? 'Melamina Blanca MDP' : 'Melamina Color MDP')) + ' + Frentes Laca Semi Mate';
                                                            else if (hasVeneer) configDesc = (isMDF ? 'Melamina MDF' : (isWhite ? 'Melamina Blanca MDP' : 'Melamina Color MDP')) + ' + Frentes Enchapado Kiri';
                                                            else if (isWhite && isMDF) configDesc = 'Melamina Blanca MDF';
                                                            else if (isWhite) configDesc = 'Melamina Blanca MDP';
                                                            else if (isMDF) configDesc = 'Melamina Color MDF';
                                                            else configDesc = 'Melamina Color MDP';
                                                            return (<>
                                                        {enabledScenarios.white && configDesc !== 'Melamina Blanca MDP' && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina Blanca MDP</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.whiteAglo))}</span>
                                                            </div>
                                                        )}
                                                        {enabledScenarios.white && configDesc !== 'Melamina Blanca MDF' && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina Blanca MDF</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.whiteMDF))}</span>
                                                            </div>
                                                        )}
                                                        {enabledScenarios.textured && configDesc !== 'Melamina Color MDP' && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina Color MDP</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.colorAglo))}</span>
                                                            </div>
                                                        )}
                                                        {enabledScenarios.textured && configDesc !== 'Melamina Color MDF' && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina Color MDF</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.colorMDF))}</span>
                                                            </div>
                                                        )}
                                                        {enabledScenarios.lacquer && !configDesc.includes('Laca') && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina + Frentes Laca Semi Mate</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.lacquer))}</span>
                                                            </div>
                                                        )}
                                                        {enabledScenarios.veneer && !configDesc.includes('Enchapado') && (
                                                            <div className="flex justify-between items-baseline py-0.5">
                                                                <span className="text-[10px] text-gray-400 leading-tight mr-3">Melamina + Frentes Enchapado Kiri</span>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">{formatCurrency(roundUp10(prices.veneer))}</span>
                                                            </div>
                                                        )}
                                                            </>);
                                                        })()}
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
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-roden-black flex items-center gap-2"><Calculator size={20}/> Estimador de Costos</h2>
                {/* {console.log("[CostEstimator] userRole:", userRole)} */}
                <RodenAIButton 
                    mode="estimador_revision" 
                    data={{ items, settings, selectedProjectId: selectedProjectId }} 
                    userRole={userRole}
                />
            </div>
            <div className="flex gap-2">
                <button onClick={() => setView('SETUP')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'SETUP' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Database size={16}/> Precios</button>
                <button onClick={() => setView('MODULES')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'MODULES' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Box size={16}/> Módulos</button>
                <button onClick={() => setView('RESULTS')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'RESULTS' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><DollarSign size={16}/> Resultados</button>
                <div className="w-px h-8 bg-gray-200 mx-2"></div>
                <button onClick={() => setView('HISTORY')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${view === 'HISTORY' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'}`}><History size={16}/> Historial</button>

            </div>
        </header>

        <div className="flex-1 p-8 max-w-6xl mx-auto w-full flex flex-col min-h-0">
            {view === 'SETUP' && (
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8">
                    <div className="border-b border-gray-100 pb-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Gestión de Precios</h3>
                            <div className="flex gap-4 items-center">
                                <input type="text" placeholder="Nombre Lista" className="border p-2 rounded text-sm w-48" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
                                <button onClick={handleSavePriceList} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-emerald-700"><Save size={14} /> Guardar</button>
                                <div className="h-8 w-px bg-gray-200"></div>
                                <select className="border p-2 rounded text-sm w-48 bg-gray-50" onChange={(e) => handleLoadPriceList(e.target.value)} value="">
                                    <option value="" disabled>Cargar Historial...</option>
                                    {priceHistory.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
                                </select>
                            </div>
                        </div>
                        {/* Lista activa */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-500 uppercase font-bold tracking-wide">Lista activa:</span>
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                                activeSettings.name && activeSettings.name !== 'Lista Actual'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}>
                                {activeSettings.name || 'Lista Actual (sin guardar)'}
                            </span>
                            {(!activeSettings.name || activeSettings.name === 'Lista Actual') && (
                                <span className="text-[10px] text-amber-600 italic">— editando en memoria, no guardada</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                        {/* Placas */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-gray-500 uppercase border-b pb-2">Placas</h4>
                            <div className="space-y-2">
                                <div><label className="text-xs block">Placa melamina blanca MDP 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18WhiteAglo} onChange={e => setSettings({...settings, priceBoard18WhiteAglo: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina blanca base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18WhiteMDF} onChange={e => setSettings({...settings, priceBoard18WhiteMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina color MDP 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18ColorAglo} onChange={e => setSettings({...settings, priceBoard18ColorAglo: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina texturada base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18ColorMDF} onChange={e => setSettings({...settings, priceBoard18ColorMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa mdf crudo 1 cara blanca 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18MDFCrudo1Face} onChange={e => setSettings({...settings, priceBoard18MDFCrudo1Face: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa madera enchapada base mdf 18mm</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard18VeneerMDF} onChange={e => setSettings({...settings, priceBoard18VeneerMDF: Number(e.target.value)})} /></div>
                                <div><label className="text-xs block">Placa melamina blanca 15mm base MDP</label><input type="number" className="border p-1 w-full rounded" value={settings.priceBoard15WhiteAglo} onChange={e => setSettings({...settings, priceBoard15WhiteAglo: Number(e.target.value)})} /></div>
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
                                            type="button"
                                            onClick={() => setIsTemplatesPanelOpen(true)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                                        >
                                            <History size={12} /> Cargar Item
                                        </button>
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

                            {/* Selector Tipo de Módulo */}
                            <div className="flex gap-2 items-center">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Tipo:</span>
                                {[
                                    { id: 'STANDARD', label: 'Estándar' },
                                    { id: 'SPECIAL',  label: 'Especial' },
                                    { id: 'MANUAL',   label: 'Manual'   },
                                ].map(k => (
                                    <button
                                        key={k.id}
                                        type="button"
                                        onClick={() => { setModuleKind(k.id as any); setSpecialTemplateId(''); setSpecialOptions({}); }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${moduleKind === k.id ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-black'}`}
                                    >
                                        {k.label}
                                    </button>
                                ))}
                                {moduleKind === 'SPECIAL' && (
                                    <select
                                        className="border p-1.5 rounded text-xs bg-white ml-2"
                                        value={specialTemplateId}
                                        onChange={e => { setSpecialTemplateId(e.target.value); setSpecialOptions({}); }}
                                    >
                                        <option value="">— Elegir template —</option>
                                        {SPECIAL_MODULE_TEMPLATES.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

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
                                {(() => {
                                    // Ocultar "Alto" si el template especial no lo usa (ej: Estante Flotante)
                                    const activeTmpl = moduleKind === 'SPECIAL' && specialTemplateId ? getTemplate(specialTemplateId) : null;
                                    const hideHeight = activeTmpl && !activeTmpl.params.includes('height');
                                    if (hideHeight) return (
                                        <div className="w-20">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Alto</label>
                                            <div className="w-full border border-dashed border-gray-300 p-2 rounded text-xs text-center bg-gray-50 text-gray-400 font-mono">Fijo: 36mm</div>
                                        </div>
                                    );
                                    return (
                                        <div className="w-20">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Alto</label>
                                            <input type="number" className="w-full border p-2 rounded text-sm text-center" required value={moduleForm.height} onChange={e => handleInputChange('height', Number(e.target.value))} />
                                        </div>
                                    );
                                })()}
                                <div className="w-20">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Prof.</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center" required value={moduleForm.depth} onChange={e => handleInputChange('depth', Number(e.target.value))} />
                                </div>
                                <div className="w-16">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Cant.</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm text-center font-bold bg-indigo-50 text-indigo-700" value={moduleForm.quantity} onChange={e => handleInputChange('quantity', Number(e.target.value))}/>
                                </div>

                                <div className="w-px h-10 bg-gray-200 mx-2 self-center"></div>

                                {moduleKind !== 'MANUAL' && (
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
                                )}
                            </div>

                            {/* Row 2: Tech Specs — oculto en módulo manual */}
                            {moduleKind !== 'MANUAL' && (
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

                                {/* Material Configuration Section — dos selectores independientes */}
                                <div className="flex flex-wrap items-center gap-4 bg-amber-50 p-3 rounded-xl border border-amber-200">

                                    {/* SELECTOR ESTRUCTURA */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-amber-800 uppercase font-bold">Estructura</label>
                                        <select
                                            className="border p-2 rounded text-xs bg-white w-48 font-medium"
                                            value={(() => {
                                                const mt = moduleForm.moduleType || 'MELAMINE_FULL';
                                                if (mt === 'LACQUER_FULL')  return 'laca';
                                                if (mt === 'VENEER_FULL')   return 'enchapad';
                                                const isWhite = moduleForm.isWhiteStructure;
                                                const isMDF   = moduleForm.structureCore === 'MDF';
                                                if (isWhite && !isMDF)  return 'mel_blanca_aglo';
                                                if (isWhite && isMDF)   return 'mel_blanca_mdf';
                                                if (!isWhite && !isMDF) return 'mel_color_aglo';
                                                return 'mel_color_mdf';
                                            })()}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const mt = moduleForm.moduleType || 'MELAMINE_FULL';
                                                // Si los frentes son terminación especial, respetar el moduleType de frentes
                                                const isFrontsSpecial = mt === 'MELAMINE_STRUCT_LACQUER' || mt === 'MELAMINE_STRUCT_VENEER';
                                                if (val === 'laca') {
                                                    setModuleForm(prev => ({ ...prev, moduleType: 'LACQUER_FULL', isWhiteStructure: false, structureCore: 'MDF', frontsCore: 'MDF', frontsType: 'LACQUER' }));
                                                } else if (val === 'enchapad') {
                                                    setModuleForm(prev => ({ ...prev, moduleType: 'VENEER_FULL', isWhiteStructure: false, structureCore: 'MDF', frontsCore: 'MDF', frontsType: 'VENEER' }));
                                                } else {
                                                    const isWhite = val.includes('blanca');
                                                    const isMDF   = val.includes('mdf');
                                                    // Si frentes son especiales, mantener moduleType de frentes; si no, MELAMINE_FULL
                                                    const newModuleType = isFrontsSpecial ? mt : 'MELAMINE_FULL';
                                                    setModuleForm(prev => ({ ...prev, moduleType: newModuleType as any, isWhiteStructure: isWhite, structureCore: isMDF ? 'MDF' : 'AGLO' }));
                                                }
                                            }}
                                        >
                                            <optgroup label="Melamina">
                                                <option value="mel_blanca_aglo">Blanca MDP</option>
                                                <option value="mel_blanca_mdf">Blanca — MDF</option>
                                                <option value="mel_color_aglo">Color MDP</option>
                                                <option value="mel_color_mdf">Color — MDF</option>
                                            </optgroup>
                                            <optgroup label="Terminación completa">
                                                <option value="laca">Laqueado (todo el mueble)</option>
                                                <option value="enchapad">Enchapado Kiri (todo el mueble)</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    <div className="w-px h-10 bg-amber-300 self-center"></div>

                                    {/* SELECTOR FRENTES — completamente independiente de estructura */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-amber-800 uppercase font-bold">Frentes</label>
                                        <select
                                            className="border p-2 rounded text-xs bg-white w-48 font-medium"
                                            value={(() => {
                                                const mt = moduleForm.moduleType || 'MELAMINE_FULL';
                                                if (mt === 'MELAMINE_STRUCT_LACQUER' || mt === 'LACQUER_FULL') return 'laca';
                                                if (mt === 'MELAMINE_STRUCT_VENEER'  || mt === 'VENEER_FULL')  return 'enchapad';
                                                // Melamina: leer materialFrontName para saber si es blanca o color
                                                const frontName = (moduleForm.materialFrontName || '').toLowerCase();
                                                const isFrontWhite = frontName.includes('blanca') || frontName.includes('white') || (!frontName && moduleForm.isWhiteStructure);
                                                const isMDF = moduleForm.frontsCore === 'MDF';
                                                if (isFrontWhite && !isMDF)  return 'mel_blanca_aglo';
                                                if (isFrontWhite && isMDF)   return 'mel_blanca_mdf';
                                                if (!isFrontWhite && !isMDF) return 'mel_color_aglo';
                                                return 'mel_color_mdf';
                                            })()}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const mt = moduleForm.moduleType || 'MELAMINE_FULL';
                                                const isStructFull = mt === 'LACQUER_FULL' || mt === 'VENEER_FULL';
                                                if (val === 'laca') {
                                                    const newMt = isStructFull ? 'LACQUER_FULL' : 'MELAMINE_STRUCT_LACQUER';
                                                    setModuleForm(prev => ({ ...prev, moduleType: newMt as any, frontsCore: 'MDF', frontsType: 'LACQUER', materialFrontName: 'Laqueado' }));
                                                } else if (val === 'enchapad') {
                                                    const newMt = isStructFull ? 'VENEER_FULL' : 'MELAMINE_STRUCT_VENEER';
                                                    setModuleForm(prev => ({ ...prev, moduleType: newMt as any, frontsCore: 'MDF', frontsType: 'VENEER', materialFrontName: 'Enchapado Kiri' }));
                                                } else {
                                                    // Frentes melamina — completamente independiente de la estructura
                                                    const isFrontWhite = val.includes('blanca');
                                                    const isMDF        = val.includes('mdf');
                                                    const frontName    = isFrontWhite ? 'Melamina Blanca' : 'Melamina Color';
                                                    // moduleType: si estructura es MELAMINE, combinar; si es terminación full, mantener
                                                    const newMt = isStructFull ? mt : 'MELAMINE_FULL';
                                                    setModuleForm(prev => ({
                                                        ...prev,
                                                        moduleType:       newMt as any,
                                                        frontsCore:       isMDF ? 'MDF' : 'AGLO',
                                                        frontsType:       'MELAMINE',
                                                        materialFrontName: frontName,
                                                    }));
                                                }
                                            }}
                                            disabled={moduleForm.moduleType === 'LACQUER_FULL' || moduleForm.moduleType === 'VENEER_FULL'}
                                        >
                                            <optgroup label="Melamina">
                                                <option value="mel_blanca_aglo">Blanca MDP</option>
                                                <option value="mel_blanca_mdf">Blanca — MDF</option>
                                                <option value="mel_color_aglo">Color MDP</option>
                                                <option value="mel_color_mdf">Color — MDF</option>
                                            </optgroup>
                                            <optgroup label="Terminación">
                                                <option value="laca">Laca Semi Mate</option>
                                                <option value="enchapad">Enchapado Kiri</option>
                                            </optgroup>
                                        </select>
                                        {(moduleForm.moduleType === 'LACQUER_FULL' || moduleForm.moduleType === 'VENEER_FULL') && (
                                            <span className="text-[9px] text-amber-600 italic">Igual a estructura</span>
                                        )}
                                    </div>

                                    <div className="flex flex-col border-l border-amber-200 pl-4">
                                        <label className="text-[10px] text-amber-800 uppercase font-bold mb-1">Fondo</label>
                                        <select 
                                            className="border p-1.5 rounded text-xs bg-white w-32" 
                                            value={moduleForm.backingType} 
                                            onChange={e => handleInputChange('backingType', e.target.value)}
                                        >
                                            {BACKING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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

                                {/* Opciones extra del template especial */}
                                {moduleKind === 'SPECIAL' && specialTemplateId && (() => {
                                    const tmpl = getTemplate(specialTemplateId);
                                    if (!tmpl?.extraOptions?.length) return null;
                                    return (
                                        <div className="flex gap-3 items-center flex-wrap bg-purple-50 border border-purple-200 px-3 py-2 rounded-lg">
                                            {tmpl.extraOptions.map(opt => (
                                                <div key={opt.key} className="flex flex-col gap-1">
                                                    <label className="text-[10px] text-purple-700 uppercase font-bold">{opt.label}</label>
                                                    {opt.type === 'number' ? (
                                                        <input
                                                            type="number"
                                                            className="border p-1.5 rounded text-xs bg-white w-20 text-center"
                                                            min={opt.min ?? 1}
                                                            max={opt.max ?? 99}
                                                            value={specialOptions[opt.key] ?? String(opt.defaultValue ?? 1)}
                                                            onChange={e => setSpecialOptions(prev => ({ ...prev, [opt.key]: e.target.value }))}
                                                        />
                                                    ) : (
                                                        <select
                                                            className="border p-1.5 rounded text-xs bg-white"
                                                            value={specialOptions[opt.key] || opt.options[0].value}
                                                            onChange={e => setSpecialOptions(prev => ({ ...prev, [opt.key]: e.target.value }))}
                                                        >
                                                            {opt.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                </div>
                            )}

                            {/* Formulario Manual — lista libre de ítems */}
                                {moduleKind === 'MANUAL' && (
                                    <div className="w-full bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        <p className="text-[10px] text-orange-700 uppercase font-bold mb-2">Ítems del módulo especial manual</p>
                                        <div className="flex gap-1 mb-2">
                                            <input type="text" placeholder="Descripción (ej: Tapa mármol)" className="flex-1 p-1.5 text-xs border rounded" value={newManualItem.description} onChange={e => setNewManualItem(p => ({...p, description: e.target.value}))} />
                                            <input type="number" placeholder="Cant" className="w-12 p-1.5 text-xs border rounded text-center" value={newManualItem.quantity} onChange={e => setNewManualItem(p => ({...p, quantity: Number(e.target.value)}))} />
                                            <input type="text" placeholder="Un" className="w-14 p-1.5 text-xs border rounded text-center" value={newManualItem.unit} onChange={e => setNewManualItem(p => ({...p, unit: e.target.value}))} />
                                            <input type="number" placeholder="$ unit" className="w-24 p-1.5 text-xs border rounded text-right" value={newManualItem.unitPrice} onChange={e => setNewManualItem(p => ({...p, unitPrice: Number(e.target.value)}))} />
                                            <button type="button" onClick={() => {
                                                if (!newManualItem.description.trim()) return;
                                                setManualItems(prev => [...prev, { ...newManualItem, id: `mi_${Date.now()}` }]);
                                                setNewManualItem({ id: '', description: '', quantity: 1, unit: 'un', unitPrice: 0 });
                                            }} className="bg-orange-500 text-white px-2 rounded hover:bg-orange-600"><Plus size={14}/></button>
                                        </div>
                                        {manualItems.length > 0 && (
                                            <div className="space-y-1">
                                                {manualItems.map((item, i) => (
                                                    <div key={i} className="flex justify-between items-center text-xs bg-white border rounded px-2 py-1">
                                                        <span className="flex-1">{item.description}</span>
                                                        <span className="text-gray-500 mx-2">{item.quantity} {item.unit}</span>
                                                        <span className="font-bold text-gray-700 mr-2">${(item.unitPrice * item.quantity).toLocaleString('es-AR')}</span>
                                                        <button type="button" onClick={() => setManualItems(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                                                    </div>
                                                ))}
                                                <div className="text-right text-xs font-bold text-orange-700 pt-1 border-t border-orange-200">
                                                    Total: ${manualItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString('es-AR')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                            {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <button type="submit" className="bg-black text-white px-6 py-2 rounded-lg font-bold flex justify-center items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
                                        {editingId ? <Save size={16}/> : <Plus size={16}/>} {editingId ? 'Actualizar' : 'Agregar'}
                                    </button>
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
                                                <div className="flex justify-end gap-3 mt-2">
                                                    <button onClick={() => handleEditItem(item)} className="text-indigo-600 hover:text-indigo-800 text-xs underline flex items-center gap-1">
                                                        <Pencil size={10}/> Editar
                                                    </button>
                                                    <button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-600 text-xs underline flex items-center gap-1">
                                                        <Trash2 size={10}/> Eliminar
                                                    </button>
                                                </div>
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
                    
                    <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                        {/* Badge lista de precios activa */}
                        <div className="flex justify-center">
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                                <span className="text-[10px] text-amber-600 uppercase font-bold tracking-wide">Lista de precios:</span>
                                <span className="text-sm font-bold text-amber-900">
                                    {activeSettings.name || 'Lista Actual'}
                                </span>
                                {activeSettings.name && activeSettings.name !== 'Lista Actual' && (
                                    <span className="text-[10px] text-amber-500">· activa para nuevos cálculos</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-4 justify-center">
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

                                        <div className="flex items-center gap-4">
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
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const allDocs = project.docs;
                                                    const msg = allDocs.length > 1
                                                        ? `¿Eliminar el legajo "${project.name}" y sus ${allDocs.length} versiones? Esta acción no se puede deshacer.`
                                                        : `¿Eliminar el presupuesto "${project.name}"? Esta acción no se puede deshacer.`;
                                                    if (!confirm(msg)) return;
                                                    allDocs.forEach((doc: any) => { if (onDeleteEstimate) onDeleteEstimate(doc.id); });
                                                }}
                                                className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar legajo"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                            <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-gray-100' : 'bg-gray-50'}`}>
                                                <ChevronDown size={20} className="text-gray-400"/>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EXPANDED VIEW — simplificado */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 bg-gray-50/30 animate-slide-down">
                                            <div className="p-6 flex flex-col gap-5">

                                                {/* Documentos */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Documentos</p>
                                                    <div className="flex gap-3 flex-wrap">
                                                        <button
                                                            onClick={() => executeViewQuote(latestDoc)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 text-xs font-bold text-gray-700 transition-all"
                                                        >
                                                            <FileText size={14} className="text-indigo-500"/> Presupuesto
                                                        </button>
                                                        <button
                                                            onClick={() => { setPrintMode('COSTS'); setActiveSettings(latestDoc.settingsSnapshot); setTechnicalItems(latestDoc.items || []); }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 text-xs font-bold text-gray-700 transition-all"
                                                        >
                                                            <PieChart size={14} className="text-amber-500"/> Planilla de Costos
                                                        </button>
                                                        <button
                                                            onClick={() => handleGenerateProductionOrder(latestDoc.id)}
                                                            disabled={latestDoc.commercialStatus !== CommercialStatus.APPROVED}
                                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                                                latestDoc.commercialStatus === CommercialStatus.APPROVED
                                                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600'
                                                                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                                            }`}
                                                        >
                                                            <Package size={14}/> Orden de Producción
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Items del presupuesto */}
                                                {latestDoc.items && latestDoc.items.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ítems</p>
                                                        <div className="space-y-1">
                                                            {latestDoc.items.map((item: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-[11px] bg-white border border-gray-100 rounded-lg px-3 py-1.5">
                                                                    <span className="font-medium text-gray-700">• {item.name}</span>
                                                                    <span className="text-gray-400">{item.modules?.length || 0} módulos</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Acciones */}
                                                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => handleGenerateNewVersion(latestDoc)}
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
                                                        >
                                                            <Copy size={13}/> Nueva Versión
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdatePrices(latestDoc)}
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
                                                        >
                                                            <ArrowUpCircle size={13}/> Actualizar Precios
                                                        </button>
                                                        {latestDoc.commercialStatus === CommercialStatus.APPROVED && (
                                                            <button
                                                                onClick={() => handleOpenTechnicalDefinition(latestDoc)}
                                                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white border border-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                                                            >
                                                                <Check size={13}/> Confirmar Terminación
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => { setVinculandoEstimateId(latestDoc.id); setVinculandoProjectId(latestDoc.projectId || ''); }}
                                                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all"
                                                        >
                                                            <Link size={13}/> Vincular
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleArchive(latestDoc.id)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Archivar"><Archive size={16}/></button>
                                                        <button onClick={(e) => handleDelete(e, latestDoc.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Borrar"><Trash2 size={16}/></button>
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


            {/* TECHNICAL DEFINITION MODAL (FROM HISTORY) */}
            {isTechnicalModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={18}/> Confirmar Terminación Aprobada</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Seleccioná la opción que aprobó el cliente para cada ítem</p>
                            </div>
                            <button onClick={() => setIsTechnicalModalOpen(false)}><X className="text-gray-400 hover:text-black"/></button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {technicalItems.map((item) => {
                                const enabledScenarios = originalEstimateForComparison?.quoteData?.enabledScenarios as any;
                                return (
                                    <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2.5 flex justify-between items-center border-b border-gray-200">
                                            <span className="font-bold text-sm text-gray-800">{item.name}</span>
                                            <span className="text-[10px] text-gray-400">{item.modules.length} módulos</span>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-3">Terminación aprobada</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Siempre mostrar la configuración original */}
                                                {[
                                                    { key: 'base',     label: (() => {
                                                        const hasL = item.modules?.some((m:any) => (m.moduleType||'').includes('LACQUER'));
                                                        const hasV = item.modules?.some((m:any) => (m.moduleType||'').includes('VENEER'));
                                                        const isW  = item.modules[0]?.isWhiteStructure;
                                                        if (hasL) return 'Mel. + Laca Semi Mate';
                                                        if (hasV) return 'Mel. + Enchapado Kiri';
                                                        return isW ? 'Melamina Blanca' : 'Melamina Color';
                                                    })(), always: true },
                                                    { key: 'white',    label: 'Melamina Blanca',  show: enabledScenarios?.white    },
                                                    { key: 'textured', label: 'Melamina Color',    show: enabledScenarios?.textured },
                                                    { key: 'lacquer',  label: 'Laca Semi Mate',    show: enabledScenarios?.lacquer  },
                                                    { key: 'veneer',   label: 'Enchapado Kiri',    show: enabledScenarios?.veneer   },
                                                ].filter(o => o.always || o.show).map(option => (
                                                    <button
                                                        key={option.key}
                                                        onClick={() => updateTechnicalModule(item.id, '', 'finalTerminationScenario', option.key)}
                                                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all text-left ${
                                                            (item as any).finalTerminationScenario === option.key || (!((item as any).finalTerminationScenario) && option.key === 'base')
                                                                ? 'bg-black text-white border-black'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                                        }`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="border border-gray-200 rounded-xl p-4">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-2">Observaciones para el taller</p>
                                <textarea
                                    className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none outline-none focus:ring-1 focus:ring-black"
                                    rows={2}
                                    placeholder="Instrucciones especiales, detalles de entrega..."
                                    value={technicalObservations}
                                    onChange={(e) => setTechnicalObservations(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsTechnicalModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-black">Cancelar</button>
                            <button
                                onClick={handleConfirmTechnicalDefinition}
                                className="bg-black text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 flex items-center gap-2"
                            >
                                <Check size={16}/> Confirmar y guardar
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

                            {/* Beneficio Taller: viene de cada ítem — solo se muestra */}
                            {(() => {
                                const selectedItems = items.filter(i => selectedItemIds.has(i.id));
                                const margins = [...new Set(selectedItems.map(i => i.margins?.workshop ?? 35))];
                                return (
                                    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Beneficio Taller</p>
                                        {margins.length === 1
                                            ? <p className="text-lg font-bold text-gray-800">{margins[0]}%
                                                <span className="text-xs text-gray-400 font-normal ml-2">— definido en el ítem</span>
                                              </p>
                                            : <p className="text-sm text-gray-600">Márgenes: {margins.join('%, ')}%
                                                <span className="text-xs text-gray-400 block mt-0.5">Cada ítem usa su propio margen</span>
                                              </p>
                                        }
                                    </div>
                                );
                            })()}
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
                            <h3 className="font-bold text-lg">
                                {updatePricesEstimate ? 'Elegir Lista para Recalcular' : 'Seleccionar Lista de Precios'}
                            </h3>
                            <button onClick={() => setIsPriceListModalOpen(false)} className="text-gray-400 hover:text-black"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-500">Elige la lista de precios que se aplicará a este reporte para asegurar la estabilidad de los costos.</p>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                <button 
                                    onClick={() => handleSelectPriceList(settings, 'current', 'Lista Actual')}
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
                                        onClick={() => handleSelectPriceList(list.settings, list.id, list.name)}
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

                            <div className="pt-2 border-t border-gray-100">
                                {/* Precio base: configuración real de los items */}
                                {(() => {
                                    const selectedItems = items.filter(i => selectedItemIds.has(i.id));
                                    // Detectar la terminación predominante de los items seleccionados
                                    const allModules = selectedItems.flatMap(i => i.modules || []);
                                    const hasLacquer = allModules.some(m => (m.moduleType || '').includes('LACQUER'));
                                    const hasVeneer  = allModules.some(m => (m.moduleType || '').includes('VENEER'));
                                    const isWhite    = allModules.every(m => m.isWhiteStructure);
                                    let baseLabel = 'Melamina Color — MDP';
                                    if (hasLacquer) baseLabel = 'Estructura Mel. + Frentes Laqueados';
                                    else if (hasVeneer) baseLabel = 'Estructura Mel. + Frentes Enchapados';
                                    else if (isWhite) baseLabel = 'Melamina Blanca — MDP';
                                    return (
                                        <div className="mb-3 bg-gray-900 rounded-lg p-3 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-white shrink-0"></div>
                                            <div>
                                                <p className="text-xs font-bold text-white">{baseLabel}</p>
                                                <p className="text-[10px] text-gray-400">Configuración de los módulos — siempre incluida</p>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <label className="block text-sm font-medium text-gray-700 mb-2">Alternativas adicionales a mostrar</label>
                                <p className="text-[11px] text-gray-400 mb-2">Dejá en blanco para presupuestar solo la configuración base.</p>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.white} onChange={e => setEnabledScenarios({...enabledScenarios, white: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Melamina Blanca</span></label>
                                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.textured} onChange={e => setEnabledScenarios({...enabledScenarios, textured: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Melamina Color</span></label>
                                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.lacquer} onChange={e => setEnabledScenarios({...enabledScenarios, lacquer: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Laqueado</span></label>
                                    <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-gray-100 cursor-pointer"><input type="checkbox" checked={enabledScenarios.veneer} onChange={e => setEnabledScenarios({...enabledScenarios, veneer: e.target.checked})} className="w-4 h-4"/><span className="text-sm">Enchapado Kiri</span></label>
                                </div>
                            </div>
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
                                {/* Asociar a Proyecto */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Proyecto en Taller</label>
                                    <select
                                        value={productionOrderForm.linkedProjectId}
                                        onChange={(e) => setProductionOrderForm(prev => ({ ...prev, linkedProjectId: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none"
                                    >
                                        <option value="">— Sin asignar —</option>
                                        {projects
                                            .filter(p => ['PRODUCTION', 'READY', 'PROPOSAL', 'QUOTING'].includes(p.status))
                                            .map(p => (
                                                <option key={p.id} value={p.id}>{p.title}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descripción del Item</label>
                                    <textarea 
                                        value={productionOrderForm.itemDescription}
                                        onChange={(e) => setProductionOrderForm(prev => ({ ...prev, itemDescription: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none min-h-[80px]"
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
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Observaciones</label>
                                    <textarea
                                        value={productionOrderForm.observations}
                                        onChange={(e) => setProductionOrderForm(prev => ({ ...prev, observations: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-black outline-none min-h-[80px]"
                                        placeholder="Notas para el taller, detalles especiales, etc."
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

            {/* PANEL: HISTORIAL DE ITEM TEMPLATES */}
            {isTemplatesPanelOpen && (
                <div className="fixed inset-0 z-[300] flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsTemplatesPanelOpen(false)} />
                    <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-gray-100">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2"><History size={18}/> Historial de Items</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Items guardados automáticamente al crearlos</p>
                            </div>
                            <button onClick={() => setIsTemplatesPanelOpen(false)}><X className="text-gray-400 hover:text-black"/></button>
                        </div>

                        {/* Buscador */}
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-black outline-none"
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Lista */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {itemTemplates.length === 0 && (
                                <p className="text-center text-gray-400 text-sm py-12">
                                    No hay items guardados aún.<br/>
                                    <span className="text-xs">Se guardan automáticamente al crear cada Item.</span>
                                </p>
                            )}
                            {itemTemplates
                                .filter(t => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                .map((tpl, i) => (
                                    <div key={tpl.id || i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-sm">{tpl.name}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(tpl.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })}
                                                    {' · '}{tpl.modules?.length || 0} módulos
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                            <span className="bg-white border rounded px-2 py-0.5">{tpl.labor?.workers ?? 2} op. · {tpl.labor?.days ?? 3} días</span>
                                            <span className="bg-white border rounded px-2 py-0.5">T: {tpl.margins?.workshop ?? 35}% · R: {tpl.margins?.roden ?? 25}%</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleLoadTemplate(tpl, false)}
                                                className="flex-1 bg-black text-white text-xs font-bold py-1.5 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-1"
                                            >
                                                <Copy size={12}/> Copiar
                                            </button>
                                            <button
                                                onClick={() => handleLoadTemplate(tpl, true)}
                                                className="flex-1 border border-gray-300 text-gray-700 text-xs font-bold py-1.5 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                                            >
                                                <Pencil size={12}/> Usar como base
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
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
