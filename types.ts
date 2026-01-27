
export type ClientStatus = 'LEAD' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type ClientType = 'INDIVIDUAL' | 'COMPANY';
export type ClientOrigin = 'REFERRAL' | 'ORGANIC' | 'SOCIAL_MEDIA' | 'WEBSITE';

export interface Client {
  id: string;
  name: string;
  email: string;
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

export type ProjectStatus = 'PROPOSAL' | 'QUOTING' | 'PRODUCTION' | 'READY' | 'COMPLETED';

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
}

export type BudgetStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';

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
}

export type UserRole = 'ADMIN' | 'USER' | 'WORKSHOP_MANAGER';
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
