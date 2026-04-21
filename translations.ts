/**
 * translations.ts
 * 
 * Sistema de traducciones centralizado para rødën OS
 * Mantiene la DB en inglés pero muestra todo en español argentino en la UI
 */

import { ProjectStatus, ClientType, ClientOrigin, TaskPriority, ProductionStep } from './types';

// Tipos locales para valores que no están exportados desde types.ts
type ClientStatus = 'ACTIVE' | 'LEAD' | 'INACTIVE';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

// ============================================================
// ESTADOS DE PROYECTO
// ============================================================
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  LEAD: 'Prospecto',
  PROPOSAL: 'Propuesta',
  QUOTING: 'Presupuestando',
  IN_PROGRESS: 'En Curso',
  PRODUCTION: 'En Producción',
  READY: 'Listo para Entregar',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado'
};

export function translateProjectStatus(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status] || status;
}

// ============================================================
// ESTADOS DE CLIENTE
// ============================================================
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: 'Potencial',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo'
};

export function translateClientStatus(status: ClientStatus): string {
  return CLIENT_STATUS_LABELS[status] || status;
}

// ============================================================
// TIPOS DE CLIENTE
// ============================================================
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: 'Particular',
  COMPANY: 'Empresa'
};

export function translateClientType(type: ClientType): string {
  return CLIENT_TYPE_LABELS[type] || type;
}

// ============================================================
// ORIGEN DE CLIENTE
// ============================================================
export const CLIENT_ORIGIN_LABELS: Record<ClientOrigin, string> = {
  REFERRAL: 'Referido',
  SOCIAL_MEDIA: 'Redes Sociales',
  ORGANIC: 'Orgánico',
  WEBSITE: 'Sitio Web',
  OTHER: 'Otro'
};

export function translateClientOrigin(origin: ClientOrigin): string {
  return CLIENT_ORIGIN_LABELS[origin] || origin;
}

// ============================================================
// PRIORIDADES DE TAREA
// ============================================================
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja'
};

export function translateTaskPriority(priority: TaskPriority): string {
  return TASK_PRIORITY_LABELS[priority] || priority;
}

// ============================================================
// ESTADOS DE TAREA
// ============================================================
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Pendiente',
  IN_PROGRESS: 'En Curso',
  DONE: 'Completada'
};

export function translateTaskStatus(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] || status;
}

// ============================================================
// ETAPAS DE PRODUCCIÓN (ya están en español, pero por consistencia)
// ============================================================
export const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
  ANTICIPO_PLANOS: 'Anticipo y Planos',
  COMPRA_MATERIALES: 'Compra de Materiales',
  FABRICACION: 'Fabricación',
  LUSTRE: 'Lustre',
  PREPARACION: 'Preparación',
  LISTO: 'Listo'
};

export function translateProductionStep(step: ProductionStep): string {
  return PRODUCTION_STEP_LABELS[step] || step;
}

// ============================================================
// HELPER: Obtener color por estado de proyecto
// ============================================================
export function getProjectStatusColor(status: ProjectStatus): {
  text: string;
  bg: string;
  border: string;
} {
  const colors = {
    PROPOSAL: { text: 'text-violet-700', bg: 'bg-violet-100', border: 'border-violet-200' },
    QUOTING: { text: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' },
    PRODUCTION: { text: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' },
    READY: { text: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
    COMPLETED: { text: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' },
    CANCELLED: { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' }
  };
  
  return colors[status] || { text: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' };
}

// ============================================================
// HELPER: Obtener color por prioridad de tarea
// ============================================================
export function getTaskPriorityColor(priority: TaskPriority): {
  text: string;
  bg: string;
  border: string;
} {
  const colors = {
    HIGH: { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' },
    MEDIUM: { text: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' },
    LOW: { text: 'text-blue-700', bg: 'bg-blue-100', border: 'border-blue-200' }
  };
  
  return colors[priority] || { text: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200' };
}

// ============================================================
// ARRAYS PARA DROPDOWNS/SELECTS
// ============================================================

export const PROJECT_STATUS_OPTIONS = [
  { value: 'LEAD', label: 'Prospecto' },
  { value: 'PROPOSAL', label: 'Propuesta' },
  { value: 'QUOTING', label: 'Presupuestando' },
  { value: 'IN_PROGRESS', label: 'En Curso' },
  { value: 'PRODUCTION', label: 'En Producción' },
  { value: 'READY', label: 'Listo para Entregar' },
  { value: 'COMPLETED', label: 'Finalizado' },
  { value: 'CANCELLED', label: 'Cancelado' }
];

export const CLIENT_STATUS_OPTIONS = [
  { value: 'LEAD', label: 'Potencial' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' }
];

export const CLIENT_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Particular' },
  { value: 'COMPANY', label: 'Empresa' }
];

export const CLIENT_ORIGIN_OPTIONS = [
  { value: 'REFERRAL', label: 'Referido' },
  { value: 'SOCIAL_MEDIA', label: 'Redes Sociales' },
  { value: 'ORGANIC', label: 'Orgánico' },
  { value: 'WEBSITE', label: 'Sitio Web' },
  { value: 'OTHER', label: 'Otro' }
];

export const TASK_PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Baja' }
];

export const PRODUCTION_STEP_OPTIONS = [
  { value: 'ANTICIPO_PLANOS', label: 'Anticipo y Planos' },
  { value: 'COMPRA_MATERIALES', label: 'Compra de Materiales' },
  { value: 'FABRICACION', label: 'Fabricación' },
  { value: 'LUSTRE', label: 'Lustre' },
  { value: 'PREPARACION', label: 'Preparación' },
  { value: 'LISTO', label: 'Listo' }
];

// ============================================================
// ESTADOS DE PRESUPUESTO (Estimate)
// ============================================================
export const ESTIMATE_STATUS_LABELS: Record<string, string> = {
  DRAFT:    'Borrador',
  SENT:     'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  EXPIRED:  'Vencido'
};

export function translateEstimateStatus(status: string): string {
  return ESTIMATE_STATUS_LABELS[status] || status;
}

export const ESTIMATE_STATUS_OPTIONS = [
  { value: 'DRAFT',    label: 'Borrador' },
  { value: 'SENT',     label: 'Enviado' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'EXPIRED',  label: 'Vencido' }
];

// ============================================================
// ESTADOS DE ORDEN DE PRODUCCIÓN
// ============================================================
export const PRODUCTION_ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendiente',
  IN_PROCESS:  'En Curso',
  FINISHED:    'Terminada',
  PAUSED:      'Pausada',
  CANCELLED:   'Cancelada'
};

export function translateProductionOrderStatus(status: string): string {
  return PRODUCTION_ORDER_STATUS_LABELS[status] || status;
}

export const PRODUCTION_ORDER_STATUS_OPTIONS = [
  { value: 'PENDING',    label: 'Pendiente' },
  { value: 'IN_PROCESS', label: 'En Curso' },
  { value: 'FINISHED',   label: 'Terminada' },
  { value: 'PAUSED',     label: 'Pausada' },
  { value: 'CANCELLED',  label: 'Cancelada' }
];
