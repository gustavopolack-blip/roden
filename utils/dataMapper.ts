/**
 * utils/dataMapper.ts
 *
 * Capa de traducción entre snake_case (Supabase/PostgreSQL) y camelCase (TypeScript).
 *
 * PROBLEMA que resuelve:
 *   La DB usa snake_case (client_id, start_date, joined_date).
 *   Los tipos TS usan camelCase (clientId, startDate, joinedDate).
 *   Sin este mapper, los INSERT/UPDATE pierden datos silenciosamente
 *   porque Supabase ignora campos que no corresponden a columnas reales.
 *
 * USO:
 *   // Al leer de DB → frontend:
 *   const projects = data.map(projectFromDB);
 *
 *   // Al escribir frontend → DB:
 *   await supabase.from('projects').insert(projectToDB(newProject));
 */

import { Project, User, Task, Client, SupplierPayment, Report, Supplier, Budget } from '../types';

// ============================================================
// BUDGETS
// ============================================================

export function budgetFromDB(row: any): Budget {
  return {
    id:           row.id,
    projectId:    row.project_id,
    amount:       row.amount,
    status:       row.status,
    date:         row.date,
    lastModified: row.last_modified,
    total:        row.total ?? row.amount,
  };
}

export function budgetToDB(b: Omit<Budget, 'id'> & { id?: string }): any {
  const row: any = {
    project_id:    b.projectId,
    amount:        b.amount,
    status:        b.status,
    date:          b.date,
    last_modified: b.lastModified,
    total:         b.total ?? b.amount,
  };
  if (b.id && !b.id.startsWith('b')) row.id = b.id;
  return row;
}

export function projectFromDB(row: any): Project {
  return {
    id:                   row.id,
    clientId:             row.client_id,
    title:                row.title,
    status:               row.status,
    progress:             row.progress ?? 0,
    budget:               row.budget ?? 0,
    deadline:             row.deadline,
    startDate:            row.start_date,
    productionStartDate:  row.production_start_date,
    productionStep:       row.production_step,
    stepDates:            row.step_dates ?? {},
    tasksTotal:           row.tasks_total ?? 0,
    tasksCompleted:       row.tasks_completed ?? 0,
    driveFolderUrl:       row.drive_folder_url,
    productionNotes:      row.production_notes ?? [],
    archiveReason:        row.archive_reason,
    dossier:              row.dossier,
    linkedTechnicalEstimateId: row.linked_technical_estimate_id,
  };
}

export function projectToDB(p: Omit<Project, 'id'> & { id?: string }): any {
  const row: any = {
    client_id:              p.clientId,
    title:                  p.title,
    status:                 p.status,
    progress:               p.progress ?? 0,
    budget:                 p.budget ?? 0,
    deadline:               p.deadline || null,
    start_date:             p.startDate || null,
    production_start_date:  p.productionStartDate || null,
    production_step:        p.productionStep ?? null,
    step_dates:             p.stepDates ?? null,
    tasks_total:            p.tasksTotal ?? 0,
    tasks_completed:        p.tasksCompleted ?? 0,
    drive_folder_url:       p.driveFolderUrl || null,
    production_notes:       p.productionNotes ?? null,
    archive_reason:         p.archiveReason || null,
    dossier:                p.dossier ?? null,
  };
  if (p.id) row.id = p.id;
  return row;
}

// ============================================================
// USERS
// ============================================================

export function userFromDB(row: any): User {
  return {
    id:               row.id,
    email:            row.email,
    name:             row.name,
    phone:            row.phone,
    role:             row.role,
    status:           row.status ?? 'ACTIVE',
    joinedDate:       row.joined_date,
    avatarInitials:   row.avatar_initials,
  };
}

export function userToDB(u: Omit<User, 'id'> & { id?: string }): any {
  const row: any = {
    email:            u.email,
    name:             u.name,
    phone:            u.phone ?? null,
    role:             u.role,
    status:           u.status ?? 'ACTIVE',
    joined_date:      u.joinedDate ?? null,
    avatar_initials:  u.avatarInitials ?? null,
  };
  if (u.id) row.id = u.id;
  return row;
}

// ============================================================
// TASKS
// ============================================================

export function taskFromDB(row: any): Task {
  return {
    id:           row.id,
    projectId:    row.project_id,
    title:        row.title,
    description:  row.description,
    status:       row.completed ? 'DONE' : 'TODO',
    assigneeId:   row.assignee,
    dueDate:      row.due_date,
    priority:     row.priority,
  };
}

