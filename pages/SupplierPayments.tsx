
import React, { useState } from 'react';
import { SupplierPayment, User, Supplier, Project } from '../types';
import { Plus, Search, Calendar, DollarSign, X, Truck, Pencil, Archive, Check, Building2, Filter } from 'lucide-react';

interface SupplierPaymentsProps {
  payments: SupplierPayment[];
  suppliers: Supplier[];
  projects: Project[];
  user: User;
  onAddPayment: (payment: SupplierPayment) => void;
  onUpdatePayment: (payment: SupplierPayment) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

const SupplierPayments: React.FC<SupplierPaymentsProps> = ({ payments, suppliers, projects, user, onAddPayment, onUpdatePayment, onAddSupplier }) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  
  // State for Editing
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Form State for Payment
  const [paymentForm, setPaymentForm] = useState({
      providerName: '',
      projectId: '',
      concept: '',
      downPayment: 0,
      downPaymentDate: '',
      balance: 0,
      balanceDate: ''
  });

  // Form State for Supplier
  const [supplierForm, setSupplierForm] = useState({
      name: '',
      contactName: '',
      phone: '',
      email: '',
      category: ''
  });

  const getProjectName = (id?: string) => {
    if(!id) return '- General / Stock -';
    return projects.find(p => p.id === id)?.title || 'Proyecto Desconocido';
  }

  const filteredPayments = payments.filter(p => {
    // Hide archived unless specific toggle (simplified: hide if archived)
    if (p.status === 'ARCHIVED') return false; 
    
    const matchesSearch = p.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.concept.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProject = filterProjectId ? p.projectId === filterProjectId : true;

    return matchesSearch && matchesProject;
  });

  // Calculate Totals for Footer
  const totalFilteredBalance = filteredPayments.reduce((sum, p) => sum + p.balance, 0);
  const totalFilteredAmount = filteredPayments.reduce((sum, p) => sum + p.totalAmount, 0);

  // --- Handlers ---

  const handleOpenCreatePayment = () => {
      setEditingPaymentId(null);
      setPaymentForm({
          providerName: '',
          projectId: '',
          concept: '',
          downPayment: 0,
          downPaymentDate: '',
          balance: 0,
          balanceDate: ''
      });
      setIsPaymentModalOpen(true);
  };

  const handleOpenEditPayment = (payment: SupplierPayment) => {
      setEditingPaymentId(payment.id);
      setPaymentForm({
          providerName: payment.providerName,
          projectId: payment.projectId || '',
          concept: payment.concept,
          downPayment: payment.downPayment,
          downPaymentDate: payment.downPaymentDate,
          balance: payment.balance,
          balanceDate: payment.balanceDate
      });
      setIsPaymentModalOpen(true);
  };

  const handleArchivePayment = (payment: SupplierPayment) => {
      // Allow archiving even if balance > 0, but show warning
      const isPaid = payment.balance === 0;
      const confirmMessage = isPaid 
        ? "¿Está seguro de que desea archivar este pago? Se moverá al historial."
        : "¡ATENCIÓN! Este pago tiene saldo pendiente. ¿Está seguro de que desea archivarlo?";

      if (!confirm(confirmMessage)) return;

      const updated: SupplierPayment = {
          ...payment,
          status: 'ARCHIVED'
      };
      onUpdatePayment(updated);
  };

  const handleProjectChange = (projectId: string) => {
      const selectedProject = projects.find(p => p.id === projectId);
      
      setPaymentForm(prev => ({
          ...prev,
          projectId: projectId,
          // Auto-fill dates based on Project data if available, else keep existing or empty
          downPaymentDate: selectedProject?.productionStartDate || prev.downPaymentDate,
          balanceDate: selectedProject?.deadline || prev.balanceDate
      }));
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
      e.preventDefault();
      const total = Number(paymentForm.downPayment) + Number(paymentForm.balance);
      
      // Determine Status: If balance is 0, it's PAID, else PENDING.
      const status = Number(paymentForm.balance) === 0 ? 'PAID' : 'PENDING';

      if (editingPaymentId) {
          // Update Mode
          const existing = payments.find(p => p.id === editingPaymentId);
          if (existing) {
              const updated: SupplierPayment = {
                  ...existing,
                  providerName: paymentForm.providerName,
                  projectId: paymentForm.projectId,
                  concept: paymentForm.concept,
                  downPayment: Number(paymentForm.downPayment),
                  downPaymentDate: paymentForm.downPaymentDate,
                  balance: Number(paymentForm.balance),
                  balanceDate: paymentForm.balanceDate,
                  totalAmount: total,
                  status: status
              };
              onUpdatePayment(updated);
          }
      } else {
          // Create Mode
          const payment: SupplierPayment = {
              id: `sp${Date.now()}`,
              providerName: paymentForm.providerName,
              projectId: paymentForm.projectId,
              concept: paymentForm.concept,
              downPayment: Number(paymentForm.downPayment),
              downPaymentDate: paymentForm.downPaymentDate,
              balance: Number(paymentForm.balance),
              balanceDate: paymentForm.balanceDate,
              totalAmount: total,
              status: status
          };
          onAddPayment(payment);
      }
      
      setIsPaymentModalOpen(false);
  };

