// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';

export interface AppNotification {
  id: string;
  createdAt: string;
  fromUserId: string | null;
  fromUserName: string | null;
  toRole: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  entityType: string | null;
  entityPage: string | null;
  readBy: string[];
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const FETCH_LIMIT = 50; // últimas 50 notificaciones

export function useNotifications(currentUser: User | null): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Normalizar fila de DB → AppNotification ──
  const fromDB = (row: any): AppNotification => ({
    id:           row.id,
    createdAt:    row.createdAt,
    fromUserId:   row.fromUserId,
    fromUserName: row.fromUserName,
    toRole:       row.toRole,
    type:         row.type,
    title:        row.title,
    body:         row.body,
    entityId:     row.entityId,
    entityType:   row.entityType,
    entityPage:   row.entityPage ?? row.entitypage ?? null,
    readBy:       Array.isArray(row.readBy) ? row.readBy : [],
  });

  // ── Cargar historial inicial ──
  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`toRole.eq.all,toRole.eq.${currentUser.role}`)
        .order('createdAt', { ascending: false })
        .limit(FETCH_LIMIT);

      if (error) {
        console.warn('[useNotifications] Error al cargar:', error.message);
        return;
      }
      console.log('[useNotifications] datos recibidos:', data?.length, data?.[0]);
      setNotifications((data ?? []).map(fromDB));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // ── Suscripción Realtime ──
  useEffect(() => {
    if (!currentUser) return;

    fetchNotifications();

    // Limpiar canal anterior si existe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('notifications-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = fromDB(payload.new);
          // Filtrar solo las que corresponden al rol del usuario actual
          if (newNotif.toRole === 'all' || newNotif.toRole === currentUser.role) {
            setNotifications((prev) => [newNotif, ...prev].slice(0, FETCH_LIMIT));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          // Actualizar readBy cuando otra instancia marca como leída
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? fromDB(payload.new) : n))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, fetchNotifications]);

  // ── Marcar una como leída ──
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!currentUser) return;

    const notif = notifications.find((n) => n.id === notificationId);
    if (!notif || notif.readBy.includes(currentUser.id)) return; // ya estaba leída

    const newReadBy = [...notif.readBy, currentUser.id];

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, readBy: newReadBy } : n))
    );

    const { error } = await supabase
      .from('notifications')
      .update({ readBy: newReadBy })
      .eq('id', notificationId);

    if (error) {
      console.warn('[useNotifications] Error al marcar como leída:', error.message);
      // Revertir optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readBy: notif.readBy } : n))
      );
    }
  }, [notifications, currentUser]);

  // ── Marcar todas como leídas ──
  const markAllAsRead = useCallback(async () => {
    if (!currentUser) return;

    const unread = notifications.filter((n) => !n.readBy.includes(currentUser.id));
    if (unread.length === 0) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.readBy.includes(currentUser.id)
          ? n
          : { ...n, readBy: [...n.readBy, currentUser.id] }
      )
    );

    // Actualizar en paralelo
    await Promise.all(
      unread.map((n) =>
        supabase
          .from('notifications')
          .update({ readBy: [...n.readBy, currentUser.id] })
          .eq('id', n.id)
      )
    );
  }, [notifications, currentUser]);

  // ── Calcular no leídas para este usuario ──
  const unreadCount = notifications.filter(
    (n) => currentUser && !n.readBy.includes(currentUser.id)
  ).length;

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
}
