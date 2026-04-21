import { User, Client, Project, Budget, Supplier, SupplierPayment, Task } from './types';

export const MOCK_USER_ADMIN: User = {
  id: 'admin-1',
  email: 'admin@roden.com',
  name: 'Admin',
  role: 'administrador',
  status: 'ACTIVE',
  joinedDate: '2024-01-01',
  avatarInitials: 'AD'
};

export const MOCK_CLIENTS: Client[] = [];
export const MOCK_PROJECTS: Project[] = [];
export const MOCK_BUDGETS: Budget[] = [];
export const MOCK_SUPPLIERS: Supplier[] = [];
export const MOCK_SUPPLIER_PAYMENTS: SupplierPayment[] = [];
export const MOCK_TASKS: Task[] = [];

export const PAGE_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['administrador'],  // Solo admin ve dashboard
  projects: ['administrador', 'gerente_taller', 'operario_taller'],
  clients: ['administrador'],
  budgets: ['administrador'],
  production: ['administrador', 'gerente_taller', 'operario_taller'],
  tasks: ['administrador', 'gerente_taller', 'operario_taller'],
  suppliers: ['administrador', 'gerente_taller'],  // Gerente: solo proveedor "Taller"
  reports: ['administrador', 'gerente_taller', 'operario_taller'],
  staff: ['administrador'],
  settings: ['administrador'],
  archive: ['administrador'],
  estimator: ['administrador'],
  ai: ['administrador']
};
