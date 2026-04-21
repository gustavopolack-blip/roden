// src/utils/notificationHelpers.ts
// Una sola función para emitir notificaciones desde cualquier handler.
// No lanza errores al componente — falla silenciosamente para no
// interrumpir la operación principal si hay un problema de red.

import { supabase } from '../services/supabaseClient';
import { User } from '../types';

export type NotificationType =
  | 'task.created'
  | 'task.deleted'
  | 'project.status_changed'
  | 'project.step_changed'
  | 'project.note_added'
  | 'production_order.created'
  | 'production_order.updated'
  | 'workshop.project_added';

export type NotificationEntityType =
  | 'task'
  | 'project'
  | 'production_order'
  | 'workshop';

export type NotificationRole =
  | 'all'
  | 'administrador'
  | 'gerente_taller'
  | 'operario_taller';

interface EmitOptions {
  type: NotificationType;
  title: string;
  body?: string;
  entityId?: string;
  entityType?: NotificationEntityType;
  entityPage?: string;
  toRole?: NotificationRole;
  fromUser?: User | null;
}

export async function emitNotification(opts: EmitOptions): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert({
      type:         opts.type,
      title:        opts.title,
      body:         opts.body ?? null,
      entityId:     opts.entityId ?? null,
      entityType:   opts.entityType ?? null,
      entityPage:   opts.entityPage ?? null,
      toRole:       opts.toRole ?? 'all',
      fromUserId:   opts.fromUser?.id ?? null,
      fromUserName: opts.fromUser?.name ?? null,
      readBy:       [],
    });

    if (error) {
      // Log pero no relanza — la operación principal ya fue exitosa
      console.warn('[notificationHelpers] Error al emitir notificación:', error.message);
    }
  } catch (err) {
        console.warn('[notificationHelpers] Error inesperado:', err);
  }
}
