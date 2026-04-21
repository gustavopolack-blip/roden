
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, Project, TaskPriority, User } from '../types';
import { CheckCircle2, Clock, MoreHorizontal, Plus, X, Filter, UserPlus, Trash2, Archive } from 'lucide-react';
import { translateTaskPriority, getTaskPriorityColor } from '../translations';

interface TasksProps {
  tasks: Task[];
  projects: Project[];
  users: User[];
  currentUser?: User | null;
  onAddTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask?: (task: Task) => void;
}

const Tasks: React.FC<TasksProps> = ({ tasks, projects, users, currentUser, onAddTask, onDeleteTask, onUpdateTask }) => {
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

  const getPriorityStyle = (priority: TaskPriority) => {
    const c = getTaskPriorityColor(priority);
    return `${c.bg} ${c.text} ${c.border}`;
  };

  const filteredTasks = tasks.filter(task => {
      // No mostrar tareas archivadas por defecto
      if ((task as any).status === 'ARCHIVED') return false;
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
          status: 'TODO',
          createdBy: currentUser?.name || 'Sistema'
      };
      onAddTask(task);
      setIsModalOpen(false);
      setNewTask({ title: '', assignee: '', dueDate: '', priority: 'MEDIUM', projectId: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <header className="flex flex-col gap-4 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-roden-black tracking-tight">Mis Tareas</h2>
            <p className="text-roden-gray text-sm mt-1">Organización diaria y prioridades.</p>
            </div>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200 self-start sm:self-auto">
                <Plus size={16} /> Nueva Tarea
            </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium shrink-0">
                <Filter size={16} /> Filtros:
            </div>
            <div className="flex-1 min-w-[140px]">
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
            <div className="flex-1 min-w-[140px]">
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
                    Limpiar
                </button>
            )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map(task => (
              <div key={task.id} className="bg-white border border-roden-border p-4 rounded-xl shadow-sm flex items-start gap-3 group hover:border-indigo-200 transition-all">
                  {/* Checkbox */}
                  <button
                      onClick={() => onUpdateTask && onUpdateTask({ ...task, completed: !task.completed })}
                      className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                          task.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-gray-300 text-transparent hover:border-indigo-500'
                      }`}
                      title={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                  >
                      <CheckCircle2 size={14} />
                  </button>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-bold leading-snug ${task.completed ? 'text-gray-400 line-through' : 'text-roden-black'}`}>
                              {task.title}
                          </h4>
                          {/* Actions — always visible */}
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {task.completed && onUpdateTask && (
                                <button
                                    onClick={() => onUpdateTask({ ...task, status: 'ARCHIVED' as any })}
                                    className="text-gray-300 hover:text-amber-500 hover:bg-amber-50 p-1.5 rounded-lg transition-colors"
                                    title="Archivar tarea completada"
                                >
                                    <Archive size={16} />
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={() => onDeleteTask(task.id)}
                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                    title="Eliminar Tarea"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                          </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded truncate max-w-[140px] sm:max-w-none">
                              {getProjectTitle(task.projectId)}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                              <Clock size={11} /> {task.dueDate}
                          </span>
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${getPriorityStyle(task.priority)}`}>
                              {translateTaskPriority(task.priority)}
                          </div>
                          {task.assignee && (
                              <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                                  → {task.assignee}
                              </span>
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
              <div className="flex min-h-full items-start sm:items-center justify-center p-0 sm:p-4">
                  <div className="bg-white rounded-none sm:rounded-2xl w-full sm:max-w-lg shadow-2xl border-0 sm:border border-gray-200 relative min-h-screen sm:min-h-0">
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
