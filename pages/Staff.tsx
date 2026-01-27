import React, { useState } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { Shield, User as UserIcon, Phone, ShieldCheck, Plus, X, MessageCircle, Calendar, Hammer } from 'lucide-react';

interface StaffProps {
  users: User[];
  onAddUser: (user: User) => void;
}

const Staff: React.FC<StaffProps> = ({ users, onAddUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
      name: '',
      email: '',
      phone: '',
      role: 'USER' as UserRole,
      status: 'ACTIVE' as UserStatus,
      joinedDate: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const user: User = {
          id: `u${Date.now()}`,
          name: newUser.name,
          email: newUser.email, // Kept for data structure consistency
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          joinedDate: newUser.joinedDate,
          avatarInitials: newUser.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
      };
      onAddUser(user);
      setIsModalOpen(false);
      setNewUser({ 
          name: '', 
          email: '', 
          phone: '', 
          role: 'USER', 
          status: 'ACTIVE', 
          joinedDate: new Date().toISOString().split('T')[0] 
      });
  };

  const getWhatsappLink = (phone: string) => {
      // Remove spaces, +, -, (, )
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return `https://wa.me/${cleanPhone}`;
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Personal</h2>
          <p className="text-roden-gray text-sm mt-1">Gestión de usuarios, roles y permisos del sistema.</p>
        </div>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
            <Plus size={16} /> Dar de Alta Usuario
        </button>
      </header>

      {/* Role Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Admin Card */}
          <div className="bg-roden-black text-white p-6 rounded-xl relative overflow-hidden group hover:shadow-lg transition-shadow">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <ShieldCheck size={100} />
               </div>
               <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                   <ShieldCheck size={20} className="text-emerald-400" /> Administrador
               </h3>
               <p className="text-gray-300 text-sm mb-4">Control total del negocio.</p>
               <ul className="text-[11px] space-y-2 text-gray-400">
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Finanzas y Presupuestos</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Gestión de Clientes</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Edición de Proyectos</li>
               </ul>
          </div>

           {/* Manager Taller Card */}
           <div className="bg-slate-700 text-white p-6 rounded-xl relative overflow-hidden group hover:shadow-lg transition-shadow">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Hammer size={100} />
               </div>
               <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                   <Hammer size={20} className="text-sky-300" /> Manager Taller
               </h3>
               <p className="text-slate-300 text-sm mb-4">Gestión productiva y logística.</p>
               <ul className="text-[11px] space-y-2 text-slate-400">
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div> Visualización Proyectos (Taller)</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div> Visualización Proveedores</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-sky-400"></div> Gestión completa Taller y Tareas</li>
               </ul>
          </div>
          
          {/* Operator Card */}
          <div className="bg-white border border-roden-border p-6 rounded-xl relative overflow-hidden group hover:shadow-lg transition-shadow">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <UserIcon size={100} />
               </div>
               <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-roden-black">
                   <UserIcon size={20} className="text-indigo-600" /> Operario Taller
               </h3>
               <p className="text-gray-500 text-sm mb-4">Acceso operativo limitado.</p>
               <ul className="text-[11px] space-y-2 text-gray-500">
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Mis Tareas</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Módulo Taller (Producción)</li>
                   <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Asistente IA</li>
               </ul>
          </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Contacto</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Rol</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha Alta</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Estado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acción</th>
                  </tr>
              </thead>
              <tbody>
                  {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                      user.role === 'ADMIN' ? 'bg-roden-black' : 
                                      user.role === 'WORKSHOP_MANAGER' ? 'bg-slate-700' : 'bg-indigo-600'
                                  }`}>
                                      {user.avatarInitials}
                                  </div>
                                  <span className="text-sm font-bold text-roden-black">{user.name}</span>
                              </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                  <Phone size={14} /> {user.phone}
                              </div>
                          </td>
                          <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  user.role === 'ADMIN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  user.role === 'WORKSHOP_MANAGER' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                                  'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                  {user.role === 'ADMIN' ? <Shield size={12} /> : user.role === 'WORKSHOP_MANAGER' ? <Hammer size={12} /> : <UserIcon size={12} />}
                                  {user.role === 'ADMIN' ? 'ADMINISTRADOR' : user.role === 'WORKSHOP_MANAGER' ? 'MANAGER TALLER' : 'OPERARIO'}
                              </span>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-gray-400" /> {user.joinedDate}
                              </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                              <span className={`text-xs font-bold px-2 py-1 rounded ${
                                  user.status === 'ACTIVE' 
                                  ? 'text-emerald-600 bg-emerald-50' 
                                  : 'text-gray-500 bg-gray-100'
                              }`}>
                                  {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                              </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <a 
                                href={getWhatsappLink(user.phone)} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title="Enviar WhatsApp"
                             >
                                 <MessageCircle size={16} />
                             </a>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

       {/* New User Modal */}
       {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100">
                      <h3 className="text-xl font-bold text-roden-black">Dar de Alta Usuario</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                          <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                 value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                 value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                                 <option value="USER">Operario Taller</option>
                                 <option value="WORKSHOP_MANAGER">Manager Taller</option>
                                 <option value="ADMIN">Administrador</option>
                             </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                            <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                    value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                             <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                 value={newUser.status} onChange={e => setNewUser({...newUser, status: e.target.value as UserStatus})}>
                                 <option value="ACTIVE">Activo</option>
                                 <option value="INACTIVE">Inactivo</option>
                             </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta</label>
                            <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                value={newUser.joinedDate} onChange={e => setNewUser({...newUser, joinedDate: e.target.value})} />
                          </div>
                      </div>
                      <div className="pt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                              Cancelar
                          </button>
                          <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                              Confirmar Alta
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Staff;