
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
  Minimize2
} from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  user: User;
  onToggleRole: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, user, onToggleRole }) => {
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
    { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard, allowed: ['ADMIN'] },
    { id: 'clients', label: 'Clientes', icon: Users, allowed: ['ADMIN'] },
    { id: 'projects', label: 'Proyectos', icon: FolderKanban, allowed: ['ADMIN', 'USER', 'WORKSHOP_MANAGER'] },
    { id: 'production', label: 'Taller', icon: Hammer, allowed: ['ADMIN', 'USER', 'WORKSHOP_MANAGER'] },
    { id: 'tasks', label: 'Tareas', icon: CheckSquare, allowed: ['ADMIN', 'USER', 'WORKSHOP_MANAGER'] },
    { id: 'reports', label: 'Informes', icon: FileText, allowed: ['ADMIN', 'WORKSHOP_MANAGER', 'USER'] },
    { id: 'budgets', label: 'Finanzas', icon: Calculator, allowed: ['ADMIN'] },
    { id: 'suppliers', label: 'Proveedores', icon: Truck, allowed: ['ADMIN', 'WORKSHOP_MANAGER'] },
    { id: 'ai', label: 'Inteligencia rødën', icon: Sparkles, allowed: ['ADMIN'] },
    { id: 'staff', label: 'Personal', icon: ShieldCheck, allowed: ['ADMIN'] }, 
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-200 border-r border-roden-border flex flex-col z-50 shadow-sm transition-all print:hidden">
      <div className="p-8">
        <h1 className="text-xl font-bold tracking-tighter text-roden-black">rødën | Diseño a medida</h1>
        <p className="text-xs text-roden-gray mt-1 tracking-widest uppercase">Sistema Operativo</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          // Check permissions
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

      <div className="p-4 border-t border-gray-300 bg-gray-200">
        
        {/* Fullscreen Toggle */}
        <button 
          onClick={toggleFullscreen}
          className="w-full mb-3 text-xs text-gray-500 hover:text-roden-black p-2 rounded flex items-center justify-center gap-2 transition-colors border border-gray-300 hover:bg-gray-300"
          title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          {isFullscreen ? 'Salir Fullscreen' : 'Modo Fullscreen'}
        </button>

        {/* Demo Toggle Role Button */}
        <button 
          onClick={onToggleRole}
          className="w-full mb-4 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 p-2 rounded text-center border border-indigo-100 transition-colors hover:bg-indigo-100"
        >
          (Demo) Rol Actual: {user.role === 'ADMIN' ? 'Admin' : user.role === 'WORKSHOP_MANAGER' ? 'Jefe Taller' : 'Operario Taller'}
        </button>

        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-100/50 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${user.role === 'ADMIN' ? 'bg-roden-black' : user.role === 'WORKSHOP_MANAGER' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                {user.avatarInitials}
            </div>
            <div>
                <p className="text-sm font-medium text-roden-black">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                    {user.role === 'ADMIN' ? 'Administrador' : user.role === 'WORKSHOP_MANAGER' ? 'Jefe Taller' : 'Operario'}
                </p>
            </div>
        </div>
        {user.role === 'ADMIN' && (
          <button 
             onClick={() => onNavigate('settings')}
             className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-500 hover:text-roden-black transition-colors"
          >
            <Settings size={16} />
            Configuración
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
