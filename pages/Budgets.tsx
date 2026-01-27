
import React, { useState } from 'react';
import { Budget, Project, BudgetStatus, ProductionStep, SupplierPayment } from '../types';
import { FileText, CheckCircle, Clock, X, Search, PieChart, TrendingUp, Hammer, BarChart2, TrendingDown, DollarSign } from 'lucide-react';

interface BudgetsProps {
  budgets: Budget[];
  projects: Project[];
  supplierPayments: SupplierPayment[];
  onAddBudget: (budget: Budget) => void;
}

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo/Planos',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo'
};

const Budgets: React.FC<BudgetsProps> = ({ budgets, projects, supplierPayments, onAddBudget }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newBudget, setNewBudget] = useState({
      projectId: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: '',
      status: 'DRAFT' as BudgetStatus
  });

  const getProject = (id: string) => projects.find(p => p.id === id);
  const getProjectName = (id: string) => getProject(id)?.title || 'Proyecto Desconocido';

  const filteredBudgets = budgets.filter(budget => {
    const matchesStatus = filterStatus === 'ALL' || budget.status === filterStatus;
    const projectName = getProjectName(budget.projectId).toLowerCase();
    const matchesSearch = projectName.includes(searchTerm.toLowerCase()) || 
                          budget.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Financial Metrics Logic
  // Anticipos Recibidos: Sum of down payments for APPROVED budgets
  const totalReceivedDownPayments = budgets
    .filter(b => b.status === 'APPROVED')
    .reduce((acc, b) => acc + (b.downPayment || 0), 0);

  // Saldos a Cobrar: Sum of balances for APPROVED budgets
  const totalPendingBalances = budgets
    .filter(b => b.status === 'APPROVED')
    .reduce((acc, b) => acc + (b.balance || 0), 0);

  // Facturación Mensual: Total budget amounts for approved items this month (mocked via lastModified)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyBilling = budgets
    .filter(b => {
        const d = new Date(b.lastModified);
        return b.status === 'APPROVED' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, b) => acc + b.total, 0);

  // --- PROFITABILITY LOGIC ---
  const profitabilityData = projects.map(project => {
      // Income: Sum of all APPROVED budgets for this project
      const income = budgets
          .filter(b => b.projectId === project.id && b.status === 'APPROVED')
          .reduce((sum, b) => sum + b.total, 0);
      
      // Expenses: Sum of all supplier payments linked to this project
      const expenses = supplierPayments
          .filter(sp => sp.projectId === project.id)
          .reduce((sum, sp) => sum + sp.totalAmount, 0);

      const profit = income - expenses;
      const margin = income > 0 ? (profit / income) * 100 : 0;

      return {
          id: project.id,
          title: project.title,
          status: project.status,
          income,
          expenses,
          profit,
          margin
      };
  }).filter(d => d.income > 0 || d.expenses > 0) // Only show projects with financial activity
    .sort((a, b) => b.profit - a.profit); // Sort by highest profit


  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const calculatedTotal = Number(newBudget.downPayment) + Number(newBudget.balance);
      
      const budget: Budget = {
          id: `b${Date.now()}`,
          projectId: newBudget.projectId,
          total: calculatedTotal,
          downPayment: Number(newBudget.downPayment),
          downPaymentDate: newBudget.downPaymentDate,
          balance: Number(newBudget.balance),
          balanceDate: newBudget.balanceDate,
          status: newBudget.status,
          version: 1,
          lastModified: new Date().toLocaleDateString('en-CA'), // ISO-ish format
          items: [] 
      };
      onAddBudget(budget);
      setIsModalOpen(false);
      setNewBudget({ projectId: '', downPayment: 0, downPaymentDate: '', balance: 0, balanceDate: '', status: 'DRAFT' });
  };

  const calculatedTotalDisplay = Number(newBudget.downPayment) + Number(newBudget.balance);

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Finanzas</h2>
          <p className="text-roden-gray text-sm mt-1">Gestión de cobros, anticipos y rentabilidad.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200">
                Nuevo Presupuesto
            </button>
        </div>
      </header>

      {/* Metrics Row (Updated) */}
      <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <CheckCircle size={80} className="text-emerald-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded text-emerald-600"><CheckCircle size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anticipos Recibidos</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${totalReceivedDownPayments.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 mt-1 font-medium">Cobrado en obras activas</p>
              </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Clock size={80} className="text-amber-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-100 rounded text-amber-600"><Clock size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Saldos a Cobrar</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${totalPendingBalances.toLocaleString()}</p>
                <p className="text-xs text-amber-600 mt-1 font-medium">Pendiente contra entrega</p>
              </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <TrendingUp size={80} className="text-indigo-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-indigo-100 rounded text-indigo-600"><PieChart size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Facturación Mensual</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${monthlyBilling.toLocaleString()}</p>
                <p className="text-xs text-indigo-600 mt-1 font-medium">Este mes</p>
              </div>
          </div>
      </div>

      {/* Profitability Analysis Section */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-roden-black flex items-center gap-2">
                  <BarChart2 size={20} className="text-gray-500"/> Análisis de Rentabilidad por Proyecto
              </h3>
              <p className="text-xs text-gray-400">Calculado sobre Presupuestos Aprobados vs. Pagos a Proveedores</p>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/30">
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ingresos (Ventas)</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Costos (Prov.)</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Margen Neto</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Margen %</th>
                    </tr>
                </thead>
                <tbody>
                    {profitabilityData.map(data => {
                        const isLoss = data.profit < 0;
                        const isHighMargin = data.margin > 40;
                        const isMediumMargin = data.margin > 20 && data.margin <= 40;

                        return (
                            <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-6">
                                    <p className="text-sm font-bold text-roden-black">{data.title}</p>
                                    <span className="text-[10px] text-gray-400 uppercase">{data.status}</span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                        ${data.income.toLocaleString()}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <span className="text-sm font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded">
                                        ${data.expenses.toLocaleString()}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <p className={`text-sm font-bold ${isLoss ? 'text-red-600' : 'text-roden-black'}`}>
                                        ${data.profit.toLocaleString()}
                                    </p>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${
                                        isLoss ? 'bg-red-100 text-red-700 border-red-200' :
                                        isHighMargin ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                        isMediumMargin ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                        'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                        {isLoss ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                        {data.margin.toFixed(1)}%
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {profitabilityData.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-8 text-gray-400 italic">
                                No hay datos financieros suficientes para calcular rentabilidad.
                            </td>
                        </tr>
                    )}
                </tbody>
              </table>
          </div>
      </section>

      {/* Budgets Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Buscar presupuestos..." 
                    className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
              
              <div className="flex items-center gap-2">
                {filterStatus !== 'ALL' && (
                    <button 
                        onClick={() => setFilterStatus('ALL')}
                        className="text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <X size={14} /> Limpiar Filtro: {filterStatus}
                    </button>
                )}
              </div>
          </div>
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto & ID</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado Taller</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Anticipo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                  </tr>
              </thead>
              <tbody>
                  {filteredBudgets.map((budget, idx) => {
                      const project = getProject(budget.projectId);
                      const isProduction = project?.status === 'PRODUCTION' || project?.status === 'READY';
                      const workshopStatus = isProduction && project?.productionStep 
                        ? PRODUCTION_STEP_LABELS[project.productionStep] 
                        : project?.status === 'COMPLETED' ? 'Finalizado' 
                        : project?.status === 'QUOTING' ? 'Presupuesto'
                        : project?.status === 'PROPOSAL' ? 'Propuesta'
                        : '-';

                      return (
                      <tr key={budget.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors group">
                          <td className="py-4 px-6">
                             <p className="text-sm font-bold text-roden-black">{getProjectName(budget.projectId)}</p>
                             <p className="text-xs text-gray-400 font-mono">#{budget.id.toUpperCase()}</p>
                          </td>
                          <td className="py-4 px-6">
                              {isProduction ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase">
                                      <Hammer size={10} /> {workshopStatus}
                                  </span>
                              ) : (
                                  <span className="text-xs text-gray-400">{workshopStatus}</span>
                              )}
                          </td>
                          <td className="py-4 px-6">
                              <p className="text-sm font-medium text-emerald-600">+${budget.downPayment?.toLocaleString()}</p>
                              {budget.downPaymentDate && <span className="text-[10px] text-gray-400">{budget.downPaymentDate}</span>}
                          </td>
                          <td className="py-4 px-6">
                              <p className="text-sm font-medium text-amber-600">${budget.balance?.toLocaleString()}</p>
                              {budget.balanceDate && <span className="text-[10px] text-gray-400">{budget.balanceDate}</span>}
                          </td>
                          <td className="py-4 px-6 text-sm font-bold text-roden-black">${budget.total.toLocaleString()}</td>
                          <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  budget.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  budget.status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                  'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                  {budget.status === 'APPROVED' ? 'APROBADO' : budget.status === 'SENT' ? 'ENVIADO' : budget.status === 'REJECTED' ? 'RECHAZADO' : 'BORRADOR'}
                              </span>
                          </td>
                      </tr>
                  )})}
                  {filteredBudgets.length === 0 && (
                      <tr>
                          <td colSpan={6} className="text-center py-10 text-gray-400">
                              No se encontraron presupuestos.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>

       {/* Create Budget Modal */}
       {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-roden-black">Nuevo Presupuesto</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                          <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                value={newBudget.projectId} onChange={e => setNewBudget({...newBudget, projectId: e.target.value})}>
                                <option value="">Seleccionar Proyecto...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Anticipo Recibido <CheckCircle size={12} className="text-emerald-500"/></label>
                            <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                   value={newBudget.downPayment} onChange={e => setNewBudget({...newBudget, downPayment: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Anticipo</label>
                            <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                value={newBudget.downPaymentDate} onChange={e => setNewBudget({...newBudget, downPaymentDate: e.target.value})} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Saldo Pendiente <Clock size={12} className="text-amber-500"/></label>
                            <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                   value={newBudget.balance} onChange={e => setNewBudget({...newBudget, balance: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Cancelación</label>
                            <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                value={newBudget.balanceDate} onChange={e => setNewBudget({...newBudget, balanceDate: e.target.value})} />
                         </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-200">
                          <span className="text-sm font-bold text-gray-600">Monto Total</span>
                          <span className="text-xl font-bold text-roden-black">${calculatedTotalDisplay.toLocaleString()}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                             <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                 value={newBudget.status} onChange={e => setNewBudget({...newBudget, status: e.target.value as BudgetStatus})}>
                                 <option value="DRAFT">Borrador</option>
                                 <option value="SENT">Enviado</option>
                                 <option value="APPROVED">Aprobado</option>
                             </select>
                         </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                              Crear
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Budgets;
