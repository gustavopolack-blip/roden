import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Menu } from 'lucide-react';

interface BottomNavProps {
  onOpenSidebar: () => void;
  isDark?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ onOpenSidebar, isDark = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: '/',         label: 'Panel',     icon: LayoutDashboard },
    { path: '/clients',  label: 'Clientes',  icon: Users           },
    { path: '/projects', label: 'Proyectos', icon: FolderKanban    },
    { path: '/tasks',    label: 'Tareas',    icon: CheckSquare     },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const bg     = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200';
  const actCls = isDark ? 'text-white'     : 'text-roden-black';
  const inaCls = isDark ? 'text-neutral-500' : 'text-gray-400';

  return (
    <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t print:hidden ${bg}`}
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch h-16">
        {items.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? actCls : inaCls}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <span className={`absolute top-0 h-0.5 w-8 rounded-full ${isDark ? 'bg-white' : 'bg-roden-black'}`} />
              )}
            </button>
          );
        })}

        {/* Menú — abre el sidebar completo */}
        <button
          onClick={onOpenSidebar}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${inaCls}`}
        >
          <Menu size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">Menú</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
