
// --- COST ENGINE ARCHITECTURE (NEW) ---

// CAPA 1: GEOMETRÍA & TÉCNICA (Inmutable)
export interface ModuleGeometry {
  width: number; // mm
  height: number; // mm
  depth: number; // mm
}

export interface ModuleComponents {
  doors: number;
  drawers: number;
  shelves: number;
  flaps: number;
  // Hardware specifics
  hingeType: HingeType;
  slideType: SlideType;
  hasGasPistons: boolean;
}

export interface Layer1_Technical {
  surfaceBodyM2: number;
  surfaceFrontsM2: number;
  linearEdgesM: number;
  baseLaborDays: number;
}

// CAPA 2: MATERIALES & REGLAS
export interface MaterialConfig {
  bodyMaterial: string; // e.g., 'Melamina Blanca'
  frontsMaterial: string; // e.g., 'Laqueado Semi'
  edgeType: string; // e.g., 'PVC 0.45mm'
  structureCore: 'AGLO' | 'MDF'; // Base material rule
  frontsCore: 'AGLO' | 'MDF'; // Base material rule
}

export interface Layer2_Materials {
  isValid: boolean;
  appliedRules: string[]; // e.g., ["Lacquer implies MDF base"]
}

// CAPA 3: COSTO TÉCNICO (Snapshot dependiente)
export interface CostSnapshot extends CostSettings {
  currency: string;
  timestamp: string;
}

export interface Layer3_TechnicalCost {
  costMaterials: number;
  costHardware: number;
  costLabor: number;
  costFinish: number; // Surface treatment (Lacquer/Lustre)
  totalDirectCost: number; // Costo Primo
  complexityFactor: number; // Multiplier for labor
  realLaborDays: number;
}

// CAPA 4: COMERCIAL
export interface CommercialConfig {
  marginWorkshop: number; // %
  marginCommercial: number; // %
  taxRate: number; // % (IVA)
}

export interface Layer4_Commercial {
  priceWorkshop: number; // Precio Taller (Costo + Margen Taller)
  grossMarginValue: number;
  finalPrice: number; // Precio Venta Público
}

// ENTIDAD COMPLETA (MÓDULO)
export interface CostModule {
  id: string;
  name: string;
  quantity: number;
  geometry: ModuleGeometry;
  components: ModuleComponents;
  materials: MaterialConfig;
  // Computed Layers
  technical?: Layer1_Technical;
  costs?: Layer3_TechnicalCost;
  commercial?: Layer4_Commercial;
}

// --- END COST ENGINE ARCHITECTURE ---

export type ClientStatus = 'LEAD' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type ClientType = 'INDIVIDUAL' | 'COMPANY';
export type ClientOrigin = 'REFERRAL' | 'ORGANIC' | 'SOCIAL_MEDIA' | 'WEBSITE';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  status: ClientStatus;
  type: ClientType; 
  origin: ClientOrigin; // New field
  joinedDate: string; 
  tags: string[];
  notes: string;
  totalValue: number;
}

export type ProjectStatus = 'PROPOSAL' | 'QUOTING' | 'PRODUCTION' | 'READY' | 'COMPLETED' | 'CANCELLED';

// Nuevos estados específicos de taller
export type ProductionStep = 
  | 'ANTICIPO_PLANOS' 
  | 'COMPRA_MATERIALES' 
  | 'FABRICACION' 
  | 'LUSTRE' 
  | 'PREPARACION' 
  | 'LISTO';

export interface ProductionNote {
  id: string;
  content: string;
  date: string; // ISO or formatted string
  author: string;
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  status: ProjectStatus;
  productionStep?: ProductionStep; // Campo opcional nuevo
  stepDates?: Record<string, string>; // Nuevo: Mapa de fechas de inicio por etapa { 'FABRICACION': '12/05' }
  startDate?: string; // New field
  productionStartDate?: string; // Fecha especifica para calculo de tiempo en taller
  deadline: string;
  progress: number; // 0-100
  budget: number;
  tasksTotal: number;
  tasksCompleted: number;
  driveFolderUrl?: string; // New: Google Drive Link
  productionNotes?: ProductionNote[]; // New: Historical notes
  archiveReason?: string; // New: Reason for cancellation or final notes
  linkedTechnicalEstimateId?: string; // ID of the saved technical estimate for Workshop view
  dossier?: ProjectDossier; // NEW: Legajo del proyecto al finalizar
}

export interface ProjectDossier {
  generatedAt: string;
  summary: string;
  totalBudget: number;
  totalCost: number;
  profitability: number;
  keyDates: {
    start: string;
    end: string;
  };
  clientSnapshot: {
    name: string;
  };
}

export enum BudgetStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export interface BudgetItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  category: 'MATERIAL' | 'LABOR' | 'PROFIT';
}