  const handleSubmitSupplier = (e: React.FormEvent) => {
      e.preventDefault();
      const newSupplier: Supplier = {
          id: `s${Date.now()}`,
          ...supplierForm
      };
      onAddSupplier(newSupplier);
      setIsSupplierModalOpen(false);
      setSupplierForm({ name: '', contactName: '', phone: '', email: '', category: '' });
  };

  const calculatedTotal = Number(paymentForm.downPayment) + Number(paymentForm.balance);
  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex justify-between items-center border-b border-gray-200 pb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Pago a Proveedores</h2>
          <p className="text-roden-gray text-sm mt-1">Control de costos de materiales y servicios externos.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
             {/* Filter Section */}
             <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        className="bg-transparent text-roden-black pl-9 pr-4 py-1.5 rounded-lg text-sm w-32 focus:outline-none placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <select 
                    className="bg-transparent text-sm text-roden-black focus:outline-none py-1.5 pr-2 max-w-[150px]"
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                >
                    <option value="">Todas las Obras</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
                {(searchTerm || filterProjectId) && (
                    <button onClick={() => { setSearchTerm(''); setFilterProjectId(''); }} className="text-gray-400 hover:text-red-500 p-1">
                        <X size={14} />
                    </button>
                )}
             </div>
            
            {/* Buttons Row */}
            {isAdmin && (
                <>
                    <button 
                        onClick={() => setIsSupplierModalOpen(true)}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Plus size={16} /> Alta Proveedor
                    </button>
                    <button 
                        onClick={handleOpenCreatePayment}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 shadow-lg shadow-gray-200 flex items-center gap-2">
                        <Plus size={16} /> Nuevo Item
                    </button>
                </>
            )}
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proveedor / Concepto</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Obra / Proyecto</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Anticipo Entregado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Pendiente</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Monto Total</th>
                      {isAdmin && <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>}
                  </tr>
              </thead>
              <tbody>
                  {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                                     <Truck size={16} />
                                 </div>
                                 <div>
                                     <p className="text-sm font-bold text-roden-black">{payment.providerName}</p>
                                     <p className="text-xs text-gray-500">{payment.concept}</p>
                                 </div>
                             </div>
                          </td>
                          <td className="py-4 px-6">
                              <p className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1">
                                  <Building2 size={12} />
                                  {getProjectName(payment.projectId)}
                              </p>
                          </td>
                          <td className="py-4 px-6">
                              <p className="text-sm font-medium text-emerald-600">${payment.downPayment.toLocaleString()}</p>
                              {payment.downPaymentDate && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                                      <Calendar size={10} /> {payment.downPaymentDate}
                                  </div>
                              )}
                          </td>
                          <td className="py-4 px-6">
                              <p className={`text-sm font-medium ${payment.balance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  ${payment.balance.toLocaleString()}
                              </p>
                              {payment.balanceDate && payment.balance > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                                      <Calendar size={10} /> Vence: {payment.balanceDate}
                                  </div>
                              )}
                              {payment.balance === 0 && (
                                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1">
                                      <Check size={10} /> PAGADO
                                  </span>
                              )}
                          </td>
                          <td className="py-4 px-6 text-right">
                              <span className="text-sm font-bold text-roden-black bg-gray-100 px-3 py-1 rounded-full">
                                  ${payment.totalAmount.toLocaleString()}
                              </span>
                          </td>
                          {isAdmin && (
                              <td className="py-4 px-6 text-right">
                                  <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => handleOpenEditPayment(payment)}
                                        className="text-gray-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors"
                                        title="Editar Item"
                                      >
                                          <Pencil size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleArchivePayment(payment)}
                                        className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors"
                                        title="Archivar Item"
                                      >
                                          <Archive size={14} />
                                      </button>
                                  </div>
                              </td>
                          )}
                      </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                      <tr>
                          <td colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-gray-400">
                              No se encontraron registros activos.
                          </td>
                      </tr>
                  )}
              </tbody>
              {filteredPayments.length > 0 && (
                <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                         <td colSpan={3} className="py-4 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                             Totales ({filterProjectId ? 'Filtrado' : 'General'}):
                         </td>
                         <td className="py-4 px-6">
                             <p className="text-sm font-bold text-amber-700">${totalFilteredBalance.toLocaleString()}</p>
                         </td>
                         <td className="py-4 px-6 text-right">
                             <p className="text-sm font-bold text-roden-black">${totalFilteredAmount.toLocaleString()}</p>
                         </td>
                         {isAdmin && <td></td>}
                    </tr>
                </tfoot>
              )}
          </table>
      </div>

       {/* Payment Modal (Create/Edit) */}
       {isPaymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-roden-black">{editingPaymentId ? 'Editar Item' : 'Nuevo Pago a Proveedor'}</h3>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto Relacionado (Opcional)</label>
                          <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                             value={paymentForm.projectId}
                             onChange={(e) => handleProjectChange(e.target.value)}
                          >
                              <option value="">Seleccionar Proyecto...</option>
                              {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                              ))}
                          </select>
                          <p className="text-[10px] text-gray-400 mt-1">Seleccionar un proyecto autocompletará las fechas sugeridas.</p>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (Seleccionar)</label>
                          <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                             value={paymentForm.providerName}
                             onChange={(e) => setPaymentForm({...paymentForm, providerName: e.target.value})}
                          >
                              <option value="">Seleccionar de la lista...</option>
                              {suppliers.map(s => (
                                  <option key={s.id} value={s.name}>{s.name} ({s.category})</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Concepto / Materiales</label>
                          <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                 value={paymentForm.concept} onChange={e => setPaymentForm({...paymentForm, concept: e.target.value})} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Anticipo Entregado</label>
                            <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                   value={paymentForm.downPayment} onChange={e => setPaymentForm({...paymentForm, downPayment: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Anticipo</label>
                            <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                value={paymentForm.downPaymentDate} onChange={e => setPaymentForm({...paymentForm, downPaymentDate: e.target.value})} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Pendiente</label>
                            <input required type="number" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                   value={paymentForm.balance} onChange={e => setPaymentForm({...paymentForm, balance: Number(e.target.value)})} />
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Pago Saldo</label>
                            <input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                value={paymentForm.balanceDate} onChange={e => setPaymentForm({...paymentForm, balanceDate: e.target.value})} />
                         </div>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg flex justify-between items-center border border-gray-200 mt-2">
                          <span className="text-sm font-bold text-gray-600">Monto Final Total</span>
                          <span className="text-xl font-bold text-roden-black">${calculatedTotal.toLocaleString()}</span>
                      </div>

                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                              {editingPaymentId ? 'Guardar Cambios' : 'Registrar Pago'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Supplier Modal (New Provider) */}
      {isSupplierModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-roden-black">Alta Nuevo Proveedor</h3>
                      <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmitSupplier} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa / Proveedor</label>
                          <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                 value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto Principal</label>
                            <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                    value={supplierForm.contactName} onChange={e => setSupplierForm({...supplierForm, contactName: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                    value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                             <input type="email" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                    value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Rubro / Categoría</label>
                              <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                 value={supplierForm.category} onChange={e => setSupplierForm({...supplierForm, category: e.target.value})}>
                                 <option value="">Seleccionar...</option>
                                 <option value="Maderas">Maderas y Placas</option>
                                 <option value="Herrajes">Herrajes</option>
                                 <option value="Marmoleria">Marmolería</option>
                                 <option value="Vidrio">Vidrio</option>
                                 <option value="Flete">Logística / Flete</option>
                                 <option value="Insumos">Insumos Taller</option>
                                 <option value="Servicios">Servicios (Luz/Gas/etc)</option>
                             </select>
                          </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                              Guardar Proveedor
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default SupplierPayments;
