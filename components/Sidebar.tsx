
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  Calculator, 
  Hammer, 
  Sparkles,
  Settings,
  CheckSquare,
  ShieldCheck,
  LogOut,
  Truck,
  FileText,
  Maximize2,
  Minimize2,
  X,
  Archive,
  ClipboardList
} from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  user: User;
  onToggleRole: () => void;
  onLogout?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, user, onToggleRole, onLogout, isOpen = false, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Helper to check if role has access
  const hasAccess = (allowedRoles: UserRole[]) => allowedRoles.includes(user.role);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard, allowed: ['administrador'] },
    { id: 'clients', label: 'Clientes', icon: Users, allowed: ['administrador'] },
    { id: 'projects', label: 'Proyectos', icon: FolderKanban, allowed: ['administrador', 'operario_taller', 'gerente_taller'] },
    { id: 'estimator', label: 'Estimador Costos', icon: ClipboardList, allowed: ['administrador'] },
    { id: 'production', label: 'Taller', icon: Hammer, allowed: ['administrador', 'operario_taller', 'gerente_taller'] },
    { id: 'tasks', label: 'Tareas', icon: CheckSquare, allowed: ['administrador', 'operario_taller', 'gerente_taller'] },
    { id: 'archive', label: 'Archivo', icon: Archive, allowed: ['administrador'] },
    { id: 'reports', label: 'Informes', icon: FileText, allowed: ['administrador', 'gerente_taller', 'operario_taller'] },
    { id: 'budgets', label: 'Finanzas', icon: Calculator, allowed: ['administrador'] },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, allowed: ['administrador', 'gerente_taller'] },
    { id: 'ai', label: 'Inteligencia rødën', icon: Sparkles, allowed: ['administrador'] },
    { id: 'staff', label: 'Personal', icon: ShieldCheck, allowed: ['administrador'] }, 
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-200 border-r border-roden-border flex flex-col z-50 shadow-xl transition-transform duration-300 ease-in-out print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 lg:shadow-sm
      `}>
        
        {/* Header */}
        <div className="p-8 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-roden-black">rødën | Diseño</h1>
            <p className="text-xs text-roden-gray mt-1 tracking-widest uppercase">Sistema Operativo</p>
          </div>
          {/* Close Button (Mobile Only) */}
          <button 
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-black p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            if (!hasAccess(item.allowed as UserRole[])) return null;

            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg group ${
                  isActive 
                    ? 'bg-roden-black text-white font-semibold shadow-md' 
                    : 'text-gray-500 hover:text-roden-black hover:bg-gray-300'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-roden-black'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-300 bg-gray-200 space-y-2">
          
          <button 
            onClick={toggleFullscreen}
            className="w-full text-xs text-gray-500 hover:text-roden-black p-2 rounded flex items-center justify-center gap-2 transition-colors border border-gray-300 hover:bg-gray-300"
            title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Salir Fullscreen' : 'Modo Fullscreen'}</span>
          </button>

          <div className="flex items-center gap-3 px-4 py-3 bg-gray-100/50 rounded-lg">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${user.role === 'administrador' ? 'bg-roden-black' : user.role === 'gerente_taller' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                  {user.avatarInitials}
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="text-sm font-medium text-roden-black truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize truncate">
                      {user.role === 'administrador' ? 'Administrador' : user.role === 'gerente_taller' ? 'Gerente' : 'Operario'}
                  </p>
              </div>
          </div>
          
          {user.role === 'administrador' && (
            <button 
               onClick={() => onNavigate('settings')}
               className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-roden-black transition-colors"
            >
              <Settings size={16} />
              Configuración
            </button>
          )}

          {onLogout && (
             <button 
               onClick={onLogout}
               className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
             >
               <LogOut size={16} />
               Cerrar Sesión
             </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