export interface Budget {
  id: string;
  projectId: string;
  total: number;
  // New fields for financial tracking
  downPayment: number;
  downPaymentDate?: string;
  balance: number;
  balanceDate?: string;
  
  status: BudgetStatus;
  version: number;
  items: BudgetItem[];
  lastModified: string;
  isArchived?: boolean;
}

export interface Report {
  id: string;
  projectId: string;
  generatedDate: string; // ISO String
  observations: string;
  projectNameSnapshot: string; // To keep name even if project deleted
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  category: string; // e.g., 'Maderas', 'Herrajes', 'Marmoleria'
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'ARCHIVED';

export interface SupplierPayment {
  id: string;
  providerName: string;
  projectId?: string; // New field to link with Project
  concept: string; // Material/Service description
  downPayment: number;
  downPaymentDate: string;
  balance: number;
  balanceDate: string; // Fecha pago saldo
  totalAmount: number;
  status?: PaymentStatus; // New field for archiving
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  assignee: string; // Nombre del usuario o rol
  dueDate: string;
  completed: boolean;
  priority: TaskPriority;
  projectId?: string;
  createdBy?: string; // New field for author tracking
}

export type UserRole = 'administrador' | 'gerente_taller' | 'operario_taller';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string; 
  role: UserRole;
  status: UserStatus; // New field
  joinedDate: string; // New field
  avatarInitials: string;
}

// Data Context for AI and App State
export interface BusinessData {
  clients: Client[];
  projects: Project[];
  budgets: Budget[];
  suppliers: Supplier[]; // New field
  supplierPayments: SupplierPayment[]; 
  tasks: Task[];
  user: User;
}

export interface ChartData {
  name: string;
  value: number;
}

// --- COST ESTIMATOR TYPES ---

export type HingeType = 'COMMON' | 'PUSH' | 'SOFT_CLOSE';
export type SlideType = 'Z_TYPE' | 'TELESCOPIC' | 'TELESCOPIC_REINFORCED' | 'TELESCOPIC_SOFT' | 'TELESCOPIC_PUSH' | 'HIDDEN_METAL_SIDE';
export type FinishType = 'MELAMINE' | 'LACQUER_SEMI' | 'LACQUER_GLOSS' | 'LUSTRE_SEMI' | 'LUSTRE_GLOSS';

// Module Construction Type
export type ModuleType = 
  | 'MELAMINE_FULL'               // Melamina Completo
  | 'MELAMINE_STRUCT_LACQUER'     // Estructura Melamina - Frentes Laqueados
  | 'MELAMINE_STRUCT_VENEER'      // Estructura Melamina - Frentes Enchapados
  | 'LACQUER_FULL'                // Todo Laqueado
  | 'VENEER_FULL';                // Todo Enchapado

// NEW: Backing Type
export type BackingType = '3MM_WHITE' | '5.5MM_COLOR' | '18MM_STRUCTURE';

// NEW: Edge Type
export type EdgeCategory = 'PVC_045' | 'PVC_2MM';

export interface CostSettings {
  // PLACAS
  priceBoard18WhiteAglo: number;
  priceBoard18WhiteMDF: number;
  priceBoard18ColorAglo: number;
  priceBoard18ColorMDF: number;
  priceBoard18MDFCrudo1Face: number;
  priceBoard18VeneerMDF: number;
  priceBoard15WhiteAglo: number;
  priceBacking3White: number;
  priceBacking55Color: number;

  // TAPACANTOS
  priceEdge22White045: number;
  priceEdge45White045: number;
  priceEdge22Color045: number;
  priceEdge45Color045: number;
  priceEdge2mm: number;

  // HERRAJES
  priceHingeStandard: number;
  priceHingeSoftClose: number;
  priceHingePush: number;
  
  priceSlide300Std: number;
  priceSlide300Soft: number;
  priceSlide300Push: number;
  priceSlide400Std: number;
  priceSlide400Soft: number;
  priceSlide400Push: number;
  priceSlide500Std: number;
  priceSlide500Soft: number;
  priceSlide500Push: number;

  priceGasPiston: number;
  priceGlueTin: number;
  priceScrews: number; 

  // ACABADOS
  priceFinishLacquerSemi: number;
  priceFinishLacquerGloss: number;
  priceFinishLustreSemi: number;
  priceFinishLustreGloss: number;

  // MANO DE OBRA
  costLaborDay: number;
}

// NEW: History for Price Lists
export interface PriceListHistory {
    id: string;
    date: string;
    name: string;
    settings: CostSettings;
}

export interface CabinetModule {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  depth: number; // mm
  quantity: number; // How many of this module
  
