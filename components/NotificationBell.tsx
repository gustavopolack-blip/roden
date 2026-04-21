// src/components/NotificationBell.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, X, ClipboardList, FolderKanban, Hammer, CheckSquare, ArrowRight } from 'lucide-react';
import { useNotifications, AppNotification } from '../utils/useNotifications';
import { User } from '../types';

interface NotificationBellProps {
  currentUser: User | null;
}

// ── Ícono según entityType ──
const EntityIcon: React.FC<{ entityType: string | null }> = ({ entityType }) => {
  const cls = 'shrink-0';
  if (entityType === 'production_order') return <ClipboardList size={14} className={cls} />;
  if (entityType === 'project' || entityType === 'workshop') return <Hammer size={14} className={cls} />;
  if (entityType === 'task') return <CheckSquare size={14} className={cls} />;
  return <FolderKanban size={14} className={cls} />;
};

// ── Color del punto según tipo de evento ──
const dotColor = (type: string): string => {
  if (type.startsWith('production_order')) return 'bg-blue-500';
  if (type.startsWith('project'))          return 'bg-amber-500';
  if (type.startsWith('task'))             return 'bg-emerald-500';
  if (type.startsWith('workshop'))         return 'bg-violet-500';
  return 'bg-gray-400';
};

// ── Formatear fecha relativa ──
const relativeTime = (isoDate: string): string => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'ahora mismo';
  if (mins < 60)  return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7)   return `hace ${days}d`;
  return new Date(isoDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

// ── Fila individual de notificación ──
const NotifRow: React.FC<{
  notif: AppNotification;
  isRead: boolean;
  onRead: (id: string) => void;
  onClose: () => void;
}> = ({ notif, isRead, onRead, onClose }) => {
  const navigate = useNavigate();
  return (
  <button
    onClick={() => {
      if (!isRead) onRead(notif.id);
      if (notif.entityPage) {
        navigate('/' + notif.entityPage);
        onClose();
      }
    }}
    className={`w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-gray-50 ${
      isRead ? 'opacity-60' : 'bg-white'
    } ${notif.entityPage ? 'cursor-pointer' : ''}`}
  >
    {/* Punto de color */}
    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-gray-300' : dotColor(notif.type)}`} />

    {/* Contenido */}
    <div className="flex-1 min-w-0">
      <div className="flex items-start gap-2">
        <EntityIcon entityType={notif.entityType} />
        <p className={`text-xs leading-snug ${isRead ? 'text-gray-400' : 'text-gray-800 font-medium'}`}>
          {notif.title}
        </p>
      </div>
      {notif.body && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate">{notif.body}</p>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-gray-400">{relativeTime(notif.createdAt)}</span>
        {notif.fromUserName && (
          <span className="text-[10px] text-gray-400">· {notif.fromUserName}</span>
        )}
        {notif.entityPage && (
          <span className="ml-auto flex items-center gap-0.5 text-[10px] text-indigo-500 font-medium">
            Ir <ArrowRight size={10} />
          </span>
        )}
      </div>
    </div>
  </button>
  );
};

// ── Componente principal ──
const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(currentUser);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (!currentUser) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-roden-black hover:bg-gray-300 transition-colors"
        title="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel desplegable */}
      {isOpen && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-[200] overflow-hidden animate-fade-in">
          {/* Header del panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-800">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck size={12} />
                  Todas leídas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
            {isLoading && (
              <div className="py-8 text-center text-xs text-gray-400">Cargando...</div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">Sin notificaciones</p>
              </div>
            )}
            {!isLoading && notifications.map((notif) => (
              <NotifRow
                key={notif.id}
                notif={notif}
                isRead={notif.readBy.includes(currentUser.id)}
                onRead={markAsRead}
                onClose={() => setIsOpen(false)}
              />
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-center">
              <p className="text-[10px] text-gray-400">
                Últimas {notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
