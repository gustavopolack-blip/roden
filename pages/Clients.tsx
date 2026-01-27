
import React, { useState } from 'react';
import { Client, ClientType, ClientOrigin } from '../types';
import { Search, MapPin, Phone, Tag, Mail, Plus, X, Building2, User, Calendar, Globe, Share2, Heart, Smile } from 'lucide-react';

interface ClientsProps {
  clients: Client[];
  onAddClient: (newClient: Client) => void;
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

const Clients: React.FC<ClientsProps> = ({ clients, onAddClient }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      address: '',
      type: 'INDIVIDUAL' as ClientType,
      joinedDate: new Date().toISOString().split('T')[0],
      origin: 'WEBSITE' as ClientOrigin,
      notes: ''
  });

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newClient: Client = {
          id: `c${Date.now()}`,
          name: formData.name,
          email: formData.email,
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
      setIsModalOpen(false);
      setFormData({ 
          name: '', 
          email: '', 
          phone: '', 
          address: '', 
          type: 'INDIVIDUAL', 
          joinedDate: new Date().toISOString().split('T')[0],
          origin: 'WEBSITE',
          notes: '' 
      });
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
                onClick={() => setIsModalOpen(true)}
                className="bg-roden-black text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200"
            >
                <Plus size={18} /> Agregar Cliente
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          // Color logic based on type
          // Company = Blue gradients
          // Individual = Indigo/Purple gradients
          const bgGradient = client.type === 'COMPANY' 
            ? 'from-blue-600 to-cyan-500' 
            : 'from-indigo-600 to-purple-600';

          const OriginIcon = ORIGIN_ICONS[client.origin] || Globe;

          return (
            <div key={client.id} className="bg-white border border-roden-border rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 duration-300 group">
              {/* Colorful Header */}
              <div className={`h-24 bg-gradient-to-r ${bgGradient} p-6 relative`}>
                <div className="absolute -bottom-6 left-6">
                    <div className="w-16 h-16 rounded-full bg-white p-1 shadow-md">
                        <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center text-roden-black font-bold text-xl border border-gray-100">
                            {client.type === 'COMPANY' ? <Building2 size={24} className="text-blue-600" /> : <User size={24} className="text-indigo-600" />}
                        </div>
                    </div>
                </div>
                <div className="absolute top-4 right-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border tracking-wide bg-white/90 backdrop-blur-sm ${
                        client.status === 'ACTIVE' ? 'text-emerald-700 border-emerald-200' :
                        client.status === 'LEAD' ? 'text-amber-700 border-amber-200' :
                        'text-gray-500 border-gray-200'
                    }`}>
                        {client.status === 'ACTIVE' ? 'ACTIVO' : client.status === 'LEAD' ? 'POTENCIAL' : client.status}
                    </span>
                </div>
              </div>

              <div className="pt-10 px-6 pb-6">
                <h3 className="text-xl font-bold text-roden-black mb-1 group-hover:text-indigo-600 transition-colors">{client.name}</h3>
                <div className="flex justify-between items-center mb-4">
                     <p className="text-xs text-gray-400 font-medium uppercase tracking-wide flex items-center gap-1">
                        {client.type === 'COMPANY' ? 'Empresa' : 'Particular'} • #{client.id.toUpperCase()}
                     </p>
                     {client.joinedDate && (
                         <p className="text-[10px] text-gray-400 flex items-center gap-1">
                             <Calendar size={10} /> {client.joinedDate}
                         </p>
                     )}
                </div>
                
                <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                         <Mail size={14} />
                    </div>
                    <span>{client.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                         <MapPin size={14} />
                    </div>
                    <span>{client.address}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                         <Phone size={14} />
                    </div>
                    <span>{client.phone}</span>
                </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                    {/* Origin Badge */}
                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                        <OriginIcon size={10} /> {ORIGIN_LABELS[client.origin]}
                    </div>
                    {client.tags.map(tag => (
                        <div key={tag} className="flex items-center gap-1 text-[10px] uppercase font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-100">
                        {tag}
                        </div>
                    ))}
                </div>
                
                <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Valor Histórico</span>
                    <span className="text-lg font-bold text-roden-black">${client.totalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-roden-black">Nuevo Cliente</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo / Razón Social</label>
                          <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                 value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input required type="email" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                    value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
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
                              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta</label>
                              <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                     value={formData.joinedDate} onChange={e => setFormData({...formData, joinedDate: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Obra</label>
                            <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none" 
                                  value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notas Iniciales</label>
                          <textarea className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none h-24 resize-none" 
                                 value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} ></textarea>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                              Guardar Cliente
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Clients;