  // Mixed Front Configuration
  cntDoors: number;   // Cantidad Puertas Abrir
  cntFlaps: number;   // Cantidad Puertas Abatibles
  cntDrawers: number; // Cantidad Cajones

  // Structure & Material
  moduleType: ModuleType; 
  isWhiteStructure: boolean; 
  materialColorName: string; 
  backingType: BackingType; 
  
  isMDFCore: boolean; // NEW: Si es true, usa Melamina MDF en lugar de Aglomerado

  // Edges
  edgeCategory: EdgeCategory; // NEW: Seleccion de tipo de tapacanto

  // Specifics
  hingeType?: HingeType;
  slideType?: SlideType;
  hasGasPistons: boolean; 

  // Calculated Internally
  parts?: CalculatedPart[];
}

export interface CalculatedPart {
  name: string;
  width: number;
  height: number;
  material: '18mm_Color' | '18mm_White' | '18mm_MDF' | '15mm_White' | '5.5mm_Color' | '3mm_White';
  quantity: number;
  grain?: 'horizontal' | 'vertical' | 'free';
}

export interface QuoteData {
  title: string;
  reference: string;
  id: string;
  observations?: string;
  conditions?: string;
  enabledScenarios: {
      white: boolean;
      textured: boolean;
      lacquer: boolean;
      veneer: boolean;
  };
}

export interface FinancialSnapshot {
  id?: string;
  name?: string;
  costMaterials: number;
  costHardware: number;
  costScrews: number;
  costLabor: number;
  costFinish: number;
  totalDirectCost: number;
  profitWorkshopValue: number;
  priceWorkshop: number;
  profitRodenValue: number;
  finalPrice: number;
}

export enum CommercialStatus {
    DRAFT = 'BORRADOR',
    SENT = 'ENVIADO',
    APPROVED = 'APROBADO',
    IN_PRODUCTION = 'EN_PRODUCCION',
    FINISHED = 'FINALIZADO',
    CANCELLED = 'CANCELADO'
}

export enum ProductionStatus {
    PENDING = 'PENDIENTE',
    CUTTING = 'CORTE',
    ASSEMBLY = 'ENSAMBLE',
    READY = 'LISTO'
}

export interface AuditEntry {
    from: string;
    to: string;
    timestamp: string;
    user: string;
}

export interface StatusHistoryEntry {
    status: BudgetStatus;
    date: string;
}

// NEW: Saved Estimate Snapshot (Single Source of Truth)
export interface SavedEstimate {
    id: string;
    projectId?: string;
    customProjectName?: string;
    date: string;
    type: 'TECHNICAL' | 'ECONOMIC';
    
    // Dual-Axis Status
    status?: BudgetStatus; // Legacy support
    commercialStatus?: CommercialStatus;
    productionStatus?: ProductionStatus;
    
    // Audit & Sync
    statusHistory?: StatusHistoryEntry[];
    auditLog?: AuditEntry[];
    isArchived?: boolean;
    isPublished?: boolean;
    lastPublishedAt?: string;
    hasTechnicalDefinition?: boolean;
    
    // Core Data
    modules: CabinetModule[];
    items?: any[];
    settingsSnapshot: CostSettings;
    priceListId?: string;
    priceListName?: string;
    finalTerminationScenario?: 'white' | 'textured' | 'lacquer' | 'veneer';
    financialsSnapshot?: FinancialSnapshot;
    totalDirectCost?: number;
    finalPrice?: number;
    version: number;
    parentId?: string;
    isLatest: boolean;
    quoteData?: QuoteData;
}

export enum ProductionOrderStatus {
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  FINISHED = 'FINISHED',
  DELIVERED = 'DELIVERED',
}

export interface ProductionOrder {
  id: string;
  projectId?: string; // NEW: Link to project
  orderNumber: number;
  budgetId?: string;
  clientId?: string;
  clientName: string;
  itemDescription: string;
  technicalDetails: any; // Using 'any' for now, will refine with specific types later if needed
  materialsList: any; // Using 'any' for now, will refine with specific types later if needed
  startDate: string; // ISO Date string
  estimatedDeliveryDate: string; // ISO Date string
  assignedOperators: string[];
  status: ProductionOrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'PRODUCTION' | 'CANCELLED' | 'FINISHED' | 'ARCHIVED';

export type EstimateItemType = 'MATERIAL' | 'LABOR' | 'PROFIT' | 'OTHER';

export interface EstimateItem {
  id: string;
  estimateId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemType: EstimateItemType;
  metadata?: any;
}

export interface Estimate {
  id: string;
  projectId?: string;
  priceListId?: string;
  title: string;
  description?: string;
  version: number;
  status: EstimateStatus;
  totalAmount: number;
  downPayment?: number;
  downPaymentDate?: string;
  balance?: number;
  balanceDate?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  items?: EstimateItem[];
}
