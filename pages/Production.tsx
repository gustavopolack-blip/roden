
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, ProductionStep, Client, ProjectStatus, User, ProductionNote, SavedEstimate, ProductionOrder, ProductionOrderStatus } from '../types';
import { Hammer, Clock, ArrowRight, ArrowLeft, Check, Package, Palette, FileText, ShoppingCart, Truck, X, Info, Plus, HardDrive, Archive, Calendar, MessageSquare, Save, Lock, Printer, List, LayoutGrid, AlertTriangle, Zap } from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';

interface ProductionProps {
  projects: Project[];
  clients: Client[];
  user: User;
  savedEstimates?: SavedEstimate[]; // Need this to find the linked estimate data
  productionOrders?: ProductionOrder[];
  onUpdateProject: (project: Project) => void;
  onAddProject: (project: Project) => void;
  onUpdateProductionOrder?: (order: ProductionOrder) => void;
  onAddProductionOrder?: (order: ProductionOrder) => void;
}

const PRODUCTION_STEPS: { id: ProductionStep; label: string; icon: any }[] = [
    { id: 'ANTICIPO_PLANOS', label: 'Anticipo y Planos', icon: FileText },
    { id: 'COMPRA_MATERIALES', label: 'Materiales', icon: ShoppingCart },
    { id: 'FABRICACION', label: 'Fabricación', icon: Hammer },
    { id: 'LUSTRE', label: 'Lustre', icon: Palette },
    { id: 'PREPARACION', label: 'Preparación', icon: Package },
    { id: 'LISTO', label: 'Listo', icon: Check },
];

