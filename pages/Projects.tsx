
import React, { useState } from 'react';
import { Project, ProjectStatus, Client, User, ProductionStep } from '../types';
import { generateChecklist } from '../services/geminiService';
import { Plus, MoreHorizontal, Calendar, CheckSquare, Loader2, Filter, HardDrive, X, Pencil, Search, Hammer, Check, Archive, Clock, AlertCircle, Calculator, Zap } from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';

interface ProjectsProps {
  projects: Project[];
  clients: Client[];
  user: User;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onNavigateToEstimator?: (projectId: string) => void;
}

// Visual Groups updated to include CANCELLED
type ProjectGroup = 'PROPUESTA' | 'PRESUPUESTO' | 'FABRICACION' | 'LISTO' | 'FINALIZADO';

const PROJECT_GROUPS: { id: ProjectGroup; label: string; statuses: ProjectStatus[]; color: string; bg: string; border: string; accent: string }[] = [
    { 
        id: 'PROPUESTA', 
        label: 'PROPUESTA', 
        statuses: ['PROPOSAL'], 
        color: 'text-violet-500', bg: 'bg-violet-100', border: 'border-violet-200', accent: 'border-l-violet-500' 
    },
    { 
        id: 'PRESUPUESTO', 
        label: 'PRESUPUESTO ENVIADO', 
        statuses: ['QUOTING'], 
        color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-200', accent: 'border-l-blue-500' 
    },
    { 
        id: 'FABRICACION', 
        label: 'FABRICACIÓN', 
        statuses: ['PRODUCTION'], 
        color: 'text-amber-500', bg: 'bg-amber-100', border: 'border-amber-200', accent: 'border-l-amber-500' 
    },
    { 
        id: 'LISTO', 
        label: 'LISTO PARA ENTREGAR', 
        statuses: ['READY'], 
        color: 'text-emerald-500', bg: 'bg-emerald-100', border: 'border-emerald-200', accent: 'border-l-emerald-500' 
    },
    { 
        id: 'FINALIZADO', 
        label: 'ARCHIVADO / FINALIZADO', 
        statuses: ['COMPLETED', 'CANCELLED'], 
        color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-200', accent: 'border-l-gray-400' 
    }
];

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo y Planos',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo'
};

