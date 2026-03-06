
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, UserStatus } from '../types';
import { Shield, User as UserIcon, Phone, ShieldCheck, Plus, X, MessageCircle, Calendar, Hammer, Lock, Mail, Edit, Loader2, Trash2 } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabaseClient';
import { createClient } from '@supabase/supabase-js';

interface StaffProps {
  users: User[];
  onAddUser: (user: User) => void;
}

const Staff: React.FC<StaffProps> = ({ users, onAddUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedAdmin = async () => {
      setIsSeeding(true);
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
              alert("Debes estar logueado para crear tu perfil.");
              return;
          }

          const newProfile = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
              role: 'administrador',
              status: 'ACTIVE',
              joined_date: new Date().toISOString().split('T')[0],
              avatar_initials: (session.user.user_metadata?.name || session.user.email || '??').substring(0, 2).toUpperCase()
          };

          const { error } = await supabase.from('users').insert(newProfile);
          if (error) throw error;
          
          alert("Perfil de administrador creado correctamente.");
          window.location.reload();
      } catch (error: any) {
          console.error("Error seeding admin:", error);
          alert("Error al crear perfil: " + error.message);
      } finally {
          setIsSeeding(false);
      }
  };

  const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      role: 'operario_taller' as UserRole,
      status: 'ACTIVE' as UserStatus,
      joinedDate: new Date().toISOString().split('T')[0],
      password: '' // Only used for creation
  });

  const openCreateModal = () => {
      setIsEditMode(false);
      setEditingUserId(null);
      setFormData({
          name: '',
          email: '',
          phone: '',
          role: 'operario_taller',
          status: 'ACTIVE',
          joinedDate: new Date().toISOString().split('T')[0],
          password: ''
      });
      setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
      setIsEditMode(true);
      setEditingUserId(user.id);
      setFormData({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          joinedDate: user.joinedDate,
          password: '' 
      });
      setIsModalOpen(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
      if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) {
          return;
      }

      setLoading(true);
      try {
          const { error } = await supabase.from('users').delete().eq('id', userId);
          if (error) throw error;
          
          // Force refresh to update list
          window.location.reload();
      } catch (error: any) {
          alert("Error eliminando usuario: " + error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          if (isEditMode && editingUserId) {
              // UPDATE MODE (Lógica existente)
              const { error } = await supabase.from('users').update({
                  name: formData.name,
                  phone: formData.phone,
                  role: formData.role,
                  status: formData.status,
                  joinedDate: formData.joinedDate
              }).eq('id', editingUserId);

              if (error) throw error;
              window.location.reload();
          } else {
              // CREATE MODE - ADMIN CREA USUARIO CON PASSWORD
              
              // 2. Crear usuario en Auth (Auth.users)
              // NOTA: En un entorno cliente real, no podemos crear usuarios con contraseña directamente sin ser admin (service_role).
              // La única forma segura desde el cliente es invitar al usuario o usar una Edge Function.
              // Sin embargo, para este prototipo, intentaremos usar signUp. Si hay sesión activa, esto podría fallar o cambiar la sesión actual.
              // La solución correcta es usar una segunda instancia de cliente PERO eso requiere anon key y no tiene permisos de admin.
              // Por lo tanto, la creación de usuarios debe hacerse desde el panel de Supabase o mediante una función backend.
              
              // INTENTO DE SOLUCIÓN HÍBRIDA:
              // Usamos signUp. Si funciona, genial. Si no, avisamos.
              // ADVERTENCIA: signUp iniciará sesión automáticamente con el nuevo usuario, cerrando la del admin.
              // Para evitar esto, deberíamos usar una Edge Function. Como no tenemos, avisaremos al usuario.

              alert("AVISO: Al crear un usuario desde aquí, se cerrará tu sesión actual y quedarás logueado como el nuevo usuario. Esto es una limitación de seguridad de Supabase en el lado del cliente. Deberás volver a iniciar sesión como administrador.");

              const { data: authData, error: authError } = await supabase.auth.signUp({
                  email: formData.email,
                  password: formData.password,
                  options: {
                      data: {
                          name: formData.name,
                          role: formData.role
                      }
                  }
              });

              if (authError) {
                  if (authError.message.includes("already registered")) {
                       // Si ya existe en Auth, intentamos crear solo el perfil en public.users
                       // Pero necesitamos el ID. No podemos obtenerlo sin loguearnos.
                       // Asumimos que el usuario debe contactar soporte o el admin debe borrarlo.
                       throw new Error("El usuario ya existe en Auth. Por favor, bórralo desde el panel de Supabase o usa otro email.");
                  }
                  throw authError;
              }
              
              if (!authData.user) throw new Error("No se pudo crear el usuario en Auth.");
              
              // 3. Crear perfil en Public (Public.users) - ELIMINADO
              // Ahora confiamos en el trigger on_auth_user_created definido en migration_auth_trigger.sql
              // para insertar automáticamente en public.users al crear el usuario en Auth.
              
              // Simulamos el objeto User para actualizar la UI inmediatamente (optimistic update)
              const newUserProfile: User = {
                  id: authData.user.id,
                  name: formData.name,
                  email: formData.email || '',
                  phone: formData.phone,
                  role: formData.role,
                  status: formData.status,
                  joinedDate: formData.joinedDate,
                  avatarInitials: formData.name.substring(0, 2).toUpperCase()
              };
              
              onAddUser(newUserProfile);
              alert(`Usuario creado exitosamente.\n\nEmail: ${formData.email}\nPassword: ${formData.password}\n\nTu sesión se ha cerrado automáticamente por seguridad. Por favor, vuelve a ingresar con tu cuenta de administrador.`);
              window.location.reload(); // Recargar para forzar login de nuevo o manejar el estado
              setIsModalOpen(false);
          }
      } catch (error: any) {
          console.error("Error creating user:", error);
          alert("Error: " + (error.message || JSON.stringify(error)));
      } finally {
          setLoading(false);
      }
  };

  const getWhatsappLink = (phone: string) => {
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
            onClick={openCreateModal}
            className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
            <Plus size={16} /> Nuevo Usuario
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
                   <Hammer size={20} className="text-sky-300" /> Gerente Taller
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
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Rol (Base de Datos)</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha Alta</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Estado</th>
                      <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acción</th>
                  </tr>
              </thead>
              <tbody>
                  {users.length === 0 ? (
                      <tr>
                          <td colSpan={6} className="py-12 text-center">
                               <p className="text-gray-400 italic mb-4">No se encontraron usuarios en la base de datos.</p>
                               <button 
                                  onClick={handleSeedAdmin}
                                  disabled={isSeeding}
                                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
                               >
                                   {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                   Crear mi Perfil de Administrador
                               </button>
                          </td>
                      </tr>
                  ) : users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                      user.role === 'administrador' ? 'bg-roden-black' : 
                                      user.role === 'gerente_taller' ? 'bg-slate-700' : 'bg-indigo-600'
                                  }`}>
                                      {user.avatarInitials}
                                  </div>
                                  <div>
                                      <p className="text-sm font-bold text-roden-black">{user.name}</p>
                                      <p className="text-[10px] text-gray-400">{user.email}</p>
                                  </div>
                              </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                  <Phone size={14} /> {user.phone}
                              </div>
                          </td>
                          <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  user.role === 'administrador' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  user.role === 'gerente_taller' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                                  'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                  {user.role === 'administrador' ? <Shield size={12} /> : user.role === 'gerente_taller' ? <Hammer size={12} /> : <UserIcon size={12} />}
                                  {user.role ? user.role.toUpperCase().replace('_', ' ') : 'SIN ROL'}
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
                             <div className="flex justify-end gap-2">
                                 <button 
                                    onClick={() => openEditModal(user)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                    title="Editar Usuario"
                                 >
                                     <Edit size={14} />
                                 </button>
                                 <button 
                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                    title="Eliminar Usuario"
                                 >
                                     <Trash2 size={14} />
                                 </button>
                                 <a 
                                    href={getWhatsappLink(user.phone)} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                    title="Enviar WhatsApp"
                                 >
                                     <MessageCircle size={16} />
                                 </a>
                             </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>

      {/* User Modal (Create/Edit) - Using Portal */}
      {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 relative flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white z-10 rounded-t-2xl shrink-0">
                      <h3 className="text-xl font-bold text-roden-black">{isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto p-6 space-y-4 grow">
                      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                              <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                     value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Login)</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input 
                                        required 
                                        type="email" 
                                        disabled={isEditMode} 
                                        className={`w-full p-2.5 pl-10 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none ${isEditMode ? 'bg-gray-100 text-gray-500' : ''}`}
                                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                                    />
                                </div>
                              </div>
                              
                                  {!isEditMode && (
                                      <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña de Acceso</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                            <input 
                                                required 
                                                type="text" 
                                                className="w-full p-2.5 pl-10 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none font-mono text-sm"
                                                placeholder="Ej: usuario123"
                                                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1">
                                            <span className="font-bold text-roden-black">Importante:</span> Copia esta contraseña y entrégasela al usuario. Él podrá cambiarla después.
                                        </p>
                                      </div>
                                  )}
                              </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                                     <option value="operario_taller">Operario Taller</option>
                                     <option value="gerente_taller">Gerente Taller</option>
                                     <option value="administrador">Administrador</option>
                                 </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                 <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as UserStatus})}>
                                     <option value="ACTIVE">Activo</option>
                                     <option value="INACTIVE">Inactivo</option>
                                 </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Alta</label>
                                <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={formData.joinedDate} onChange={e => setFormData({...formData, joinedDate: e.target.value})} />
                              </div>
                          </div>
                      </form>
                  </div>

                  <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl shrink-0 flex justify-end gap-3">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                          Cancelar
                      </button>
                      <button form="user-form" type="submit" disabled={loading} className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center gap-2">
                          {loading && <Loader2 size={16} className="animate-spin" />}
                          {isEditMode ? 'Guardar Cambios' : 'Confirmar Alta'}
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default Staff;
