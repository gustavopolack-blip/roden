export enum BudgetStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum CommercialStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  FINISHED = 'FINISHED'
}

export enum ProductionStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  CUTTING = 'CUTTING',
  ASSEMBLY = 'ASSEMBLY',
  IN_PRODUCTION = 'IN_PRODUCTION',
  COMPLETED = 'COMPLETED'
}

export interface AuditEntry {
  id: string;
  action: string;
  date: string;
  user: string;
}

export interface CostSettings {
  id?: string;
  [key: string]: any;
}

export interface Layer1_Technical {
  surfaceBodyM2: number;
  surfaceFrontsM2: number;
  linearEdgesM: number;
  baseLaborDays: number;
}

export interface Layer3_TechnicalCost {
  costMaterials: number;
  costHardware: number;
  costLabor: number;
  costFinish: number;
  totalDirectCost: number;
  complexityFactor: number;
  realLaborDays: number;
}

export interface Layer4_Commercial {
  priceWorkshop: number;
  grossMarginValue: number;
  finalPrice: number;
}

export interface ModuleGeometry {
  width: number;
  height: number;
  depth: number;
}

export interface ModuleComponents {
  doors: number;
  drawers: number;
  shelves: number;
  flaps: number;
  [key: string]: any;
}

export interface CostModule {
  id: string;
  name: string;
  geometry: ModuleGeometry;
  components: ModuleComponents;
  materials: MaterialConfig;
  technical?: Layer1_Technical;
  costs?: Layer3_TechnicalCost;
  commercial?: Layer4_Commercial;
  quantity?: number;
}

export interface MaterialConfig {
  bodyMaterial: string;
  frontsMaterial: string;
  structureCore: string;
  frontsCore: string;
  [key: string]: any;
}

export interface CommercialConfig {
  marginWorkshop: number;
  marginCommercial: number;
  [key: string]: any;
}

export interface CostSnapshot {
  priceBoard18WhiteAglo: number;
  priceBoard18WhiteMDF: number;
  priceBoard18ColorAglo: number;
  priceBoard18ColorMDF: number;
  priceHardwareDoor: number;
  priceHardwareDrawer: number;
  priceHardwareFlap: number;
  priceLaborDay: number;
  priceLacquerM2: number;
  priceVeneerM2: number;
  currency?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface CabinetModule {
  id: string;
  [key: string]: any;
}

export interface CalculatedPart {
  id?: string;
  [key: string]: any;
}

export type ModuleType = any;
export type PriceListHistory = any;
export type EdgeCategory = any;

export type UserRole = 'administrador' | 'gerente_taller' | 'operario_taller' | 'vendedor' | 'cliente';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type ClientType = 'INDIVIDUAL' | 'COMPANY';
export type ClientOrigin = 'REFERRAL' | 'SOCIAL_MEDIA' | 'ORGANIC' | 'WEBSITE' | 'OTHER';
export type ProjectStatus = 'LEAD' | 'PROPOSAL' | 'QUOTING' | 'READY' | 'IN_PROGRESS' | 'PRODUCTION' | 'COMPLETED' | 'CANCELLED';
export type ProductionStep = 'ANTICIPO_PLANOS' | 'COMPRA_MATERIALES' | 'FABRICACION' | 'LUSTRE' | 'PREPARACION' | 'LISTO';
export enum ProductionOrderStatus {
  PENDING = 'PENDING',
  IN_PROCESS = 'IN_PROCESS',
  FINISHED = 'FINISHED'
}
export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'PRODUCTION';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProductionNote {
  id: string;
  content: string;
  date: string;
  author: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  joinedDate: string;
  avatarInitials: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  status: 'ACTIVE' | 'LEAD' | 'INACTIVE';
  type: ClientType;
  origin: ClientOrigin;
  joined_date: string;
  tags?: string[];
  notes?: string;
  totalValue?: number;
}

export interface ProjectDossier {
  generatedAt: string;
  summary: string;
  totalBudget: number;
  totalCost: number;
  profitability: number;
  keyDates: { start: string; end: string };
  clientSnapshot: { name: string };
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  status: ProjectStatus;
  progress: number;
  budget?: number;
  deadline?: string;
  startDate?: string;
  dossier?: ProjectDossier;
  linkedTechnicalEstimateId?: string;
  productionStep?: ProductionStep;
  productionNotes?: ProductionNote[];
  archiveReason?: string;
  driveFolderUrl?: string;
  stepDates?: any;
  tasksTotal?: number;
  tasksCompleted?: number;
  productionStartDate?: string;
}

export interface Budget {
  id: string;
  projectId: string;
  amount: number;
  status: EstimateStatus;
  date: string;
  lastModified?: string;
  total?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  contactName?: string;
  phone: string;
  email?: string;
  category: string;
}

export interface SupplierPayment {
  id: string;
  supplierId?: string;
  projectId?: string;
  amount?: number;
  totalAmount?: number;
  date?: string;
  status: 'PENDING' | 'PAID' | 'ARCHIVED';
  providerName?: string;
  concept?: string;
  balance?: number;
  downPayment?: number;
  downPaymentDate?: string;
  balanceDate?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assigneeId?: string;
  assignee?: string;
  dueDate?: string;
  priority?: TaskPriority;
  completed?: boolean;
  createdBy?: string;
}

export interface Report {
  id: string;
  title: string;
  date: string;
  content: string;
  projectId?: string;
  observations?: string;
  generatedDate?: string;
  projectNameSnapshot?: string;
}

export interface SavedEstimate {
  id: string;
  projectId?: string | null;
  type: 'TECHNICAL' | 'COMMERCIAL' | 'ECONOMIC';
  data?: any;
  createdAt?: string;
  items?: any[];
  modules?: any[];
  finalTerminationScenario?: any;
  customProjectName?: string;
  date?: string;
  version?: number;
  auditLog?: any[];
  commercialStatus?: CommercialStatus;
  productionStatus?: ProductionStatus;
  settingsSnapshot?: any;
  finalPrice?: number;
  quoteData?: any;
  priceListId?: string;
  priceListName?: string;
  isArchived?: boolean;
  isLatest?: boolean;
  statusHistory?: any[];
  isPublished?: boolean;
  financialsSnapshot?: any;
  status?: string;
  totalDirectCost?: number;
  parentId?: string;
  lastPublishedAt?: string;
  hasTechnicalDefinition?: boolean;
}

export interface Estimate {
  id: string;
  projectId: string;
  priceListId?: string;
  title: string;
  description?: string;
  downPayment?: number;
  downPaymentDate?: string;
  balance?: number;
  balanceDate?: string;
  totalAmount: number;
  version?: number;
  status: EstimateStatus;
  type?: string;
  items?: any;
  costSummary?: any;
  legacyId?: string;
  migrationSource?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface ProductionOrder {
  id: string;
  projectId: string;
  status: ProductionOrderStatus;
  details: string;
  createdAt: string;
  updatedAt?: string;
  orderNumber?: string;
  clientName?: string;
  itemDescription?: string;
  estimatedDeliveryDate?: string;
  assignedOperators?: string[];
  technicalDetails?: string;
  startDate?: string;
}

export interface BusinessData {
  clients: Client[];
  projects: Project[];
  budgets: Budget[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  tasks: Task[];
  user: User;
}
