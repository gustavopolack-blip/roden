
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Client, ClientType, ClientOrigin, User as UserType } from '../types';
import { Search, MapPin, Phone, Plus, X, Building2, User as UserIcon, Globe, Share2, Heart, Smile, Trash2 } from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';

interface ClientsProps {
  clients: Client[];
  user: UserType;
  onAddClient: (newClient: Omit<Client, 'id'>) => void;
  onUpdateClient: (updatedClient: Client) => void;
  onDeleteClient: (clientId: string) => void;
}

const ORIGIN_LABELS: Record<ClientOrigin, string> = {
    'REFERRAL': 'Referido',
    'ORGANIC': 'Org\u00e1nico',
    'SOCIAL_MEDIA': 'Redes Sociales',
    'WEBSITE': 'P\u00e1gina Web',
    'OTHER': 'Otro'
};

const ORIGIN_ICONS: Record<ClientOrigin, any> = {
    'REFERRAL': Heart,
    'ORGANIC': Smile,
    'SOCIAL_MEDIA': Share2,
    'WEBSITE': Globe,
    'OTHER': UserIcon
};

const Clients: React.FC<ClientsProps> = ({ clients, user, onAddClient, onUpdateClient, onDeleteClient }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      address: '',
      type: 'INDIVIDUAL' as ClientType,
      joined_date: new Date().toISOString().split('T')[0],
      origin: 'WEBSITE' as ClientOrigin,
      notes: '',
      status: 'LEAD' as any,
      totalValue: 0
  });

  const filteredClients = (clients || []).filter(client => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = (client.name || '').toLowerCase().includes(term);
    const tagsMatch = Array.isArray(client.tags) && client.tags.some(tag => (tag || '').toLowerCase().includes(term));
    return nameMatch || tagsMatch;
  });

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setFormData({ name: '', phone: '', address: '', type: 'INDIVIDUAL', joined_date: new Date().toISOString().split('T')[0], origin: 'WEBSITE', notes: '', status: 'LEAD', totalValue: 0 });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({ name: client.name || '', phone: client.phone || '', address: client.address || '', type: client.type, joined_date: client.joined_date, origin: client.origin, notes: client.notes || '', status: client.status, totalValue: client.totalValue || 0 });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (window.confirm(`\u00bfEst\u00e1s seguro de que deseas eliminar al cliente "${name}"? Esta acci\u00f3n no se puede deshacer.`)) {
      onDeleteClient(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingClient) {
          const updatedClient: Client = { ...editingClient, name: formData.name, phone: formData.phone, address: formData.address, notes: formData.notes, type: formData.type, joined_date: formData.joined_date, origin: formData.origin, status: formData.status, totalValue: Number(formData.totalValue) || 0 };
          onUpdateClient(updatedClient);
      } else {
          const newClient: Omit<Client, 'id'> = { name: formData.name, phone: formData.phone, address: formData.address, notes: formData.notes, type: formData.type, joined_date: formData.joined_date, origin: formData.origin, status: 'LEAD', tags: ['Nuevo'], totalValue: 0 };
          onAddClient(newClient);
      }
      setIsModalOpen(false);
  };

  const statusClass = (status: string) => {
      if (status === 'ACTIVE') return 'text-emerald-700 border-emerald-200 bg-emerald-50';
      if (status === 'LEAD') return 'text-amber-700 border-amber-200 bg-amber-50';
      return 'text-gray-500 border-gray-200 bg-gray-50';
  };
  const statusLabel = (status: string) => {
      if (status === 'ACTIVE') return 'ACTIVO';
      if (status === 'LEAD') return 'POTENCIAL';
      return status;
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-roden-black tracking-tight">Clientes</h2>
          <p className="text-roden-gray text-sm mt-1">Directorio y gestión de relaciones.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex gap-2 items-center">
            <RodenAIButton mode="clientes_cartera" data={{ clients: filteredClients }} userRole={user.role} />
            <button onClick={handleOpenAddModal} className="bg-roden-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200 shrink-0">
              <Plus size={18} /> <span className="hidden xs:inline sm:inline">Agregar</span> Cliente
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Buscar clientes..." className="bg-white border border-gray-200 text-roden-black pl-10 pr-4 py-2.5 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Tabla — solo visible en sm+ */}
        <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Cliente / Empresa</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Tipo</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Contacto</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Origen</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Estado</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Valor Hist\u00f3rico (USD)</th>
              <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-10 whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredClients.map((client) => {
              const OriginIcon = ORIGIN_ICONS[client.origin] || Globe;
              return (
                <tr key={client.id} onClick={() => handleOpenEditModal(client)} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${client.type === 'COMPANY' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                        {client.type === 'COMPANY' ? <Building2 size={14} /> : <UserIcon size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-roden-black group-hover:text-indigo-600 transition-colors">{client.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">#{client.id.toString().substring(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs text-gray-600">{client.type === 'COMPANY' ? 'Empresa' : 'Particular'}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600"><Phone size={12} className="text-gray-400" /><span>{client.phone}</span></div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin size={12} className="text-gray-400" /><span className="truncate max-w-[150px]">{client.address}</span></div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded w-fit border border-gray-200">
                      <OriginIcon size={12} /><span>{ORIGIN_LABELS[client.origin]}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border tracking-wide ${statusClass(client.status)}`}>
                      {statusLabel(client.status)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="text-sm font-bold text-roden-black">
                      {client.totalValue
                        ? 'USD ' + client.totalValue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        : <span className="text-gray-300 font-normal text-xs">&mdash;</span>
                      }
                    </p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button onClick={(e) => handleDeleteClick(e, client.id, client.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar cliente">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">No se encontraron clientes que coincidan con la b\u00fasqueda.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Cards — solo visible en mobile */}
        <div className="sm:hidden divide-y divide-gray-100">
          {filteredClients.map((client) => {
            const OriginIcon = ORIGIN_ICONS[client.origin] || Globe;
            return (
              <div
                key={client.id}
                onClick={() => handleOpenEditModal(client)}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${client.type === 'COMPANY' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                  {client.type === 'COMPANY' ? <Building2 size={15} /> : <UserIcon size={15} />}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-roden-black truncate">{client.name}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border tracking-wide shrink-0 ${statusClass(client.status)}`}>
                      {statusLabel(client.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {client.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={10} />
                        {client.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <OriginIcon size={10} />
                      {ORIGIN_LABELS[client.origin]}
                    </span>
                  </div>
                </div>
                {/* Value */}
                <div className="text-right flex-shrink-0">
                  {client.totalValue ? (
                    <p className="text-sm font-bold text-roden-black">
                      USD {client.totalValue.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredClients.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No se encontraron clientes.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="flex min-h-full items-start sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-2xl w-full sm:max-w-lg shadow-2xl border-0 sm:border border-gray-200 min-h-screen sm:min-h-0">
              <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                <h3 className="text-xl font-bold text-roden-black">{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo / Raz\u00f3n Social</label>
                  <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tel\u00e9fono</label>
                    <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta</label>
                    <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" value={formData.joined_date || ''} onChange={e => setFormData({...formData, joined_date: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                    <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as ClientType})}>
                      <option value="INDIVIDUAL">Particular</option>
                      <option value="COMPANY">Empresa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origen del Contacto</label>
                    <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white" value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value as ClientOrigin})}>
                      <option value="WEBSITE">P\u00e1gina Web</option>
                      <option value="SOCIAL_MEDIA">Redes Sociales</option>
                      <option value="REFERRAL">Referido</option>
                      <option value="ORGANIC">Org\u00e1nico</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direcci\u00f3n / Obra</label>
                    <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  {editingClient && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                      <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="LEAD">Potencial</option>
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas Iniciales</label>
                  <textarea className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none h-24 resize-none" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                </div>
                {user.role === 'administrador' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor Hist\u00f3rico (USD)
                      <span className="ml-2 text-xs text-gray-400 font-normal">\u2014 Total facturado acumulado en d\u00f3lares</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">USD</span>
                      <input type="number" min="0" step="0.01" className="w-full pl-14 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" value={formData.totalValue || ''} onChange={e => setFormData({...formData, totalValue: parseFloat(e.target.value) || 0})} placeholder="0.00" />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-roden-black hover:bg-gray-800 rounded-lg transition-colors">{editingClient ? 'Guardar Cambios' : 'Crear Cliente'}</button>
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

export default Clients;
