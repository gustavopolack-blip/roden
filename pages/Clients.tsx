
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Client, ClientType, ClientOrigin } from '../types';
import { Search, MapPin, Phone, Tag, Mail, Plus, X, Building2, User, Calendar, Globe, Share2, Heart, Smile, Trash2 } from 'lucide-react';

interface ClientsProps {
  clients: Client[];
  onAddClient: (newClient: Client) => void;
  onUpdateClient: (updatedClient: Client) => void;
  onDeleteClient: (clientId: string) => void; // <-- Nueva Prop
}

const ORIGIN_LABELS: Record<ClientOrigin, string> = {
    'REFERRAL': 'Referido',
    'ORGANIC': 'Orgánico',
    'SOCIAL_MEDIA': 'Redes Sociales',
    'WEBSITE': 'Página Web'
};

const ORIGIN_ICONS: Record<ClientOrigin, any> = {
    'REFERRAL': Heart,
    'ORGANIC': Smile,
    'SOCIAL_MEDIA': Share2,
    'WEBSITE': Globe
};

const Clients: React.FC<ClientsProps> = ({ clients, onAddClient, onUpdateClient, onDeleteClient }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState({
      name: '',
      phone: '',
      address: '',
      type: 'INDIVIDUAL' as ClientType,
      joinedDate: new Date().toISOString().split('T')[0],
      origin: 'WEBSITE' as ClientOrigin,
      notes: '',
      status: 'LEAD' as any
  });

  // CORRECCIÓN ERROR 'SOME': Añadida validación opcional en tags
  const filteredClients = (clients || []).filter(client => 
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    client.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setFormData({ 
        name: '', 
        phone: '', 
        address: '', 
        type: 'INDIVIDUAL', 
        joinedDate: new Date().toISOString().split('T')[0],
        origin: 'WEBSITE',
        notes: '',
        status: 'LEAD'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
        name: client.name || '',
        phone: client.phone || '',
        address: client.address || '',
        type: client.type,
        joinedDate: client.joinedDate,
        origin: client.origin,
        notes: client.notes || '',
        status: client.status
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    console.log("[Clients.tsx] handleDeleteClick called for:", id, name);
    e.stopPropagation(); // Evita que se abra el modal de edición al hacer clic en borrar
    if (window.confirm(`¿Estás seguro de que deseas eliminar al cliente "${name}"? Esta acción no se puede deshacer.`)) {
      onDeleteClient(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (editingClient) {
          const updatedClient: Client = {
              ...editingClient,
              name: formData.name,
              phone: formData.phone,
              address: formData.address,
              notes: formData.notes,
              type: formData.type,
              joinedDate: formData.joinedDate,
              origin: formData.origin,
              status: formData.status
          };
          onUpdateClient(updatedClient);
      } else {
          const newClient: Client = {
              id: `c${Date.now()}`,
              name: formData.name,
              phone: formData.phone,
              address: formData.address,
              notes: formData.notes,
              type: formData.type,
              joinedDate: formData.joinedDate,
              origin: formData.origin,
              status: 'LEAD',
              tags: ['Nuevo'],
              totalValue: 0
          };
          onAddClient(newClient);
      }
      setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Clientes</h2>
          <p className="text-roden-gray text-sm mt-1">Directorio y gestión de relaciones.</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar clientes..." 
                    className="bg-white border border-gray-200 text-roden-black pl-10 pr-4 py-2.5 rounded-lg text-sm w-64 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={handleOpenAddModal}
                className="bg-roden-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200"
            >
                <Plus size={18} /> Agregar Cliente
            </button>
        </div>
      </header>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Cliente / Empresa</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Contacto</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Origen</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Valor Histórico</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-10">Acciones</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client) => {
                      const OriginIcon = ORIGIN_ICONS[client.origin] || Globe;
                      return (
                          <tr 
                            key={client.id} 
                            onClick={() => handleOpenEditModal(client)}
                            className="hover:bg-gray-50 transition-colors cursor-pointer group"
                          >
                              <td className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${client.type === 'COMPANY' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                                          {client.type === 'COMPANY' ? <Building2 size={14} /> : <User size={14} />}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-roden-black group-hover:text-indigo-600 transition-colors">{client.name}</p>
                                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">#{client.id.toString().substring(0,8)}</p>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <span className="text-xs text-gray-600">
                                      {client.type === 'COMPANY' ? 'Empresa' : 'Particular'}
                                  </span>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <Phone size={12} className="text-gray-400" />
                                          <span>{client.phone}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                          <MapPin size={12} className="text-gray-400" />
                                          <span className="truncate max-w-[150px]">{client.address}</span>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded w-fit border border-gray-200">
                                      <OriginIcon size={12} />
                                      <span>{ORIGIN_LABELS[client.origin]}</span>
                                  </div>
                              </td>
                              <td className="py-4 px-6">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border tracking-wide ${
                                      client.status === 'ACTIVE' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                                      client.status === 'LEAD' ? 'text-amber-700 border-amber-200 bg-amber-50' :
                                      'text-gray-500 border-gray-200 bg-gray-50'
                                  }`}>
                                      {client.status === 'ACTIVE' ? 'ACTIVO' : client.status === 'LEAD' ? 'POTENCIAL' : client.status}
                                  </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                  <p className="text-sm font-bold text-roden-black">${(client.totalValue || 0).toLocaleString()}</p>
                              </td>
                              <td className="py-4 px-6 text-center">
                                  <button 
                                    onClick={(e) => handleDeleteClick(e, client.id, client.name)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Eliminar cliente"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                              </td>
                          </tr>
                      );
                  })}
                  {filteredClients.length === 0 && (
                      <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                              No se encontraron clientes que coincidan con la búsqueda.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>

      {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">
                              {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                          </h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <form onSubmit={handleSubmit} className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo / Razón Social</label>
                              <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                     value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                        value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta</label>
                                  <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                         value={formData.joinedDate || ''} onChange={e => setFormData({...formData, joinedDate: e.target.value})} />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cliente</label>
                                 <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as ClientType})}>
                                     <option value="INDIVIDUAL">Particular</option>
                                     <option value="COMPANY">Empresa</option>
                                 </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Origen del Contacto</label>
                                <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                    value={formData.origin} onChange={e => setFormData({...formData, origin: e.target.value as ClientOrigin})}>
                                    <option value="WEBSITE">Página Web</option>
                                    <option value="SOCIAL_MEDIA">Redes Sociales</option>
                                    <option value="REFERRAL">Referido</option>
                                    <option value="ORGANIC">Orgánico</option>
                                </select>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Obra</label>
                                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                      value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                              </div>
                              {editingClient && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                    <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                        <option value="LEAD">Potencial</option>
                                        <option value="ACTIVE">Activo</option>
                                        <option value="INACTIVE">Inactivo</option>
                                    </select>
                                  </div>
                              )}
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Notas Iniciales</label>
                              <textarea className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none h-24 resize-none" 
                                     value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} ></textarea>
                          </div>
                          <div className="pt-4 flex justify-end gap-3 bg-white border-t border-gray-100">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                                  Cancelar
                              </button>
                              <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                                  {editingClient ? 'Guardar Cambios' : 'Guardar Cliente'}
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

export default Clients;