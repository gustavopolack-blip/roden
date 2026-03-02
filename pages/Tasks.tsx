
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, Project, TaskPriority, User } from '../types';
import { CheckCircle2, Clock, MoreHorizontal, Plus, X, Filter, UserPlus, Trash2 } from 'lucide-react';

interface TasksProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  currentUser?: User | null;
  onAddTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const Tasks: React.FC<TasksProps> = ({ tasks, projects, users, currentUser, onAddTask, onDeleteTask }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  
  const [newTask, setNewTask] = useState({
      title: '',
      assignee: '',
      dueDate: '',
      priority: 'MEDIUM' as TaskPriority,
      projectId: ''
  });

  const isAdmin = currentUser?.role === 'administrador';

  const getProjectTitle = (id?: string) => {
      if (!id) return 'General';
      return projects.find(p => p.id === id)?.title || 'Proyecto Desconocido';
  };

  const priorityStyles = {
      'HIGH': 'bg-rose-50 text-rose-600 border-rose-200',
      'MEDIUM': 'bg-amber-50 text-amber-600 border-amber-200',
      'LOW': 'bg-blue-50 text-blue-600 border-blue-200'
  };

  const filteredTasks = tasks.filter(task => {
      const matchesProject = filterProjectId ? task.projectId === filterProjectId : true;
      const matchesAssignee = filterAssignee ? task.assignee === filterAssignee : true;
      return matchesProject && matchesAssignee;
  });

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const task: Task = {
          id: `t${Date.now()}`,
          title: newTask.title,
          assignee: newTask.assignee,
          dueDate: newTask.dueDate,
          priority: newTask.priority,
          projectId: newTask.projectId || undefined,
          completed: false,
          createdBy: currentUser?.name || 'Sistema'
      };
      onAddTask(task);
      setIsModalOpen(false);
      setNewTask({ title: '', assignee: '', dueDate: '', priority: 'MEDIUM', projectId: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <header className="flex flex-col gap-6 border-b border-gray-200 pb-6">
        <div className="flex justify-between items-center">
            <div>
            <h2 className="text-3xl font-bold text-roden-black tracking-tight">Mis Tareas</h2>
            <p className="text-roden-gray text-sm mt-1">Organización diaria y prioridades.</p>
            </div>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
                <Plus size={16} /> Nueva Tarea
            </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mr-2">
                <Filter size={16} /> Filtros:
            </div>
            <div className="flex-1 max-w-xs">
                <select 
                    className="w-full bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                >
                    <option value="">Todos los Proyectos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
            </div>
            <div className="flex-1 max-w-xs">
                <select 
                    className="w-full bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                >
                    <option value="">Todos los Usuarios</option>
                    {users.map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                </select>
            </div>
            {(filterProjectId || filterAssignee) && (
                 <button 
                    onClick={() => { setFilterProjectId(''); setFilterAssignee(''); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium underline ml-auto"
                >
                    Limpiar Filtros
                </button>
            )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map(task => (
              <div key={task.id} className="bg-white border border-roden-border p-4 rounded-xl shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                      <button className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          task.completed 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-gray-300 text-transparent hover:border-indigo-500'
                      }`}>
                          <CheckCircle2 size={14} />
                      </button>
                      
                      <div>
                          <h4 className={`text-sm font-bold ${task.completed ? 'text-gray-400 line-through' : 'text-roden-black'}`}>
                              {task.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                                  {getProjectTitle(task.projectId)}
                              </span>
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock size={12} /> {task.dueDate}
                              </span>
                          </div>
                      </div>
                  </div>

                  <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end gap-1">
                           <div className="text-right flex items-center gap-2">
                               <div className="text-right hidden md:block">
                                   <p className="text-[10px] text-gray-400 uppercase tracking-wide">Asignado a</p>
                                   <p className="text-xs font-bold text-gray-700">{task.assignee}</p>
                               </div>
                               <div className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${priorityStyles[task.priority]}`}>
                                   {task.priority === 'HIGH' ? 'ALTA' : task.priority === 'MEDIUM' ? 'MEDIA' : 'BAJA'}
                               </div>
                           </div>
                           {task.createdBy && (
                               <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                   <UserPlus size={10} /> Creado por: <span className="font-medium text-gray-500">{task.createdBy}</span>
                               </p>
                           )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Only ADMIN can see delete button */}
                        {isAdmin && (
                            <button 
                                onClick={() => onDeleteTask(task.id)}
                                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                title="Eliminar/Archivar Tarea"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        {!isAdmin && (
                             <button className="text-gray-300 cursor-not-allowed opacity-50 p-2">
                                <MoreHorizontal size={18} />
                             </button>
                        )}
                      </div>
                  </div>
              </div>
          ))}
          {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                  <p>No se encontraron tareas con los filtros seleccionados.</p>
              </div>
          )}
      </div>

      {/* New Task Modal - Using Portal */}
      {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 relative">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">Nueva Tarea</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <form onSubmit={handleSubmit} className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción de la Tarea</label>
                              <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                     value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
                                <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                       value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})}>
                                    <option value="">Seleccionar Usuario...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.name}>{u.name}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
                                <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto Relacionado</label>
                                 <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={newTask.projectId} onChange={e => setNewTask({...newTask, projectId: e.target.value})}>
                                     <option value="">Ninguno / General</option>
                                     {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                 </select>
                             </div>
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                                 <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value as TaskPriority})}>
                                     <option value="LOW">Baja</option>
                                     <option value="MEDIUM">Media</option>
                                     <option value="HIGH">Alta</option>
                                 </select>
                             </div>
                          </div>
                          <div className="pt-4 flex justify-end gap-3 bg-white border-t border-gray-100 sticky bottom-0 rounded-b-2xl p-4 -mx-6 -mb-6 mt-2">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                                  Cancelar
                              </button>
                              <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                                  Crear Tarea
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

export default Tasks;