const Projects: React.FC<ProjectsProps> = ({ projects, clients, user, onAddProject, onUpdateProject, onNavigateToEstimator }) => {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterClient, setFilterClient] = useState('');
  const [filterText, setFilterText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
      id: '',
      title: '',
      clientId: '',
      startDate: '',
      productionStartDate: '',
      deadline: '',
      status: 'PROPOSAL' as ProjectStatus,
      budget: 0,
      driveFolderUrl: '',
      archiveReason: ''
  });

  const handleGenerateChecklist = async (projectId: string, title: string) => {
    setGeneratingFor(projectId);
    await generateChecklist(title); 
    setTimeout(() => setGeneratingFor(null), 1500);
  };

  const openCreateModal = () => {
      setFormData({
        id: '',
        title: '',
        clientId: '',
        startDate: '',
        productionStartDate: '',
        deadline: '',
        status: 'PROPOSAL',
        budget: 0,
        driveFolderUrl: '',
        archiveReason: ''
      });
      setIsEditMode(false);
      setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
      // Security Check: Only Admin can edit
      if (user.role !== 'administrador') return;

      setFormData({
          id: project.id,
          title: project.title,
          clientId: project.clientId,
          startDate: project.startDate || '',
          productionStartDate: project.productionStartDate || '',
          deadline: project.deadline,
          status: project.status,
          budget: project.budget,
          driveFolderUrl: project.driveFolderUrl || '',
          archiveReason: project.archiveReason || ''
      });
      setIsEditMode(true);
      setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditMode) {
        // Find original to keep other props like progress
        const original = projects.find(p => p.id === formData.id);
        if (!original) return;

        const updated: Project = {
            ...original,
            title: formData.title,
            clientId: formData.clientId,
            startDate: formData.startDate,
            productionStartDate: formData.productionStartDate,
            deadline: formData.deadline,
            status: formData.status,
            // Budget kept from original or 0 as input is removed
            budget: original.budget,
            driveFolderUrl: formData.driveFolderUrl,
            archiveReason: formData.archiveReason
        };
        onUpdateProject(updated);
    } else {
        const project: Project = {
            id: `p${Date.now()}`,
            clientId: formData.clientId,
            title: formData.title,
            startDate: formData.startDate,
            productionStartDate: formData.productionStartDate,
            status: formData.status,
            deadline: formData.deadline,
            progress: 0,
            budget: 0, // Default 0
            tasksTotal: 5,
            tasksCompleted: 0,
            productionStep: 'ANTICIPO_PLANOS',
            stepDates: {
                'ANTICIPO_PLANOS': new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit'})
            },
            driveFolderUrl: formData.driveFolderUrl,
            archiveReason: formData.archiveReason
        };
        onAddProject(project);
    }
    
    setIsModalOpen(false);
  };

  // Helper: Calculate Days Remaining (Red Box)
  const calculateDaysRemaining = (deadlineStr: string) => {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    const today = new Date();
    // Normalize to midnight
    deadline.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // --- Role Based Logic ---
  const isWorkshopRole = ['operario_taller', 'gerente_taller'].includes(user.role);

  const roleFilteredProjects = isWorkshopRole
    ? projects.filter(p => ['PRODUCTION', 'READY', 'COMPLETED'].includes(p.status))
    : projects; 

  // --- User Search Filters ---
  const filteredProjects = roleFilteredProjects.filter(p => {
    const matchesClient = filterClient ? p.clientId === filterClient : true;
    const matchesText = filterText ? p.title.toLowerCase().includes(filterText.toLowerCase()) : true;
    
    // Hide Completed/Cancelled Projects by default unless showCompleted is true
    const isArchived = p.status === 'COMPLETED' || p.status === 'CANCELLED';
    const matchesStatus = showCompleted ? true : !isArchived;

    return matchesClient && matchesText && matchesStatus;
  });

  const areDatesEnabled = ['PRODUCTION', 'READY', 'COMPLETED', 'CANCELLED'].includes(formData.status);
  const showReasonField = ['COMPLETED', 'CANCELLED'].includes(formData.status);

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <div className="flex justify-between items-center">
            <div>
            <h2 className="text-3xl font-bold text-roden-black tracking-tight">Proyectos</h2>
            <p className="text-roden-gray text-sm mt-1">Gestiona el ciclo de vida de obras y amoblamientos.</p>
            </div>
            <div className="flex gap-3">
                <RodenAIButton 
                    mode="proyectos_atencion" 
                    data={{ projects: filteredProjects }} 
                    userRole={user.role}
                />
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 transition-colors ${
                        showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-gray-600 hover:bg-gray-100 border-gray-200'
                    }`}>
                    <Filter size={16} /> {showFilters ? 'Ocultar Filtros' : 'Filtrar'}
                </button>
                {/* Condition: Only Admin sees New Project */}
                {user.role === 'administrador' && (
                    <button 
                        onClick={openCreateModal}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
                    <Plus size={16} /> Nuevo Proyecto
                    </button>
                )}
            </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-4 animate-fade-in flex-wrap">
                <div className="relative flex-1 max-w-xs min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre..." 
                        className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                    />
                </div>
                <div className="flex-1 max-w-xs min-w-[200px]">
                    <select 
                        className="w-full bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                    >
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 hover:text-roden-black group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showCompleted ? 'bg-roden-black border-roden-black text-white' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                            {showCompleted && <Check size={12} />}
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                        />
                        Mostrar Archivo Kanban
                    </label>
                </div>

                <button 
                    onClick={() => { setFilterClient(''); setFilterText(''); setShowCompleted(false); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium underline ml-auto"
                >
                    Limpiar
                </button>
            </div>
        )}
      </header>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-hidden h-full">
        <div className="flex gap-4 h-full w-full pb-4 overflow-x-auto">
          {PROJECT_GROUPS.map((group) => {
            
            // Logic for Hidden Columns
            if (group.id === 'FINALIZADO' && !showCompleted) {
                return null;
            }

            if (isWorkshopRole && (group.id === 'PROPUESTA' || group.id === 'PRESUPUESTO')) {
                return null;
            }

            // Filter projects that match any status in this group
            const columnProjects = filteredProjects.filter(p => group.statuses.includes(p.status));
            
            return (
              <div key={group.id} className="flex-1 min-w-[240px] flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${group.color}`}>{group.label}</h3>
                  <span className={`text-xs ${group.bg} ${group.color} px-2.5 py-1 rounded-full font-bold`}>
                    {columnProjects.length}
                  </span>
                </div>
                
                {/* Projects Column */}
                <div className="flex-1 bg-gray-50/80 rounded-xl border border-dashed border-gray-200 p-2 space-y-3 overflow-y-auto">
                  {columnProjects.map((project) => {
                    const daysRemaining = calculateDaysRemaining(project.deadline);
                    const pendingTasks = project.tasksTotal - project.tasksCompleted;
                    const isArchived = project.status === 'COMPLETED' || project.status === 'CANCELLED';

                    return (
                    <div 
                      key={project.id} 
                      onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                      className={`bg-white border border-gray-100 p-4 rounded-lg shadow-sm transition-all group border-l-4 ${isArchived ? 'border-l-gray-400 opacity-75' : group.accent} ${user.role === 'administrador' ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
                    >
                      {/* 1. Header: Edit & Drive Buttons (Top Right) */}
                      <div className="flex justify-between items-start mb-1">
                         {/* Status & Workshop Badge Group */}
                         <div className="flex flex-wrap gap-1">
                            {/* Percentage/Status Badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                project.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-100' :
                                project.progress > 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                              {project.status === 'COMPLETED' ? 'FINALIZADO' : project.status === 'CANCELLED' ? 'CANCELADO' : `${project.progress}% Avance`}
                            </span>

                             {/* WORKSHOP STATUS INDICATOR (If Production/Ready) */}
                            {['PRODUCTION', 'READY'].includes(project.status) && project.productionStep && (
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase border px-2 py-0.5 rounded ${
                                    project.status === 'READY' 
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                                    : 'text-amber-700 bg-amber-50 border-amber-100'
                                }`}>
                                    {project.status === 'READY' ? <Check size={10} /> : <Hammer size={10} />}
                                    {PRODUCTION_STEP_LABELS[project.productionStep] || project.productionStep}
                                </span>
                            )}
                         </div>

                         {/* Actions */}
                         <div className="flex gap-1 ml-auto">
                             {project.driveFolderUrl && (
                                <a 
                                    href={project.driveFolderUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-gray-300 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded transition-colors"
                                    title="Ver Planos en Drive"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <HardDrive size={14} />
                                </a>
                             )}
                            {onNavigateToEstimator && user.role === 'administrador' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onNavigateToEstimator(project.id); }}
                                    className="text-gray-300 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded transition-colors"
                                    title="Ir al Estimador de Costos"
                                >
                                    <Calculator size={14} />
                                </button>
                            )}
                            {user.role === 'administrador' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                                    className="text-gray-300 hover:text-black p-1 transition-colors"
                                    title="Editar Proyecto"
                                >
                                    <Pencil size={14} />
                                </button>
                            )}
                        </div>
                      </div>
                      
                      {/* 2. Project Name (Prominent) */}
                      <h4 
                        className={`text-roden-black font-extrabold text-base mb-3 leading-snug transition-colors ${user.role === 'administrador' ? 'group-hover:text-indigo-600' : ''}`}
                      >
                          {project.title}
                      </h4>

                      {/* 3. Highlighted Dates (Yellow & Red Boxes) */}
                      {!isArchived && (
                          <div className="flex gap-2 mb-3">
                              {/* Deadline (Yellow) */}
                              <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5 flex flex-col justify-center min-w-0">
                                  <span className="text-[9px] uppercase font-bold text-yellow-600 flex items-center gap-1 truncate">
                                      <Calendar size={10} /> Entrega
                                  </span>
                                  <span className="text-xs font-bold text-yellow-800 truncate">
                                      {project.deadline || 'S/D'}
                                  </span>
                              </div>
                              
                              {/* Days Remaining (Red) - Only show if deadline exists */}
                              {daysRemaining !== null && (
                                  <div className={`flex-1 border rounded px-2 py-1.5 flex flex-col justify-center min-w-0 ${
                                      daysRemaining < 0 ? 'bg-red-100 border-red-300' : 'bg-red-50 border-red-200'
                                  }`}>
                                      <span className={`text-[9px] uppercase font-bold flex items-center gap-1 truncate ${
                                          daysRemaining < 0 ? 'text-red-700' : 'text-red-600'
                                      }`}>
                                          <Clock size={10} /> {daysRemaining < 0 ? 'Atrasado' : 'Resta'}
                                      </span>
                                      <span className={`text-xs font-extrabold truncate ${
                                          daysRemaining < 0 ? 'text-red-800' : 'text-red-700'
                                      }`}>
                                          {Math.abs(daysRemaining)} Días
                                      </span>
                                  </div>
                              )}
                          </div>
                      )}

                      {/* 4. Footer: Tasks & AI */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-auto">
                         <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                            <CheckSquare size={12} className={pendingTasks > 0 ? "text-indigo-500" : "text-emerald-500"} />
                            <span className={pendingTasks > 0 ? "text-indigo-600 font-bold" : "text-emerald-600 font-bold"}>
                                {pendingTasks > 0 ? `${pendingTasks} Pendientes` : '¡Al día!'}
                            </span>
                         </div>
                         
                         {user.role === 'administrador' && !isArchived && (
                             <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateChecklist(project.id, project.title);
                              }}
                              disabled={generatingFor === project.id}
                              className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                             >
                               {generatingFor === project.id ? (
                                 <Loader2 size={10} className="animate-spin" />
                               ) : (
                                 "Asistente IA"
                               )}
                             </button>
                         )}
                      </div>
                    </div>
                  )})}
                  
                  {columnProjects.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-lg">
                      <p className="text-xs font-medium">Sin proyectos</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

       {/* Create/Edit Project Modal */}
       {isModalOpen && user.role === 'administrador' && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">{isEditMode ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <form onSubmit={handleSubmit} className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proyecto</label>
                              <input required type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                     value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                            <select required className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                                <option value="">Seleccionar...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>

                          <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                             <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                 value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ProjectStatus})}>
                                 <option value="PROPOSAL">Propuesta</option>
                                 <option value="QUOTING">Presupuesto Enviado</option>
                                 <option value="PRODUCTION">Fabricación</option>
                                 <option value="READY">Listo para Entregar</option>
                                 <option disabled className="bg-gray-100">--- Archivo ---</option>
                                 <option value="COMPLETED">Finalizado (Archivar)</option>
                                 <option value="CANCELLED">Cancelado / No Prosperó</option>
                             </select>
                          </div>

                          {/* REASON FIELD - Visible ONLY when archiving */}
                          {showReasonField && (
                             <div className="animate-fade-in bg-gray-50 p-4 rounded-lg border border-gray-200">
                                 <label className="block text-xs font-bold uppercase text-gray-500 mb-2 flex items-center gap-2">
                                     {formData.status === 'COMPLETED' ? <Check size={14} className="text-emerald-500"/> : <X size={14} className="text-red-500"/>}
                                     {formData.status === 'COMPLETED' ? 'Notas Finales de Cierre' : 'Motivo de Pérdida / Cancelación'}
                                 </label>
                                 <textarea 
                                     className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm min-h-[80px]"
                                     placeholder={formData.status === 'COMPLETED' ? "Ej: Cliente muy satisfecho, entregado antes de tiempo." : "Ej: Precio muy alto, eligieron otro proveedor."}
                                     value={formData.archiveReason}
                                     onChange={(e) => setFormData({...formData, archiveReason: e.target.value})}
                                 ></textarea>
                             </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio (Admin)</label>
                                <input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Producción</label>
                                <input 
                                    type="date" 
                                    disabled={!areDatesEnabled}
                                    className={`w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none ${!areDatesEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                                    value={formData.productionStartDate} 
                                    onChange={e => setFormData({...formData, productionStartDate: e.target.value})} 
                                />
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Entrega</label>
                                <input 
                                    required 
                                    type="date" 
                                    disabled={!areDatesEnabled}
                                    className={`w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none ${!areDatesEnabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                                    value={formData.deadline} 
                                    onChange={e => setFormData({...formData, deadline: e.target.value})} 
                                />
                             </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                     <HardDrive size={14} /> Link Carpeta Drive
                                  </label>
                                  <input type="url" placeholder="https://drive.google.com/..." className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                         value={formData.driveFolderUrl} onChange={e => setFormData({...formData, driveFolderUrl: e.target.value})} />
                              </div>
                          </div>
                          
                          <div className="pt-4 flex justify-end gap-3 bg-white border-t border-gray-100">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                                  Cancelar
                              </button>
                              <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                                  {isEditMode ? 'Guardar Cambios' : 'Crear Proyecto'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Projects;
