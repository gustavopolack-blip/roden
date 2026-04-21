
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Estimate, Project, EstimateStatus, ProductionStep, SupplierPayment, SavedEstimate } from '../types';
import { FileText, CheckCircle, Clock, X, Search, PieChart, TrendingUp, Hammer, BarChart2, TrendingDown, DollarSign, Pencil, Trash2, Download, Archive, Filter } from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';

interface BudgetsProps {
  estimates: Estimate[];
  projects: Project[];
  supplierPayments: SupplierPayment[];
  savedEstimates?: SavedEstimate[];
  priceLists?: any[];
  onAddEstimate: (estimate: Estimate) => void;
  onUpdateEstimate: (estimate: Estimate) => void;
  onDeleteEstimate: (id: string) => void;
  user: any; // Added user prop
  userRole: string;
}

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo/Planos',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo'
};

const Budgets: React.FC<BudgetsProps> = ({ estimates, projects, supplierPayments, savedEstimates = [], priceLists = [], user, userRole, onAddEstimate, onUpdateEstimate, onDeleteEstimate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<EstimateStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [estimateForm, setEstimateForm] = useState({
      projectId: '',
      title: '',
      description: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: '',
      status: 'DRAFT' as EstimateStatus,
      totalAmount: 0,
      priceListId: ''
  });

  const getProject = (id: string) => projects.find(p => p.id === id);
  const getProjectName = (id: string) => getProject(id)?.title || 'Proyecto Desconocido';

  const filteredEstimates = estimates.filter(est => {
    const matchesStatus = filterStatus === 'ALL' || est.status === filterStatus;
    const projectName = getProjectName(est.projectId || '').toLowerCase();
    const title = (est.title || '').toLowerCase();
    const matchesSearch = projectName.includes(searchTerm.toLowerCase()) || 
                          title.includes(searchTerm.toLowerCase()) ||
                          (est.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Financial Metrics Logic
  console.log('[Budgets] estimates recibidos:', estimates.length, estimates.map(e => ({ id: e.id, status: e.status, totalAmount: e.totalAmount, downPayment: e.downPayment, balance: e.balance })));
  const totalReceivedDownPayments = estimates.filter(e => ['APPROVED', 'PRODUCTION', 'SENT'].includes(e.status)).reduce((acc, e) => acc + (e.downPayment || 0), 0);
  const totalPendingBalances = estimates.filter(e => ['APPROVED', 'PRODUCTION', 'SENT'].includes(e.status)).reduce((acc, e) => acc + (e.balance || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyBilling = estimates.filter(e => {
        const d = new Date(e.createdAt);
        return ['APPROVED', 'PRODUCTION', 'SENT'].includes(e.status) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, e) => acc + e.totalAmount, 0);

  // Profitability Analysis
  const profitabilityData = projects.map(project => {
      const income = estimates.filter(e => e.projectId === project.id && ['APPROVED', 'PRODUCTION', 'SENT'].includes(e.status)).reduce((sum, e) => sum + e.totalAmount, 0);
      const expenses = supplierPayments.filter(sp => sp.projectId === project.id).reduce((sum, sp) => sum + sp.totalAmount, 0);
      const profit = income - expenses;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      return { id: project.id, title: project.title, status: project.status, income, expenses, profit, margin };
  }).filter(d => d.income > 0 || d.expenses > 0).sort((a, b) => b.profit - a.profit); 

  const handleOpenCreate = () => {
    setEditingId(null);
    setEstimateForm({
      projectId: '',
      title: '',
      description: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: '',
      status: 'DRAFT',
      totalAmount: 0,
      priceListId: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (estimate: Estimate) => {
    setEditingId(estimate.id);
    setEstimateForm({
      projectId: estimate.projectId || '',
      title: estimate.title,
      description: estimate.description || '',
      downPayment: estimate.downPayment || 0,
      downPaymentDate: estimate.downPaymentDate || '',
      balance: estimate.balance || 0,
      balanceDate: estimate.balanceDate || '',
      status: estimate.status,
      totalAmount: estimate.totalAmount,
      priceListId: estimate.priceListId || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (editingId) {
          const original = estimates.find(e => e.id === editingId);
          if (!original) return;

          const updatedEstimate: Estimate = {
              ...original,
              projectId: estimateForm.projectId,
              title: estimateForm.title,
              description: estimateForm.description,
              totalAmount: Number(estimateForm.totalAmount),
              downPayment: Number(estimateForm.downPayment),
              downPaymentDate: estimateForm.downPaymentDate,
              balance: Number(estimateForm.balance),
              balanceDate: estimateForm.balanceDate,
              status: estimateForm.status,
              updatedAt: new Date().toISOString(),
          };
          onUpdateEstimate(updatedEstimate);
      } else {
          const newEstimate: Estimate = {
              id: crypto.randomUUID(),
              projectId: estimateForm.projectId,
              title: estimateForm.title,
              description: estimateForm.description,
              totalAmount: Number(estimateForm.totalAmount),
              downPayment: Number(estimateForm.downPayment),
              downPaymentDate: estimateForm.downPaymentDate,
              balance: Number(estimateForm.balance),
              balanceDate: estimateForm.balanceDate,
              status: estimateForm.status,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: user?.id || 'system'
          };
          onAddEstimate(newEstimate);
      }

      setIsModalOpen(false);
  };

  const calculatedTotalDisplay = Number(estimateForm.downPayment) + Number(estimateForm.balance);

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Finanzas</h2>
          <p className="text-roden-gray text-sm mt-1">Gestión de ingresos, cobros y rentabilidad.</p>
        </div>
        <div className="flex gap-3">
            <RodenAIButton 
                mode="finanzas_lectura" 
                data={{ estimates, projects, supplierPayments, savedEstimates }} 
                userRole={userRole}
            />
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
                <p className="text-3xl font-bold text-roden-black">${(totalReceivedDownPayments || 0).toLocaleString()}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={80} className="text-amber-500" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-100 rounded text-amber-600"><Clock size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Saldos a Cobrar</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${(totalPendingBalances || 0).toLocaleString()}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-roden-border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80} className="text-indigo-500" /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-indigo-100 rounded text-indigo-600"><PieChart size={16}/></div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Facturación Mensual</p>
                </div>
                <p className="text-3xl font-bold text-roden-black">${(monthlyBilling || 0).toLocaleString()}</p>
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
                            <td className="py-4 px-6 text-right"><span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">${(data.income || 0).toLocaleString()}</span></td>
                            <td className="py-4 px-6 text-right"><span className="text-sm font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded">${(data.expenses || 0).toLocaleString()}</span></td>
                            <td className="py-4 px-6 text-right"><p className={`text-sm font-bold ${data.profit < 0 ? 'text-red-600' : 'text-roden-black'}`}>${(data.profit || 0).toLocaleString()}</p></td>
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
              <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select 
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                  >
                      <option value="ALL">Todos los Estados</option>
                      <option value="DRAFT">Borrador</option>
                      <option value="SENT">Enviado</option>
                      <option value="APPROVED">Aprobado</option>
                      <option value="PRODUCTION">En Producción</option>
                      <option value="REJECTED">Rechazado</option>
                      <option value="CANCELLED">Cancelado</option>
                      <option value="FINISHED">Finalizado</option>
                      <option value="ARCHIVED">Archivado</option>
                  </select>
              </div>
          </div>
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto / Título</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Anticipo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
              </thead>
              <tbody>
                  {filteredEstimates.map((estimate) => (
                      <tr key={estimate.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors group">
                          <td className="py-4 px-6">
                              <p className="text-sm font-bold text-roden-black">{getProjectName(estimate.projectId || '')}</p>
                              <p className="text-xs text-gray-500">{estimate.title}</p>
                          </td>
                          <td className="py-4 px-6"><p className="text-sm font-medium text-emerald-600">+${(estimate.downPayment || 0).toLocaleString()}</p></td>
                          <td className="py-4 px-6"><p className="text-sm font-medium text-amber-600">${(estimate.balance || 0).toLocaleString()}</p></td>
                          <td className="py-4 px-6 text-sm font-bold text-roden-black">${(estimate.totalAmount || 0).toLocaleString()}</td>
                          <td className="py-4 px-6">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                  estimate.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                  estimate.status === 'PRODUCTION' ? 'bg-blue-100 text-blue-700' :
                                  estimate.status === 'SENT' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>
                                  {estimate.status}
                              </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenEdit(estimate)} className="text-gray-400 hover:text-indigo-600 p-1.5"><Pencil size={14} /></button>
                                <button onClick={() => onDeleteEstimate(estimate.id)} className="text-gray-400 hover:text-red-600 p-1.5"><Trash2 size={14} /></button>
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
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                                  <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                        value={estimateForm.projectId} onChange={e => setEstimateForm({...estimateForm, projectId: e.target.value})}>
                                        <option value="">Seleccionar Proyecto...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                  <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                      value={estimateForm.title} onChange={e => setEstimateForm({...estimateForm, title: e.target.value})} placeholder="Ej: Amoblamiento Cocina" />
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                              <textarea className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                  value={estimateForm.description} onChange={e => setEstimateForm({...estimateForm, description: e.target.value})} placeholder="Detalles adicionales..." rows={2} />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Anticipo Recibido <CheckCircle size={12} className="text-emerald-500"/></label>
                                <input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                       value={estimateForm.downPayment} onChange={e => setEstimateForm({...estimateForm, downPayment: Number(e.target.value)})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Anticipo</label>
                                <input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={estimateForm.downPaymentDate} onChange={e => setEstimateForm({...estimateForm, downPaymentDate: e.target.value})} />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">Saldo Pendiente <Clock size={12} className="text-amber-500"/></label>
                                <input type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                       value={estimateForm.balance} onChange={e => setEstimateForm({...estimateForm, balance: Number(e.target.value)})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Cancelación</label>
                                <input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={estimateForm.balanceDate} onChange={e => setEstimateForm({...estimateForm, balanceDate: e.target.value})} />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total</label>
                                  <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none font-bold" 
                                         value={estimateForm.totalAmount} onChange={e => setEstimateForm({...estimateForm, totalAmount: Number(e.target.value)})} />
                              </div>
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                  <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                      value={estimateForm.status} onChange={e => setEstimateForm({...estimateForm, status: e.target.value as EstimateStatus})}>
                                      <option value="DRAFT">Borrador</option>
                                      <option value="SENT">Enviado</option>
                                      <option value="APPROVED">Aprobado</option>
                                      <option value="PRODUCTION">En Producción</option>
                                      <option value="REJECTED">Rechazado</option>
                                      <option value="CANCELLED">Cancelado</option>
                                      <option value="FINISHED">Finalizado</option>
                                      <option value="ARCHIVED">Archivado</option>
                                  </select>
                              </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Lista de Precios (Opcional)</label>
                              <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                    value={estimateForm.priceListId} onChange={e => setEstimateForm({...estimateForm, priceListId: e.target.value})}>
                                    <option value="">Ninguna...</option>
                                    {priceLists.map(pl => (
                                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                                    ))}
                                </select>
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