const Production: React.FC<ProductionProps> = ({ 
  projects, 
  clients, 
  user, 
  savedEstimates = [], 
  productionOrders = [],
  onUpdateProject, 
  onAddProject,
  onUpdateProductionOrder
}) => {
  const [viewMode, setViewMode] = useState<'PROJECTS' | 'ORDERS'>('PROJECTS');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  // State for Technical View Modal
  const [viewingTechnicalEstimate, setViewingTechnicalEstimate] = useState<SavedEstimate | null>(null);

  // New Project Form State for Taller view
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState('');
  const [newProject, setNewProject] = useState({
      title: '',
      startDate: '',
      productionStartDate: '', 
      deadline: '',
      status: 'PRODUCTION' as ProjectStatus,
      driveFolderUrl: ''
  });

  // --- REAL-TIME SYNC EFFECT ---
  // This ensures that if User A has the details modal open, and User B updates the project
  // (e.g. moves the stage), User A sees the update immediately without closing the modal.
  useEffect(() => {
    if (selectedProject) {
        const updatedVersion = projects.find(p => p.id === selectedProject.id);
        // We check if the object reference changed (which happens on fetchData update)
        // and update the local state to reflect new props.
        if (updatedVersion && updatedVersion !== selectedProject) {
            setSelectedProject(updatedVersion);
        }
    }
  }, [projects, selectedProject]);

  // PERMISSION CHECK:
  // Manage = Move columns, Create projects (Admin/Manager)
  // Collaborate = Add notes (Everyone including 'USER')
  const canManageProduction = user.role === 'administrador' || user.role === 'gerente_taller';
  const canAddNotes = true; // All authenticated users can add notes/collaborate

  // Filter active production projects. 
  // We show PRODUCTION and READY. 
  // COMPLETED projects (Step 'LISTO') are archived and removed from this view.
  const productionProjects = projects.filter(p => ['PRODUCTION', 'READY'].includes(p.status) && p.status !== 'COMPLETED');

  // Filter projects available to "Start" (not yet in production)
  const availableForProduction = projects.filter(p => ['PROPOSAL', 'QUOTING'].includes(p.status));

  const getStepStatus = (currentStep: ProductionStep, stepId: ProductionStep) => {
    const stepsOrder = PRODUCTION_STEPS.map(s => s.id);
    const currentIndex = stepsOrder.indexOf(currentStep || 'ANTICIPO_PLANOS');
    const stepIndex = stepsOrder.indexOf(stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleAdvanceStep = (project: Project) => {
     if (!canManageProduction) return;
     const stepsOrder = PRODUCTION_STEPS.map(s => s.id);
     const currentStep = project.productionStep || 'ANTICIPO_PLANOS';
     const currentIndex = stepsOrder.indexOf(currentStep);
     
     if (currentIndex < stepsOrder.length - 1) {
         const nextStep = stepsOrder[currentIndex + 1];
         // Increase progress by 15% roughly per step, max 100
         const newProgress = Math.min(100, project.progress + 15);
         
         // Update dates
         const now = new Date();
         const dateString = `${now.getDate()}/${now.getMonth() + 1}`;
         const updatedDates = { ...(project.stepDates || {}), [nextStep]: dateString };

         // Determine Project Status based on Production Step
         let newStatus: ProjectStatus = 'PRODUCTION';
         
         if (nextStep === 'PREPARACION') {
             // Logic: 'PREPARACION' -> Project is READY for delivery (Shows in Listo column)
             newStatus = 'READY';
         } else if (nextStep === 'LISTO') {
             // Logic: 'LISTO' -> Project is COMPLETED/ARCHIVED
             newStatus = 'COMPLETED';
         }

         onUpdateProject({
             ...project,
             productionStep: nextStep,
             progress: nextStep === 'LISTO' ? 100 : newProgress,
             stepDates: updatedDates,
             status: newStatus
         });
     }
  };

  const handleRegressStep = (project: Project) => {
    if (!canManageProduction) return;
    const stepsOrder = PRODUCTION_STEPS.map(s => s.id);
    const currentStep = project.productionStep || 'ANTICIPO_PLANOS';
    const currentIndex = stepsOrder.indexOf(currentStep);
    
    if (currentIndex > 0) {
        const prevStep = stepsOrder[currentIndex - 1];
        // Decrease progress by 15% roughly per step
        const newProgress = Math.max(0, project.progress - 15);
        
        // Determine Project Status based on Regressed Step
        let newStatus: ProjectStatus = 'PRODUCTION';
        if (prevStep === 'PREPARACION') {
            newStatus = 'READY';
        }

        onUpdateProject({
            ...project,
            productionStep: prevStep,
            progress: newProgress,
            status: newStatus 
        });
    }
 };

 // Helper to format YYYY-MM-DD to DD/MM for step display
 const formatStepDate = (isoDate: string) => {
    if (!isoDate) return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit'});
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}`;
 };

 // Helper to calculate remaining days
 const calculateDaysRemaining = (deadlineStr: string) => {
    if (!deadlineStr) return 0;
    const deadline = new Date(deadlineStr);
    const today = new Date();
    // Normalize to midnight for fair comparison
    deadline.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProduction) return;

    if (selectedSourceProjectId) {
        // Option 1: Start Existing Project
        const existingProject = projects.find(p => p.id === selectedSourceProjectId);
        if (existingProject) {
            // Priority: User Input Date > Existing Project Date > Today
            const prodDate = newProject.productionStartDate || existingProject.productionStartDate || new Date().toISOString().split('T')[0];
            
            const updatedProject: Project = {
                ...existingProject,
                status: 'PRODUCTION',
                startDate: newProject.startDate || existingProject.startDate,
                productionStartDate: prodDate,
                deadline: newProject.deadline || existingProject.deadline,
                productionStep: 'ANTICIPO_PLANOS',
                stepDates: {
                    ...existingProject.stepDates,
                    // Sync 'ANTICIPO_PLANOS' date with Production Start Date
                    'ANTICIPO_PLANOS': formatStepDate(prodDate)
                }
            };
            onUpdateProject(updatedProject);
        }
    } else {
        // Option 2: Create Brand New Project (Ad-hoc work)
        const prodDate = newProject.productionStartDate || new Date().toISOString().split('T')[0];
        
        const project: Project = {
            id: `p${Date.now()}`,
            clientId: clients.length > 0 ? clients[0].id : '', // Assign default client
            title: newProject.title,
            status: newProject.status,
            deadline: newProject.deadline,
            startDate: newProject.startDate,
            productionStartDate: prodDate,
            progress: 0,
            budget: 0,
            tasksTotal: 5,
            tasksCompleted: 0,
            productionStep: 'ANTICIPO_PLANOS',
            stepDates: {
                // Sync 'ANTICIPO_PLANOS' date with Production Start Date
                'ANTICIPO_PLANOS': formatStepDate(prodDate)
            },
            driveFolderUrl: newProject.driveFolderUrl
        };
        onAddProject(project);
    }
    
    setIsModalOpen(false);
    setNewProject({ title: '', startDate: '', productionStartDate: '', deadline: '', status: 'PRODUCTION', driveFolderUrl: '' });
    setSelectedSourceProjectId('');
 };

 const handleSaveNote = () => {
     if (!selectedProject || !newNote.trim() || !canAddNotes) return;

     const note: ProductionNote = {
         id: `n${Date.now()}`,
         content: newNote,
         date: new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
         author: user.name
     };

     // Optimistic update locally not strictly needed as we wait for onUpdateProject, 
     // but helps with responsiveness.
     // However, real sync comes from the useEffect above after fetchData.
     
     const updatedNotes = [...(selectedProject.productionNotes || []), note];
     const updatedProject = { ...selectedProject, productionNotes: updatedNotes };
     
     onUpdateProject(updatedProject);
     // We do NOT manually setSelectedProject here to avoid race conditions with Realtime.
     // The useEffect will handle updating the modal when the DB change comes back.
     
     setNewNote('');
 };

 const openDetails = (project: Project) => {
     setSelectedProject(project);
     setNewNote('');
 };

 // Handle View Technical Report
 const handleViewTechnicalReport = (project: Project) => {
     if (!project.linkedTechnicalEstimateId) return;
     const estimate = savedEstimates.find(e => e.id === project.linkedTechnicalEstimateId);
     if (estimate) {
         setViewingTechnicalEstimate(estimate);
     } else {
         alert("El reporte técnico asociado no se encuentra en el historial.");
     }
 };

  const handleUpdateOrderStatus = (order: ProductionOrder, newStatus: ProductionOrderStatus) => {
      if (onUpdateProductionOrder) {
          onUpdateProductionOrder({ ...order, status: newStatus, updatedAt: new Date().toISOString() });
      }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
       <header className="flex justify-between items-center border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-roden-black tracking-tight">Producción</h2>
            <p className="text-roden-gray text-sm mt-1">Seguimiento en tiempo real del proceso productivo.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl ml-8">
            <button 
              onClick={() => setViewMode('PROJECTS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'PROJECTS' ? 'bg-white text-roden-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={14} /> Proyectos
            </button>
            <button 
              onClick={() => setViewMode('ORDERS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'ORDERS' ? 'bg-white text-roden-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={14} /> Órdenes de Producción
            </button>
          </div>
          <div className="ml-4">
            <RodenAIButton 
              mode="taller_checklist" 
              data={{ projects: productionProjects, orders: productionOrders }} 
              userRole={user.role}
            />
          </div>
        </div>
        {canManageProduction ? (
            <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
                <Plus size={16} /> Nueva Obra
            </button>
        ) : (
            <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg text-xs font-bold text-gray-500">
                <Lock size={12} /> Gestión Restringida (Operario)
            </div>
        )}
      </header>

      {viewMode === 'PROJECTS' ? (
        <div className="grid grid-cols-1 gap-8">
          {productionProjects.map(project => {
              const currentStep = project.productionStep || 'ANTICIPO_PLANOS';
              const isLastStep = currentStep === 'PREPARACION';
              const isBeforeReady = currentStep === 'LUSTRE';
              const daysRemaining = calculateDaysRemaining(project.deadline);
              const hasTechnicalReport = !!project.linkedTechnicalEstimateId;

              return (
              <div key={project.id} className="bg-white border border-roden-border rounded-xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow duration-300">
                  <div className={`p-6 border-b border-gray-100 flex justify-between items-start ${project.status === 'READY' ? 'bg-emerald-50/50' : 'bg-gray-50/50'}`}>
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-roden-black">{project.title}</h3>
                              <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
                                  ID: {project.id.toUpperCase()}
                              </span>
                              {project.status === 'READY' && (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                                      <Check size={10} /> LISTO PARA ENTREGAR
                                  </span>
                              )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                              {project.productionStartDate && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Calendar size={12} className="text-gray-400" /> Inicio: {project.productionStartDate}
                                  </p>
                              )}
                              {hasTechnicalReport && (
                                  <button 
                                      onClick={() => handleViewTechnicalReport(project)}
                                      className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                                      <FileText size={12} /> Ver Especificación Técnica
                                  </button>
                              )}
                          </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                           <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-400 uppercase">Avance</span>
                              <span className="text-lg font-bold text-roden-black">{project.progress}%</span>
                           </div>
                           <div className="flex gap-2">
                               <div className="bg-yellow-100 border border-yellow-200 text-yellow-800 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                                   <Calendar size={14} className="text-yellow-700" />
                                   <span className="text-sm font-bold">Entrega: {project.deadline}</span>
                               </div>
                               <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
                                   <Clock size={14} className="text-red-500" />
                                   <span className="text-sm font-extrabold">{daysRemaining} Días Restantes</span>
                               </div>
                           </div>
                      </div>
                  </div>

                  <div className="p-8">
                      <div className="relative">
                          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full z-0"></div>
                          <div className="relative z-10 flex justify-between items-start">
                              {PRODUCTION_STEPS.map((step) => {
                                  const status = getStepStatus(project.productionStep || 'ANTICIPO_PLANOS', step.id);
                                  const Icon = step.icon;
                                  const stepDate = project.stepDates?.[step.id];
                                  
                                  let circleClass = "bg-white border-2 border-gray-200 text-gray-300";
                                  let textClass = "text-gray-400";
                                  let iconSize = 18;

                                  if (status === 'completed') {
                                      circleClass = "bg-emerald-500 border-emerald-500 text-white";
                                      textClass = "text-emerald-600 font-medium";
                                  } else if (status === 'active') {
                                      circleClass = "bg-white border-2 border-indigo-600 text-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)] scale-110";
                                      textClass = "text-indigo-700 font-bold";
                                      iconSize = 20;
                                  }

                                  return (
                                      <div key={step.id} className="flex flex-col items-center gap-3 w-24">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${circleClass}`}>
                                              <Icon size={iconSize} />
                                          </div>
                                          <div className="flex flex-col items-center">
                                              <span className={`text-[10px] text-center uppercase tracking-tight leading-tight transition-colors ${textClass}`}>
                                                  {step.label}
                                              </span>
                                              {stepDate && (
                                                  <span className="text-[9px] text-gray-500 font-medium mt-1 bg-gray-50 px-1.5 rounded border border-gray-100">
                                                      {stepDate}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3">
                       {canManageProduction ? (
                           <button 
                              onClick={() => handleRegressStep(project)}
                              disabled={!project.productionStep || project.productionStep === 'ANTICIPO_PLANOS'}
                              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:text-black hover:border-gray-300 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                              <ArrowLeft size={14} /> Retroceder
                           </button>
                       ) : <div></div>}
                       
                       <div className="flex gap-3">
                          <button 
                              onClick={() => openDetails(project)}
                              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:text-black hover:border-gray-300 shadow-sm transition-colors">
                              Ver Detalles y Notas
                          </button>
                          
                          {canManageProduction && (
                              <button 
                                  onClick={() => handleAdvanceStep(project)}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 ${
                                      isLastStep
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-roden-black hover:bg-gray-800 text-white'
                                  }`}>
                                  {isLastStep ? (
                                      <>Finalizar Obra (Archivar) <Archive size={14} /></>
                                  ) : isBeforeReady ? (
                                      <>Mover a Preparación <Truck size={14} /></>
                                  ) : (
                                      <>Avanzar Etapa <ArrowRight size={14} /></>
                                  )}
                              </button>
                          )}
                       </div>
                  </div>
              </div>
          )})}
          
          {productionProjects.length === 0 && (
               <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                   <p>No hay proyectos activos en taller actualmente.</p>
               </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productionOrders.map(order => (
            <div key={order.id} className="bg-white border border-roden-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Orden #{order.orderNumber}</span>
                  <h3 className="text-lg font-bold text-roden-black">{order.clientName}</h3>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  order.status === ProductionOrderStatus.PENDING ? 'bg-yellow-100 text-yellow-700' :
                  order.status === ProductionOrderStatus.IN_PROCESS ? 'bg-blue-100 text-blue-700' :
                  order.status === ProductionOrderStatus.FINISHED ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {order.status}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <FileText size={14} className="text-gray-400 mt-0.5" />
                  <p className="text-sm text-gray-600 line-clamp-2">{order.itemDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Entrega: <span className="font-bold text-roden-black">{order.estimatedDeliveryDate}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <Hammer size={14} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Operarios: <span className="font-bold text-roden-black">{order.assignedOperators?.join(', ') || 'Sin asignar'}</span></p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <select 
                  value={order.status}
                  onChange={(e) => handleUpdateOrderStatus(order, e.target.value as ProductionOrderStatus)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-black"
                >
                  {Object.values(ProductionOrderStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="p-2 bg-roden-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  title="Ver Detalles"
                >
                  <Info size={16} />
                </button>
                <button 
                  onClick={() => setSelectedOrder(order)}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors no-print"
                  title="Imprimir Orden"
                >
                  <Printer size={16} />
                </button>
              </div>
            </div>
          ))}

          {productionOrders.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <p>No hay órdenes de producción generadas.</p>
            </div>
          )}
        </div>
      )}

       {/* Details Modal - Using Portal */}
       {selectedProject && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">Detalles de Producción</h3>
                          <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <div className="p-6 space-y-4">
                          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                               <Info className="text-indigo-600 mt-1" size={20} />
                               <div>
                                   <h4 className="font-bold text-roden-black">{selectedProject.title}</h4>
                                   <p className="text-sm text-gray-500 mt-1">Etapa actual: <span className="font-bold text-indigo-600">{PRODUCTION_STEPS.find(s => s.id === selectedProject.productionStep)?.label}</span></p>
                               </div>
                          </div>

                          <div className="space-y-3">
                              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                 <MessageSquare size={14}/> Historial de Notas
                              </h4>
                              
                              {/* Historical Notes List */}
                              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto space-y-3">
                                  {selectedProject.productionNotes && selectedProject.productionNotes.length > 0 ? (
                                      selectedProject.productionNotes.map(note => (
                                          <div key={note.id} className="pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                              <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                                              <div className="flex justify-end mt-1 text-[10px] font-bold text-gray-400 gap-2">
                                                  <span>{note.date}</span>
                                                  <span>•</span>
                                                  <span className="text-indigo-500">{note.author}</span>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <p className="text-sm text-gray-400 italic">No hay notas registradas para esta obra.</p>
                                  )}
                              </div>

                              {/* New Note Input - Enabled for everyone (canAddNotes = true) */}
                              {canAddNotes && (
                                  <div className="pt-2">
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">Agregar Nueva Nota (Bitácora)</label>
                                      <textarea 
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none text-sm min-h-[80px]"
                                        placeholder="Escribe aquí novedades, cambios, faltantes o detalles importantes..."
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                      ></textarea>
                                      <div className="flex justify-end mt-2">
                                          <button 
                                            onClick={handleSaveNote}
                                            disabled={!newNote.trim()}
                                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                                              <Save size={12} /> Guardar Nota
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </div>

                          <div className="space-y-3 pt-2">
                              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wide">Checklist de Etapa</h4>
                               <div className="space-y-2">
                                   {['Verificación de material', 'Corte según plano v2', 'Pre-armado en banco'].map((item, i) => (
                                       <div key={i} className="flex items-center gap-2">
                                           <div className="w-4 h-4 rounded border border-gray-300"></div>
                                           <span className="text-sm text-gray-600">{item}</span>
                                       </div>
                                   ))}
                               </div>
                          </div>

                          <div className="pt-4 flex justify-end sticky bottom-0 bg-white border-t border-gray-100">
                              <button onClick={() => setSelectedProject(null)} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors">
                                  Cerrar
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* VIEW TECHNICAL REPORT MODAL */}
      {viewingTechnicalEstimate && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 max-h-[90vh] flex flex-col">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100">
                          <h3 className="text-xl font-bold text-roden-black">Especificación Técnica Asociada</h3>
                          <div className="flex items-center gap-3 no-print">
                              <button onClick={() => window.print()} className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-2 text-sm">
                                  <Printer size={16}/> Imprimir
                              </button>
                              <button onClick={() => setViewingTechnicalEstimate(null)} className="text-gray-400 hover:text-black">
                                  <X size={20} />
                              </button>
                          </div>
                      </div>
                      <div className="p-8 overflow-y-auto font-mono text-sm">
                          {/* Reusing a simplified version of Technical Print View logic */}
                          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                              <div>
                                  <h1 className="text-2xl font-bold uppercase">Reporte Técnico de Taller</h1>
                                  <p>Proyecto: {viewingTechnicalEstimate.projectId ? 'Proyecto Vinculado' : viewingTechnicalEstimate.customProjectName}</p>
                                  <p>Fecha Generación: {new Date(viewingTechnicalEstimate.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                  <p className="font-bold">SISTEMA rødën OS</p>
                              </div>
                          </div>
                          
                          <div className="mb-8">
                              <h3 className="font-bold border-b border-black mb-4 uppercase">Detalle de Despiece por Módulo</h3>
                              {viewingTechnicalEstimate.modules.map((mod, i) => (
                                  <div key={i} className="mb-6 break-inside-avoid">
                                      <div className="flex items-center gap-4 mb-2 bg-gray-100 p-2 font-bold justify-between">
                                          <div>
                                            <span>#{i+1} {mod.name}</span>
                                            <span className="text-xs font-normal ml-2">({mod.width}x{mod.height}x{mod.depth} mm)</span>
                                          </div>
                                          <span className="text-xs font-normal">Cant: {mod.quantity}</span>
                                      </div>
                                      <table className="w-full text-left text-xs">
                                          <thead>
                                              <tr className="border-b border-gray-400">
                                                  <th className="py-1">Pieza</th>
                                                  <th className="py-1">Material</th>
                                                  <th className="py-1">Cant (Unit)</th>
                                                  <th className="py-1">Medidas (mm)</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {/* Note: We can't use calculateModuleParts here easily without importing logic. 
                                                  Ideally we save the calculated parts in the estimate snapshot. 
                                                  For now, we assume the snapshot saves raw module data, so we can't re-calculate without the function. 
                                                  FIX: In a real app, parts should be stored in snapshot.
                                                  FALLBACK: Display basic info or move calculate logic to a shared helper. 
                                                  Let's simulate content for now or user sees raw module data.
                                              */}
                                              <tr>
                                                  <td colSpan={4} className="py-4 text-center text-gray-500 italic">
                                                      Visualización simplificada. Para ver el despiece completo, use el Estimador de Costos.
                                                      <br/>
                                                      Configuración: {mod.moduleType} / {mod.materialColorName}
                                                  </td>
                                              </tr>
                                          </tbody>
                                      </table>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* New Project Modal (Direct from Taller) - Using Portal */}
      {isModalOpen && canManageProduction && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="flex min-h-full items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200">
                      <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                          <h3 className="text-xl font-bold text-roden-black">Ingresar Nueva Obra</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                              <X size={20} />
                          </button>
                      </div>
                      <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                          
                          {/* Selection Logic */}
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Citar Proyecto Existente (Backlog)</label>
                              <select 
                                className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                value={selectedSourceProjectId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setSelectedSourceProjectId(id);
                                    if (id) {
                                        const p = projects.find(p => p.id === id);
                                        if (p) setNewProject({ ...newProject, title: p.title, deadline: p.deadline || '', startDate: p.startDate || '', productionStartDate: p.productionStartDate || '' });
                                    } else {
                                        setNewProject({ ...newProject, title: '' });
                                    }
                                }}
                              >
                                 <option value="">-- Seleccionar Proyecto --</option>
                                 {availableForProduction.map(p => (
                                     <option key={p.id} value={p.id}>{p.title} ({p.status})</option>
                                 ))}
                              </select>
                              <p className="text-xs text-gray-400 mt-1">Selecciona proyectos en etapa de Diseño o Presupuesto para pasarlos a Taller.</p>
                          </div>

                          {/* Fallback / Manual Input */}
                          {!selectedSourceProjectId && (
                            <div className="pt-4 border-t border-gray-100">
                                <label className="block text-sm font-medium text-gray-700 mb-1">O crear Obra Personalizada (Nombre)</label>
                                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                        value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} 
                                        placeholder="Ej: Mueble TV Adicional"
                                        />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Producción</label>
                                <input type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={newProject.productionStartDate} onChange={e => setNewProject({...newProject, productionStartDate: e.target.value})} />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Entrega</label>
                                <input required type="date" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none"
                                    value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} />
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                                 <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-white"
                                     value={newProject.status} onChange={e => setNewProject({...newProject, status: e.target.value as ProjectStatus})}>
                                     <option value="PRODUCTION">En Producción</option>
                                 </select>
                             </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                 <HardDrive size={14} /> Link Carpeta Drive (Planos)
                              </label>
                              <input type="url" placeholder="https://drive.google.com/..." className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none" 
                                     value={newProject.driveFolderUrl} onChange={e => setNewProject({...newProject, driveFolderUrl: e.target.value})} />
                          </div>
                          <div className="pt-4 flex justify-end gap-3 bg-white border-t border-gray-100">
                              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors">
                                  Cancelar
                              </button>
                              <button type="submit" className="px-6 py-2 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg">
                                  {selectedSourceProjectId ? 'Iniciar Producción' : 'Crear Obra'}
                              </button>
                          </div>
                      </form>
                  </div>
              </div>
          </div>,
          document.body
      )}
        {/* Production Order Details Modal */}
        {selectedOrder && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in print:bg-white print:backdrop-blur-none">
            <div className="flex min-h-full items-center justify-center p-4 print:p-0">
              <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none print-container">
                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 print:bg-white print:border-b-2 print:border-black">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest print:text-black">Orden de Producción</span>
                    <h3 className="text-2xl font-bold text-roden-black">#{selectedOrder.orderNumber} - {selectedOrder.clientName}</h3>
                  </div>
                  <div className="flex items-center gap-3 no-print">
                    <button 
                      onClick={() => window.print()} 
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                      <Printer size={16} /> Imprimir
                    </button>
                    <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-black p-2 no-print">
                      <X size={24} />
                    </button>
                  </div>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 print:block print:space-y-8">
                  <div className="md:col-span-2 space-y-6">
                    <section>
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 border-b pb-1 print:text-black print:border-black">Descripción del Trabajo</h4>
                      <p className="text-roden-black whitespace-pre-wrap text-sm">{selectedOrder.itemDescription}</p>
                    </section>
                    
                    <section className="print:break-inside-avoid">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 border-b pb-1 print:text-black print:border-black">Especificaciones Técnicas</h4>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 print:bg-white print:border-gray-300">
                        <div className="grid grid-cols-1 gap-4">
                          {selectedOrder.technicalDetails && Array.isArray(selectedOrder.technicalDetails) ? (
                            selectedOrder.technicalDetails.map((item: any, idx: number) => (
                              <div key={idx} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                                <p className="font-bold text-sm">{item.name}</p>
                                <p className="text-xs text-gray-500">Cantidad: {item.quantity}</p>
                                {item.modules && item.modules.map((m: any, midx: number) => (
                                  <div key={midx} className="ml-4 mt-1">
                                    <p className="text-xs font-medium">• {m.name} ({m.width}x{m.height}x{m.depth})</p>
                                    {m.technicalNotes && <p className="text-[10px] text-gray-400 italic ml-2">{m.technicalNotes}</p>}
                                  </div>
                                ))}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-500 italic">No hay detalles técnicos específicos cargados.</p>
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="print:break-inside-avoid">
                      <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 border-b pb-1 print:text-black print:border-black">Materiales y Herrajes</h4>
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 print:bg-white print:border-gray-300">
                        <p className="text-xs text-gray-600">Referencia de materiales según presupuesto.</p>
                      </div>
                    </section>
                  </div>
                  
                  <div className="space-y-6 print:mt-8">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 space-y-4 print:bg-white print:border-gray-300">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 print:text-black">Estado Actual</label>
                        <div className="font-bold text-roden-black">{selectedOrder.status}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 print:text-black">Fecha Inicio</label>
                          <div className="font-bold text-roden-black text-sm">{selectedOrder.startDate}</div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 print:text-black">Entrega Est.</label>
                          <div className="font-bold text-roden-black text-sm text-indigo-600 print:text-black">{selectedOrder.estimatedDeliveryDate}</div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 print:text-black">Operarios Asignados</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedOrder.assignedOperators?.map(op => (
                            <span key={op} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold print:border-black">{op}</span>
                          )) || <span className="text-xs text-gray-400 italic">Sin asignar</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="hidden print:block mt-20 pt-10 border-t border-dashed border-gray-300 text-center">
                      <p className="text-xs text-gray-400">Firma Responsable Taller</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Production;
