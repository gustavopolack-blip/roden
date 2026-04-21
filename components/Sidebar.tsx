
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderKanban, Calculator, Hammer, Sparkles,
  Settings, CheckSquare, ShieldCheck, LogOut, Truck, FileText,
  Maximize2, Minimize2, X, Archive, ClipboardList, Moon, Sun,
} from 'lucide-react';
import { User, UserRole } from '../types';
import NotificationBell from './NotificationBell';
import { PAGE_PERMISSIONS } from '../constants';

interface SidebarProps {
  user: User;
  onToggleRole: () => void;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user, onToggleRole, onLogout, isOpen = false, onClose,
  isDark = false, onToggleDark,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasAccess = (roles: string[]) => roles.includes(user.role);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen && document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const menuItems = [
    { path: '/',           label: 'Panel de Control',  icon: LayoutDashboard, allowed: PAGE_PERMISSIONS.dashboard  },
    { path: '/clients',    label: 'Clientes',           icon: Users,           allowed: PAGE_PERMISSIONS.clients    },
    { path: '/projects',   label: 'Proyectos',          icon: FolderKanban,    allowed: PAGE_PERMISSIONS.projects   },
    { path: '/estimator',  label: 'Estimador Costos',   icon: ClipboardList,   allowed: PAGE_PERMISSIONS.estimator  },
    { path: '/production', label: 'Taller',             icon: Hammer,          allowed: PAGE_PERMISSIONS.production },
    { path: '/tasks',      label: 'Tareas',             icon: CheckSquare,     allowed: PAGE_PERMISSIONS.tasks      },
    { path: '/archive',    label: 'Archivo',            icon: Archive,         allowed: PAGE_PERMISSIONS.archive    },
    { path: '/reports',    label: 'Informes',           icon: FileText,        allowed: PAGE_PERMISSIONS.reports    },
    { path: '/budgets',    label: 'Finanzas',           icon: Calculator,      allowed: PAGE_PERMISSIONS.budgets    },
    { path: '/suppliers',  label: 'Proveedores',        icon: Truck,           allowed: PAGE_PERMISSIONS.suppliers  },
    { path: '/ai',         label: 'Inteligencia roden', icon: Sparkles,        allowed: PAGE_PERMISSIONS.ai         },
    { path: '/staff',      label: 'Personal',           icon: ShieldCheck,     allowed: PAGE_PERMISSIONS.staff      },
  ];

  // Class helpers — no [#hex] values to avoid TS JSX parser edge cases
  const asideCls    = isDark ? 'bg-neutral-900 border-neutral-800'       : 'bg-gray-200 border-roden-border';
  const titleCls    = isDark ? 'text-white'                               : 'text-roden-black';
  const subtitleCls = isDark ? 'text-neutral-600'                        : 'text-roden-gray';
  const closeCls    = isDark ? 'text-neutral-500 hover:text-white'        : 'text-gray-400 hover:text-gray-700';

  const navActive   = isDark ? 'bg-white text-neutral-900 font-semibold'              : 'bg-roden-black text-white font-semibold shadow-md';
  const navInactive = isDark ? 'text-neutral-500 hover:text-white hover:bg-white/10'  : 'text-gray-500 hover:text-roden-black hover:bg-gray-300';
  const iconAct     = isDark ? 'text-neutral-900'                                      : 'text-white';
  const iconIna     = isDark ? 'text-neutral-600 group-hover:text-white'              : 'text-gray-500 group-hover:text-roden-black';

  const footerCls  = isDark ? 'border-neutral-800'  : 'border-gray-300';
  const cardCls    = isDark ? 'bg-white/5'           : 'bg-gray-100/50';
  const nameCls    = isDark ? 'text-white'           : 'text-roden-black';
  const roleCls    = isDark ? 'text-neutral-500'     : 'text-gray-500';
  const avatarCls  =
    user.role === 'administrador' ? (isDark ? 'bg-white text-neutral-900' : 'bg-roden-black text-white')
    : user.role === 'gerente_taller' ? 'bg-slate-600 text-white'
    : 'bg-indigo-600 text-white';

  const actionCls  = isDark
    ? 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
    : 'bg-black/5 border-gray-300 text-gray-500 hover:text-roden-black hover:bg-gray-300';

  const settingsCls = isDark
    ? 'text-neutral-500 hover:text-white hover:bg-white/10'
    : 'text-gray-500 hover:text-roden-black hover:bg-gray-300';

  const logoutCls = isDark
    ? 'text-neutral-500 hover:text-red-400 hover:bg-red-500/10'
    : 'text-gray-500 hover:text-red-600 hover:bg-red-50';

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  const roleLabel =
    user.role === 'administrador' ? 'Administrador'
    : user.role === 'gerente_taller' ? 'Gerente'
    : 'Operario';

  return (
    <React.Fragment>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={
        'fixed top-0 left-0 h-full w-64 flex flex-col z-50 print:hidden ' +
        'transition-transform duration-300 ease-in-out border-r shadow-xl lg:shadow-sm ' +
        asideCls + ' ' +
        (isOpen ? 'translate-x-0' : '-translate-x-full') + ' lg:translate-x-0'
      }>

        {/* Logo */}
        <div className="px-6 pt-7 pb-5 flex justify-between items-start">
          <div>
            <h1 className={'text-xl font-bold tracking-tighter ' + titleCls}>
              r&#248;d&#235;n | Dise&#241;o
            </h1>
            <p className={'text-xs mt-1 tracking-widest uppercase font-semibold ' + subtitleCls}>
              Sistema Operativo
            </p>
          </div>
          <div className="flex items-center gap-1">
            {user.role === 'administrador' && (
              <div className="hidden lg:block">
                <NotificationBell currentUser={user} />
              </div>
            )}
            <button onClick={onClose} className={'lg:hidden p-1 transition-colors ' + closeCls}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {menuItems.map((item) => {
            if (!hasAccess(item.allowed as UserRole[])) return null;
            const Icon = item.icon;
            const active = isActive(item.path);
            const navCls = 'w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150 rounded-lg group ';
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); if (onClose) onClose(); }}
                className={navCls + (active ? navActive : navInactive)}
              >
                <Icon size={17} className={active ? iconAct : iconIna + ' transition-colors'} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={'p-3 border-t space-y-1.5 ' + footerCls}>

          {/* User */}
          <div className={'flex items-center gap-3 px-3 py-2.5 rounded-lg ' + cardCls}>
            <div className={'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + avatarCls}>
              {user.avatarInitials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className={'text-sm font-semibold truncate ' + nameCls}>{user.name}</p>
              <p className={'text-xs capitalize truncate ' + roleCls}>{roleLabel}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            {onToggleDark && (
              <button
                onClick={onToggleDark}
                title={isDark ? 'Modo claro' : 'Modo oscuro'}
                className={'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border ' + actionCls}
              >
                {isDark ? <Sun size={13} /> : <Moon size={13} />}
                <span className="hidden sm:inline">{isDark ? 'Claro' : 'Oscuro'}</span>
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir Fullscreen' : 'Pantalla Completa'}
              className={'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border ' + actionCls}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Salir' : 'Fullscreen'}</span>
            </button>
          </div>

          {user.role === 'administrador' && (
            <button
              onClick={() => navigate('/settings')}
              className={'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-lg ' + settingsCls}
            >
              <Settings size={15} />
              <span>Configuraci&#243;n</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className={'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-lg ' + logoutCls}
            >
              <LogOut size={15} />
              <span>Cerrar Sesi&#243;n</span>
            </button>
          )}
        </div>
      </aside>
    </React.Fragment>
  );
};

export default Sidebar;
