
import React from 'react';
import { BusinessData } from '../types';
import MetricCard from '../components/MetricCard';
import { DollarSign, Clock, CheckCircle, AlertTriangle, ArrowRight, FileText, Send, Hammer, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface DashboardProps {
  data: BusinessData;
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  
  // 1. Propuestas en curso (Status: PROPOSAL)
  const proposalsCount = data.projects.filter(p => p.status === 'PROPOSAL').length;

  // 2. Presupuestos enviados (Status: QUOTING)
  const budgetsSentCount = data.projects.filter(p => p.status === 'QUOTING').length;

  // 3. Obras en fabricación (Status: PRODUCTION)
  const productionCount = data.projects.filter(p => p.status === 'PRODUCTION').length;

  // 4. Listo para entregar (Status: READY)
  const readyCount = data.projects.filter(p => p.status === 'READY').length;

  // 5. Facturación del Mes (Budgets APPROVED && lastModified in current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyBilling = data.budgets
    .filter(b => {
        const d = new Date(b.lastModified);
        return b.status === 'APPROVED' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + curr.total, 0);

  const chartData = data.projects.map(p => ({
    name: p.title.split(' ')[0],
    progress: p.progress,
    budget: p.budget / 100 
  }));

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-6 gap-4">
        <div>
           <h2 className="text-2xl md:text-3xl font-bold text-roden-black tracking-tight mb-2">Panel de Control</h2>
           <p className="text-roden-gray text-sm">Visión general del flujo de trabajo y finanzas.</p>
        </div>
        <div className="text-xs md:text-sm font-medium text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100 shadow-sm capitalize self-start md:self-auto">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
              value={`$${monthlyBilling.toLocaleString()}`} 
              icon={DollarSign} 
              trendUp={true} 
              color="gray"
            />
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
  );
};

export default Dashboard;
