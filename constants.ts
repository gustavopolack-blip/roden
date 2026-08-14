import { User, Client, Project, Budget, Supplier, SupplierPayment, Task, ProjectStatus } from './types';

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
  ai: ['administrador'],
  marketing: ['administrador']  // Solo admin: leads, recompra y piezas de difusión
};

// Obras "activas": las que la página Proyectos muestra por defecto (PROJECT_GROUPS,
// con showCompleted = false). Sobre estas se pueden imputar movimientos de dinero:
// cobranzas en Finanzas y pagos a proveedores en Proveedores.
// Quedan afuera COMPLETED y CANCELLED, que es el grupo "ARCHIVADO / FINALIZADO".
// QUOTING está incluido a propósito: la seña se cobra con el presupuesto enviado,
// antes de que la obra pase a PRODUCTION.
// READY también: Production mueve la obra a READY al completar el último paso,
// y el saldo final se cobra recién en la entrega.
export const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ['PROPOSAL', 'QUOTING', 'PRODUCTION', 'READY'];
