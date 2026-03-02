
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Budget, Project, BudgetStatus, ProductionStep, SupplierPayment, SavedEstimate } from '../types';
import { FileText, CheckCircle, Clock, X, Search, PieChart, TrendingUp, Hammer, BarChart2, TrendingDown, DollarSign, Pencil, Trash2, Download } from 'lucide-react';

interface BudgetsProps {
  budgets: Budget[];
  projects: Project[];
  supplierPayments: SupplierPayment[];
  savedEstimates?: SavedEstimate[]; // New Prop
  onAddBudget: (budget: Budget) => void;
  onUpdateBudget: (budget: Budget) => void;
  onDeleteBudget: (budgetId: string) => void;
}

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo/Planos',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo'
};

const Budgets: React.FC<BudgetsProps> = ({ budgets, projects, supplierPayments, savedEstimates = [], onAddBudget, onUpdateBudget, onDeleteBudget }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<BudgetStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [budgetForm, setBudgetForm] = useState({
      projectId: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: '',
      status: 'DRAFT' as BudgetStatus,
      importedEstimateId: '' // Temporary field for import logic
  });

  const getProject = (id: string) => projects.find(p => p.id === id);
  const getProjectName = (id: string) => getProject(id)?.title || 'Proyecto Desconocido';

  // Find available estimates for selected project in form
  const availableEstimatesForSelectedProject = savedEstimates.filter(
      est => est.type === 'ECONOMIC' && est.projectId === budgetForm.projectId
  );

  const filteredBudgets = budgets.filter(budget => {
    const matchesStatus = filterStatus === 'ALL' || budget.status === filterStatus;
    const projectName = getProjectName(budget.projectId).toLowerCase();
    const matchesSearch = projectName.includes(searchTerm.toLowerCase()) || 
                          budget.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Financial Metrics Logic (Same as before)
  const totalReceivedDownPayments = budgets.filter(b => b.status === 'APPROVED').reduce((acc, b) => acc + (b.downPayment || 0), 0);
  const totalPendingBalances = budgets.filter(b => b.status === 'APPROVED').reduce((acc, b) => acc + (b.balance || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyBilling = budgets.filter(b => {
        const d = new Date(b.lastModified);
        return b.status === 'APPROVED' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, b) => acc + b.total, 0);

  // --- PROFITABILITY LOGIC (Same as before) ---
  const profitabilityData = projects.map(project => {
      const income = budgets.filter(b => b.projectId === project.id && b.status === 'APPROVED').reduce((sum, b) => sum + b.total, 0);
      const expenses = supplierPayments.filter(sp => sp.projectId === project.id).reduce((sum, sp) => sum + sp.totalAmount, 0);
      const profit = income - expenses;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      return { id: project.id, title: project.title, status: project.status, income, expenses, profit, margin };
  }).filter(d => d.income > 0 || d.expenses > 0).sort((a, b) => b.profit - a.profit); 


  const handleOpenCreate = () => {
    setEditingId(null);
    setBudgetForm({
      projectId: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: '',
      status: 'DRAFT',
      importedEstimateId: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (budget: Budget) => {
    setEditingId(budget.id);
    setBudgetForm({
      projectId: budget.projectId,
      downPayment: budget.downPayment,
      downPaymentDate: budget.downPaymentDate || '',
      balance: budget.balance,
      balanceDate: budget.balanceDate || '',
      status: budget.status,
      importedEstimateId: ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
      onDeleteBudget(id);
  };

  const handleImportEstimate = () => {
      if (!budgetForm.importedEstimateId) return;
      const estimate = savedEstimates.find(e => e.id === budgetForm.importedEstimateId);
      if (estimate && estimate.finalPrice) {
          // Auto-fill logic: 50% Downpayment by default
          const total = estimate.finalPrice;
          const down = Math.round(total * 0.5);
          const bal = total - down;
          
          setBudgetForm(prev => ({
              ...prev,
              downPayment: down,
              balance: bal
          }));
          alert(`Importado monto total: $${total.toLocaleString()} desde la estimación del ${new Date(estimate.date).toLocaleDateString()}`);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const calculatedTotal = Number(budgetForm.downPayment) + Number(budgetForm.balance);
      
      if (editingId) {
          // UPDATE
          const original = budgets.find(b => b.id === editingId);
          if (!original) return;

          const updatedBudget: Budget = {
              ...original,
              projectId: budgetForm.projectId,
              total: calculatedTotal,
              downPayment: Number(budgetForm.downPayment),
              downPaymentDate: budgetForm.downPaymentDate,
              balance: Number(budgetForm.balance),
              balanceDate: budgetForm.balanceDate,
              status: budgetForm.status,
              lastModified: new Date().toLocaleDateString('en-CA'),
          };
          onUpdateBudget(updatedBudget);

      } else {
          // CREATE
          const newBudget: Budget = {
              id: `b${Date.now()}`,
              projectId: budgetForm.projectId,
              total: calculatedTotal,
              downPayment: Number(budgetForm.downPayment),
              downPaymentDate: budgetForm.downPaymentDate,
              balance: Number(budgetForm.balance),
              balanceDate: budgetForm.balanceDate,
              status: budgetForm.status,
              version: 1,
              lastModified: new Date().toLocaleDateString('en-CA'),
              items: [] 
          };
          onAddBudget(newBudget);
      }

      setIsModalOpen(false);
  };

  const calculatedTotalDisplay = Number(budgetForm.downPayment) + Number(budgetForm.balance);

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Finanzas</h2>
          <p className="text-roden-gray text-sm mt-1">Gestión de cobros, anticipos y rentabilidad.</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={handleOpenCreate}
                className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200">
                Nuevo Presupuesto
            </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={80} className="text-emerald-500" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded text-emerald-600"><CheckCircle size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Anticipos Recibidos</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${totalReceivedDownPayments.toLocaleString()}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={80} className="text-amber-500" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-100 rounded text-amber-600"><Clock size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Saldos a Cobrar</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${totalPendingBalances.toLocaleString()}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80} className="text-indigo-500" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-indigo-100 rounded text-indigo-600"><PieChart size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Facturación Mensual</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${monthlyBilling.toLocaleString()}</p>
              </div>
          </div>
      </div>

      {/* Profitability Analysis Section */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-roden-black flex items-center gap-2"><BarChart2 size={20} className="text-gray-500"/> Análisis de Rentabilidad por Proyecto</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/30">
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ingresos</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Costos</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Margen Neto</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Margen %</th>
                    </tr>
                </thead>
                <tbody>
                    {profitabilityData.map(data => (
                        <tr key={data.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-6"><p className="text-sm font-bold text-roden-black">{data.title}</p></td>
                            <td className="py-4 px-6 text-right"><span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">${data.income.toLocaleString()}</span></td>
                            <td className="py-4 px-6 text-right"><span className="text-sm font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded">${data.expenses.toLocaleString()}</span></td>
                            <td className="py-4 px-6 text-right"><p className={`text-sm font-bold ${data.profit < 0 ? 'text-red-600' : 'text-roden-black'}`}>${data.profit.toLocaleString()}</p></td>
                            <td className="py-4 px-6 text-right"><div className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border">{data.margin.toFixed(1)}%</div></td>
                        </tr>
                    ))}
                </tbody>
              </table>
          </div>
      </section>

      {/* Budgets Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                 <input type="text" placeholder="Buscar presupuestos..." className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Anticipo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody>
                  {filteredBudgets.map((budget) => (
                      <tr key={budget.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors group">
                          <td className="py-4 px-6"><p className="text-sm font-bold text-roden-black">{getProjectName(budget.projectId)}</p></td>
                          <td className="py-4 px-6"><p className="text-sm font-medium text-emerald-600">+${budget.downPayment?.toLocaleString()}</p></td>
                          <td className="py-4 px-6"><p className="text-sm font-medium text-amber-600">${budget.balance?.toLocaleString()}</p></td>
                          <td className="py-4 px-6 text-sm font-bold text-roden-black">${budget.total.toLocaleString()}</td>
                          <td className="py-4 px-6"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100">{budget.status}</span></td>
                          <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenEdit(budget)} className="text-gray-400 hover:text-indigo-600 p-1.5"><Pencil size={14} /></button>
                                <button onClick={() => handleDelete(budget.id)} className="text-gray-400 hover:text-red-600 p-1.5"><Trash2 size={14} /></button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

       {/* Create/Edit Budget Modal */}
       {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">{editingId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <form onSubmit={handleSubmit} className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                              <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                    value={budgetForm.projectId} onChange={e => setBudgetForm({...budgetForm, projectId: e.target.value, importedEstimateId: ''})}>
                                    <option value="">Seleccionar Proyecto...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                          </div>

                          {/* IMPORT ESTIMATE LOGIC */}
                          {!editingId && budgetForm.projectId && availableEstimatesForSelectedProject.length > 0 && (
                              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                  <label className="block text-xs font-bold text-indigo-700 mb-2 flex items-center gap-2">
                                      <FileText size={14}/> Importar Estimación de Costos
                                  </label>
                                  <div className="flex gap-2">
                                      <select 
                                        className="flex-1 p-2 text-sm border border-indigo-200 rounded bg-white"
                                        value={budgetForm.importedEstimateId}
                                        onChange={(e) => setBudgetForm({...budgetForm, importedEstimateId: e.target.value})}
                                      >
                                          <option value="">-- Seleccionar Estimación --</option>
                                          {availableEstimatesForSelectedProject.map(est => (
                                              <option key={est.id} value={est.id}>
                                                  {new Date(est.date).toLocaleDateString()} - ${est.finalPrice?.toLocaleString()}
                                              </option>
                                          ))}
                                      </select>
                                      <button 
                                        type="button"
                                        onClick={handleImportEstimate}
                                        disabled={!budgetForm.importedEstimateId}
                                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50"
                                      >
                                          <Download size={14}/> Importar
                                      </button>
                                  </div>
                              </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Anticipo Recibido <CheckCircle size={12} className="text-emerald-500"/></label>
                                <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                       value={budgetForm.downPayment} onChange={e => setBudgetForm({...budgetForm, downPayment: Number(e.target.value)})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Anticipo</label>
                                <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={budgetForm.downPaymentDate} onChange={e => setBudgetForm({...budgetForm, downPaymentDate: e.target.value})} />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Saldo Pendiente <Clock size={12} className="text-amber-500"/></label>
                                <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                       value={budgetForm.balance} onChange={e => setBudgetForm({...budgetForm, balance: Number(e.target.value)})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Cancelación</label>
                                <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={budgetForm.balanceDate} onChange={e => setBudgetForm({...budgetForm, balanceDate: e.target.value})} />
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
                                     value={budgetForm.status} onChange={e => setBudgetForm({...budgetForm, status: e.target.value as BudgetStatus})}>
                                     <option value="DRAFT">Borrador</option>
                                     <option value="SENT">Enviado</option>
                                     <option value="APPROVED">Aprobado</option>
                                 </select>
                             </div>
                          </div>
                          <div className="pt-4 flex justify-end gap-3 bg-white border-t border-gray-100">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                                  Cancelar
                              </button>
                              <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                                  {editingId ? 'Guardar Cambios' : 'Crear'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default Budgets;
