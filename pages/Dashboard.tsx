
import React from 'react';
import { BusinessData, Estimate, SupplierPayment } from '../types';
import MetricCard from '../components/MetricCard';
import { DollarSign, Clock, CheckCircle, AlertTriangle, ArrowRight, FileText, Send, Hammer, Truck, Zap, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import RodenAIButton from '../components/RodenAIButton';
import NotasGestion from '../components/NotasGestion';

interface DashboardProps {
  data: BusinessData;
  userRole: string;
  estimates?: Estimate[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, userRole, estimates = [] }) => {
  const [mostrarNotas, setMostrarNotas] = React.useState(false);

  // ── POSICIÓN FINANCIERA PENDIENTE ──────────────────────────────────────────
  // Saldos a pagar: balance pendiente de pagos a proveedores (status PENDING)
  const saldosAPagar = (data.supplierPayments || [])
    .filter(sp => sp.status === 'PENDING')
    .reduce((sum, sp) => sum + (sp.balance || sp.totalAmount || 0), 0);

  // Saldos a cobrar: balance pendiente de estimaciones activas
  const COBRAR_STATUSES = ['APPROVED', 'PRODUCTION', 'SENT'];
  const saldosACobrar = estimates
    .filter(e => COBRAR_STATUSES.includes(e.status))
    .reduce((sum, e) => sum + (e.balance || 0), 0);

  // Beneficio pendiente neto
  const beneficioPendiente = saldosACobrar - saldosAPagar;

  // 1. Propuestas en curso (Status: PROPOSAL)
  const proposalsCount = (data.projects || []).filter(p => p && p.status === 'PROPOSAL').length;

  // 2. Presupuestos enviados (Status: QUOTING)
  const budgetsSentCount = (data.projects || []).filter(p => p && p.status === 'QUOTING').length;

  // 3. Obras en fabricación (Status: PRODUCTION)
  const productionCount = (data.projects || []).filter(p => p && p.status === 'PRODUCTION').length;

  // 4. Listo para entregar (Status: READY)
  const readyCount = (data.projects || []).filter(p => p && p.status === 'READY').length;

  // 5. Facturación del Mes (Budgets APPROVED && lastModified in current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const ACTIVE_STATUSES = ['APPROVED', 'PRODUCTION', 'SENT'];
  const monthlyBilling = (data.budgets || [])
    .filter(b => {
        if (!b || !b.status) return false;
        if (!ACTIVE_STATUSES.includes(b.status)) return false;
        const dateStr = b.date || b.lastModified || '';
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + (curr.total || curr.amount || 0), 0);

  const chartData = (data.projects || [])
    .filter(p => p && p.title && typeof p.progress === 'number')
    .map(p => ({
      name: p.title.split(' ')[0],
      progress: p.progress,
      budget: (p.budget || 0) / 100 
    }));

  return (
    <>
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-6 gap-4">
        <div>
           <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-roden-black tracking-tight mb-2">Panel de Control</h2>
           <p className="text-roden-gray text-sm">Visión general del flujo de trabajo y finanzas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setMostrarNotas(true)}
            className="flex items-center gap-2 px-3 py-2 md:px-4 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Notas
          </button>
          <RodenAIButton
            mode="dashboard_briefing"
            data={data}
            userRole={userRole}
          />
          <div className="text-[10px] sm:text-xs md:text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-2 md:px-4 rounded-lg border border-indigo-100 shadow-sm capitalize shrink-0">
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span className="sm:hidden">
              {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Metrics Grid - Responsive Cols */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <MetricCard 
          label="Propuestas" 
          value={proposalsCount} 
          icon={FileText} 
          color="violet"
        />
        <MetricCard 
          label="Presupuestos" 
          value={budgetsSentCount} 
          icon={Send} 
          color="blue"
        />
        <MetricCard 
          label="En Fabricación" 
          value={productionCount} 
          icon={Hammer} 
          color="amber"
        />
        <MetricCard 
          label="Listos Entregar" 
          value={readyCount} 
          icon={Truck} 
          color="emerald"
        />
         <div className="col-span-2 md:col-span-1">
            <MetricCard 
              label="Facturación Mes" 
              value={`$${(monthlyBilling || 0).toLocaleString()}`} 
              icon={DollarSign} 
              trendUp={true} 
              color="gray"
            />
         </div>
      </div>

      {/* Posición Financiera Pendiente */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {/* Saldos a Cobrar */}
        <div className="bg-white border border-roden-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-emerald-300 transition-colors">
          <div className="p-3 bg-emerald-50 rounded-xl shrink-0">
            <TrendingUp size={22} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Saldos a Cobrar</p>
            <p className="text-2xl font-bold text-roden-black truncate">${saldosACobrar.toLocaleString('es-AR')}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Balances pendientes de clientes</p>
          </div>
        </div>

        {/* Saldos a Pagar */}
        <div className="bg-white border border-roden-border rounded-xl p-5 shadow-sm flex items-center gap-4 hover:border-rose-300 transition-colors">
          <div className="p-3 bg-rose-50 rounded-xl shrink-0">
            <TrendingDown size={22} className="text-rose-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Saldos a Pagar</p>
            <p className="text-2xl font-bold text-roden-black truncate">${saldosAPagar.toLocaleString('es-AR')}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Balances pendientes a proveedores</p>
          </div>
        </div>

        {/* Beneficio Pendiente Neto */}
        <div className={`border rounded-xl p-5 shadow-sm flex items-center gap-4 transition-colors ${
          beneficioPendiente >= 0
            ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400'
            : 'bg-rose-50 border-rose-200 hover:border-rose-400'
        }`}>
          <div className={`p-3 rounded-xl shrink-0 ${beneficioPendiente >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <Scale size={22} className={beneficioPendiente >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Beneficio Neto Pendiente</p>
            <p className={`text-2xl font-bold truncate ${beneficioPendiente >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {beneficioPendiente >= 0 ? '+' : ''}${beneficioPendiente.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Cobrar − Pagar</p>
          </div>
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white border border-roden-border rounded-xl p-4 md:p-8 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-roden-black">Progreso de Obras Activas</h3>
          </div>
          <div className="h-56 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} dy={10} interval={0} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                />
                <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.progress > 80 ? '#10b981' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-roden-border rounded-xl p-6 md:p-8 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-roden-black mb-6">Movimientos Recientes</h3>
          <div className="space-y-6 flex-1">
            {data.projects.slice(0, 4).map((project, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    ['PRODUCTION', 'READY'].includes(project.status) ? 'bg-amber-500' : 
                    project.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}></div>
                <div className="min-w-0">
                  <p className="text-sm text-roden-black font-semibold group-hover:text-indigo-600 transition-colors truncate">{project.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Estado: <span className="font-medium text-gray-700">{project.status}</span></p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2.5 text-sm font-medium text-roden-black hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-100 rounded-lg transition-all flex items-center justify-center gap-2">
            Ver Proyectos <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
    {mostrarNotas && <NotasGestion onClose={() => setMostrarNotas(false)} />}
    </>
  );
};

export default Dashboard;