export function taskToDB(t: Omit<Task, 'id'> & { id?: string }): any {
  const row: any = {
    project_id: t.projectId,
    title:      t.title,
    assignee:   t.assigneeId ?? null,
    due_date:   t.dueDate ?? null,
    completed:  t.status === 'DONE',
    priority:   t.priority ?? 'MEDIUM',
  };
  if (t.id) row.id = t.id;
  return row;
}

// ============================================================
// CLIENTS
// ============================================================

export function clientFromDB(row: any): Client {
  return {
    id:           row.id,
    name:         row.name,
    phone:        row.phone ?? '',
    address:      row.address ?? '',
    status:       row.status ?? 'LEAD',
    type:         row.type ?? 'INDIVIDUAL',
    origin:       row.origin ?? 'OTHER',
    joined_date:  row.joined_date,
    tags:         row.tags ?? [],
    notes:        row.notes ?? '',
    totalValue:   row.total_value ?? 0,
  };
}

export function clientToDB(c: Omit<Client, 'id'> & { id?: string }): any {
  const row: any = {
    name:         c.name,
    phone:        c.phone ?? null,
    address:      c.address ?? null,
    status:       c.status ?? 'LEAD',
    type:         c.type ?? 'INDIVIDUAL',
    origin:       c.origin ?? 'OTHER',
    joined_date:  c.joined_date ?? null,
    tags:         c.tags ?? null,
    notes:        c.notes ?? null,
    total_value:  c.totalValue ?? 0,
  };
  if (c.id) row.id = c.id;
  return row;
}

// ============================================================
// SUPPLIER PAYMENTS
// ============================================================

export function supplierPaymentFromDB(row: any): SupplierPayment {
  return {
    id:               row.id,
    supplierId:       row.provider_name, 
    projectId:        row.project_id,
    amount:           row.down_payment ?? 0,
    totalAmount:      row.total_amount,
    date:             row.down_payment_date ?? row.created_at,
    status:           row.status ?? 'PENDING',
    providerName:     row.provider_name,
    concept:          row.concept,
    balance:          row.balance ?? 0,
    downPayment:      row.down_payment ?? 0,
    downPaymentDate:  row.down_payment_date,
    balanceDate:      row.balance_date,
  };
}

export function supplierPaymentToDB(sp: Omit<SupplierPayment, 'id'> & { id?: string }): any {
  const row: any = {
    provider_name:       sp.providerName ?? sp.supplierId,
    project_id:          sp.projectId ?? null,
    concept:             sp.concept ?? null,
    down_payment:        sp.downPayment ?? sp.amount ?? 0,
    down_payment_date:   sp.downPaymentDate ?? sp.date ?? null,
    balance:             sp.balance ?? 0,
    balance_date:        sp.balanceDate ?? null,
    total_amount:        sp.totalAmount ?? (Number(sp.downPayment || 0) + Number(sp.balance || 0)),
    status:              sp.status ?? 'PENDING',
  };
  if (sp.id && !sp.id.startsWith('sp')) row.id = sp.id;
  return row;
}

// ============================================================
// SUPPLIERS
// ============================================================

export function supplierFromDB(row: any): Supplier {
  return {
    id:           row.id,
    name:         row.name,
    contactName:  row.contact_name,
    phone:        row.phone ?? '',
    email:        row.email ?? '',
    category:     row.category ?? '',
  };
}

export function supplierToDB(s: Omit<Supplier, 'id'> & { id?: string }): any {
  const row: any = {
    name:         s.name,
    contact_name: s.contactName ?? s.contact ?? null,
    phone:        s.phone ?? null,
    email:        s.email ?? null,
    category:     s.category ?? null,
  };
  if (s.id && !s.id.startsWith('s')) row.id = s.id;
  return row;
}

export function reportFromDB(row: any): Report {
  return {
    id:                   row.id,
    title:                row.title,
    date:                 row.date,
    content:              row.content,
    projectId:            row.project_id,
    observations:         row.observations,
    generatedDate:        row.generated_date,
    projectNameSnapshot:  row.project_name_snapshot,
  };
}

export function reportToDB(r: Omit<Report, 'id'> & { id?: string }): any {
  const row: any = {
    title:                r.title,
    date:                 r.date,
    content:              r.content,
    project_id:           r.projectId,
    observations:         r.observations,
    generated_date:       r.generatedDate,
    project_name_snapshot: r.projectNameSnapshot,
  };
  if (r.id && !r.id.startsWith('rep')) row.id = r.id;
  return row;
}
