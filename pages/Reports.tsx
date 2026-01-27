
import React, { useState } from 'react';
import { Project, Client, Task, Report, ProductionStep, User } from '../types';
import { FileText, Printer, Calendar, ArrowLeft, Hammer, CheckSquare, Plus, Search, X, Archive, Filter, Eye, Clock, Lock, MessageSquare, QrCode, PenTool } from 'lucide-react';

interface ReportsProps {
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  reports: Report[];
  user: User;
  onSaveReport: (report: Report) => void;
}

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo y Planos',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo para Entrega'
};

const Reports: React.FC<ReportsProps> = ({ projects, clients, tasks, reports, user, onSaveReport }) => {
  const [view, setView] = useState<'LIST' | 'CREATE' | 'VIEW'>('LIST');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [observations, setObservations] = useState('');
  
  // Search / Filters for History List
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // Search for New Report Modal
  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  // --- LOGIC ---

  const calculateElapsedDays = (project: Project): number | null => {
      // Priority 1: Use productionStartDate
      if (project.productionStartDate) {
          const start = new Date(project.productionStartDate);
          const now = new Date();
          const diffTime = now.getTime() - start.getTime();
          if (diffTime < 0) return 0;
          return Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Priority 2: Step Date
      let startDate: Date | null = null;
      const stepDate = project.stepDates?.['ANTICIPO_PLANOS'];

      if (stepDate) {
          const [day, month] = stepDate.split('/').map(Number);
          if (!isNaN(day) && !isNaN(month)) {
              const currentYear = new Date().getFullYear();
              startDate = new Date(currentYear, month - 1, day);
          }
      }

      // Priority 3: Start Date
      if (!startDate && project.startDate) {
          startDate = new Date(project.startDate);
      }

      if (startDate) {
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - startDate.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return null;
  };

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

  // --- HANDLERS ---
  
  const handleStartReport = (project: Project) => {
      setSelectedProject(project);
      setObservations('');
      setSelectedReport(null);
      setIsModalOpen(false);
      setView('CREATE');
  };

  const handleViewReport = (report: Report) => {
      const project = projects.find(p => p.id === report.projectId);
      if (project) {
          setSelectedProject(project);
          setSelectedReport(report);
          setObservations(report.observations);
          setView('VIEW');
      } else {
          alert("El proyecto asociado a este informe ya no existe en la base de datos.");
      }
  };

  const handleSaveAndPrint = () => {
    if (!selectedProject) return;

    // Create Report Object
    const newReport: Report = {
        id: `rep${Date.now()}`,
        projectId: selectedProject.id,
        projectNameSnapshot: selectedProject.title,
        generatedDate: new Date().toISOString(),
        observations: observations
    };

    onSaveReport(newReport);
    
    // Trigger Print
    setTimeout(() => {
        window.print();
        setView('LIST'); // Go back to list after printing/saving
        setSelectedProject(null);
    }, 500);
  };

  const handlePrintOnly = () => {
      window.print();
  };

  // --- HELPERS ---

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  const getProjectTasks = (projectId: string) => tasks.filter(t => t.projectId === projectId);

  // Filter Logic for List View
  const filteredReports = reports.filter(r => {
      const dateMatch = historyDateFilter ? r.generatedDate.startsWith(historyDateFilter) : true;
      const projectMatch = historySearchTerm 
          ? r.projectNameSnapshot.toLowerCase().includes(historySearchTerm.toLowerCase()) 
          : true;
      return dateMatch && projectMatch;
  });

  // Filter Logic for Modal (Role Restrictions)
  const allowedStatusesForWorkshop = ['PRODUCTION', 'READY'];
  
  const filteredProjectsForModal = projects.filter(p => {
      const nameMatch = p.title.toLowerCase().includes(projectSearchTerm.toLowerCase());
      
      // Role Check
      let statusMatch = true;
      if (user.role !== 'ADMIN') {
          // If not admin (Workshop Manager), only allow Production or Ready
          statusMatch = allowedStatusesForWorkshop.includes(p.status);
      } else {
          // Admin can see all
          statusMatch = true;
      }

      return nameMatch && statusMatch;
  });

  // --- RENDER: LIST VIEW (HISTORY) ---
  if (view === 'LIST') {
      return (
        <div className="space-y-8 animate-fade-in relative">
            <header className="flex justify-between items-center border-b border-gray-200 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-roden-black tracking-tight">Informes</h2>
                    <p className="text-roden-gray text-sm mt-1">Historial de reportes técnicos y hojas de ruta.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
                    <Plus size={16} /> Generar Informe Técnico
                </button>
            </header>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-500 mr-2">
                    <Filter size={16} /> Filtros:
                </div>
                <div className="relative max-w-xs flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por proyecto..." 
                        className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-black"
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <input 
                        type="date" 
                        className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-black"
                        value={historyDateFilter}
                        onChange={(e) => setHistoryDateFilter(e.target.value)}
                    />
                </div>
                {(historySearchTerm || historyDateFilter) && (
                    <button 
                        onClick={() => { setHistorySearchTerm(''); setHistoryDateFilter(''); }}
                        className="text-xs text-red-500 underline font-medium"
                    >
                        Limpiar
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha Generación</th>
                            <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Proyecto</th>
                            <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider">Observaciones (Extracto)</th>
                            <th className="py-4 px-6 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReports.map(report => (
                            <tr key={report.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-6 text-sm text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-400"/>
                                        {new Date(report.generatedDate).toLocaleDateString('es-AR')}
                                    </div>
                                </td>
                                <td className="py-4 px-6 font-bold text-roden-black">
                                    {report.projectNameSnapshot}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-500 italic truncate max-w-xs">
                                    {report.observations || '- Sin observaciones -'}
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleViewReport(report)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded hover:bg-indigo-100 transition-colors"
                                        >
                                            <Eye size={14} /> Ver / Imprimir
                                        </button>
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1.5 rounded border border-gray-200">
                                            <Archive size={12} />
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredReports.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-gray-400">
                                    No hay informes archivados que coincidan con los filtros.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Project Selection Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-roden-black">Seleccionar Proyecto</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar proyecto..." 
                                    className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-black"
                                    value={projectSearchTerm}
                                    onChange={(e) => setProjectSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {user.role !== 'ADMIN' && (
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                    <Lock size={12} /> Solo puedes generar informes de obras en Fabricación o Listas.
                                </p>
                            )}
                        </div>
                        <div className="overflow-y-auto p-2 space-y-1 flex-1">
                            {filteredProjectsForModal.map(project => (
                                <button 
                                    key={project.id}
                                    onClick={() => handleStartReport(project)}
                                    className="w-full text-left p-4 hover:bg-gray-50 rounded-xl transition-colors group border border-transparent hover:border-gray-200"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-roden-black group-hover:text-indigo-600 transition-colors">{project.title}</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{getClient(project.clientId)?.name || 'Cliente Desconocido'}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                            project.status === 'PRODUCTION' ? 'bg-amber-100 text-amber-700' :
                                            project.status === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {project.status}
                                        </span>
                                    </div>
                                </button>
                            ))}
                            {filteredProjectsForModal.length === 0 && (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    No se encontraron proyectos disponibles para generar informe con tu rol actual.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- RENDER: REPORT VIEW (CREATE OR ARCHIVE) ---
  if (!selectedProject) return null;

  const client = getClient(selectedProject.clientId);
  const projectTasks = getProjectTasks(selectedProject.id);
  const generationDate = selectedReport 
    ? new Date(selectedReport.generatedDate).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
    : new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

  const elapsedDays = calculateElapsedDays(selectedProject);
  const daysRemaining = calculateDaysRemaining(selectedProject.deadline);
  const isReadOnly = view === 'VIEW';
  const reportId = selectedReport ? selectedReport.id.toUpperCase() : `DRAFT-${Date.now().toString().slice(-6)}`;

  return (
    <div className="animate-fade-in min-h-screen bg-gray-100/50 print:bg-white flex flex-col items-center">
        {/* Style block to force print layout */}
        <style>{`
            @media print {
                @page { margin: 0; size: A4; }
                body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display: none !important; }
                .print-container { 
                    width: 210mm !important; 
                    height: 297mm !important; 
                    margin: 0 !important; 
                    padding: 0 !important;
                    border: none !important; 
                    box-shadow: none !important; 
                    overflow: hidden !important;
                    background: white !important;
                }
                /* Ensure background colors print */
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        `}</style>

        {/* Action Header (Hidden on Print) */}
        <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-6 pt-6">
            <button 
                onClick={() => {
                    setView('LIST');
                    setSelectedReport(null);
                    setSelectedProject(null);
                }}
                className="text-gray-500 hover:text-black flex items-center gap-2 text-sm font-medium transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200"
            >
                <ArrowLeft size={16} /> Volver
            </button>
            <div className="flex gap-3">
                 {view === 'CREATE' ? (
                     <button 
                        onClick={handleSaveAndPrint}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg">
                        <Printer size={16} /> Guardar e Imprimir
                    </button>
                 ) : (
                    <button 
                        onClick={handlePrintOnly}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg">
                        <Printer size={16} /> Imprimir Copia
                    </button>
                 )}
            </div>
        </div>

        {/* REPORT CONTAINER (Visual representation of A4 Paper) */}
        <div className="print-container relative w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none flex flex-col text-black font-sans leading-tight">
            
            {/* 1. ISO HEADER */}
            <header className="h-[25mm] border-b-2 border-black flex items-stretch">
                {/* Logo Section */}
                <div className="w-[60mm] bg-black flex items-center justify-center">
                    <h1 className="text-white text-2xl font-bold tracking-tighter">rødën</h1>
                </div>
                {/* Document Title */}
                <div className="flex-1 flex flex-col justify-center px-6 border-r border-gray-300">
                    <h2 className="text-lg font-bold uppercase tracking-wide">Hoja de Ruta Técnica</h2>
                    <p className="text-[10px] text-gray-500">Control de Producción y Calidad</p>
                </div>
                {/* Meta Data */}
                <div className="w-[50mm] text-[9px] flex flex-col justify-center px-4 space-y-1 bg-gray-50">
                    <div className="flex justify-between">
                        <span className="font-bold text-gray-500">DOC ID:</span>
                        <span>{reportId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold text-gray-500">FECHA:</span>
                        <span>{new Date().toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold text-gray-500">PÁGINA:</span>
                        <span>1 de 1</span>
                    </div>
                </div>
            </header>

            {/* Content Padding */}
            <div className="p-8 flex-1 flex flex-col gap-6">

                {/* 2. PROJECT IDENTITY */}
                <section className="border border-gray-300 rounded-lg overflow-hidden flex">
                     <div className="flex-1 p-4 border-r border-gray-300">
                         <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Proyecto / Obra</p>
                         <h1 className="text-xl font-bold text-black leading-none mb-1">{selectedProject.title}</h1>
                         <p className="text-xs text-gray-600">ID: {selectedProject.id.toUpperCase()}</p>
                     </div>
                     <div className="w-1/3 p-4 bg-gray-50 flex flex-col justify-center">
                         <p className="text-[9px] text-gray-400 uppercase font-bold mb-1">Cliente</p>
                         <p className="text-sm font-bold text-black">{client?.name || 'Cliente General'}</p>
                         <p className="text-[10px] text-gray-600 truncate">{client?.address || 'Sin dirección registrada'}</p>
                     </div>
                </section>

                {/* 3. DATES & STATUS GRID */}
                <section className="grid grid-cols-4 gap-4">
                    <div className="border border-gray-200 p-3 rounded">
                        <p className="text-[9px] uppercase font-bold text-gray-400">Inicio Prod.</p>
                        <p className="text-sm font-bold">{selectedProject.productionStartDate || selectedProject.startDate || '-'}</p>
                    </div>
                    <div className="border border-gray-200 p-3 rounded bg-yellow-50/50 border-yellow-100">
                        <p className="text-[9px] uppercase font-bold text-yellow-700">Entrega Pactada</p>
                        <p className="text-sm font-bold text-yellow-900">{selectedProject.deadline || 'A definir'}</p>
                    </div>
                    <div className="border border-gray-200 p-3 rounded bg-red-50/50 border-red-100">
                        <p className="text-[9px] uppercase font-bold text-red-700">Restante</p>
                        <p className="text-sm font-bold text-red-900">{daysRemaining} Días</p>
                    </div>
                    <div className="border border-gray-200 p-3 rounded">
                        <p className="text-[9px] uppercase font-bold text-gray-400">Avance Total</p>
                        <p className="text-sm font-bold">{selectedProject.progress}%</p>
                    </div>
                </section>

                {/* 4. TECHNICAL STAGES */}
                <section>
                    <h3 className="text-xs font-bold uppercase border-b border-black mb-3 pb-1 flex items-center gap-2">
                        <Hammer size={12}/> Etapas de Producción
                    </h3>
                    <div className="flex justify-between items-start pt-2">
                        {Object.entries(PRODUCTION_STEP_LABELS).map(([key, label], idx) => {
                            const isCompleted = (selectedProject.progress || 0) > (idx * 16); 
                            // Rough estimate logic or exact match if needed.
                            // Better logic: Compare keys index
                            const steps = Object.keys(PRODUCTION_STEP_LABELS);
                            const currentIdx = steps.indexOf(selectedProject.productionStep || 'ANTICIPO_PLANOS');
                            const thisIdx = steps.indexOf(key);
                            const status = thisIdx < currentIdx ? 'completed' : thisIdx === currentIdx ? 'active' : 'pending';

                            return (
                                <div key={key} className="flex flex-col items-center w-20 text-center">
                                    <div className={`w-6 h-6 rounded-full border-2 text-[10px] flex items-center justify-center font-bold mb-2 ${
                                        status === 'completed' ? 'bg-black border-black text-white' :
                                        status === 'active' ? 'bg-white border-black text-black' :
                                        'bg-white border-gray-200 text-gray-300'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-[8px] uppercase font-bold leading-tight ${
                                        status === 'pending' ? 'text-gray-300' : 'text-black'
                                    }`}>{label}</span>
                                    {selectedProject.stepDates?.[key] && (
                                        <span className="text-[8px] text-gray-500 mt-1">{selectedProject.stepDates[key]}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>

                <div className="flex gap-8">
                    {/* 5. NOTES & OBSERVATIONS */}
                    <div className="flex-1 space-y-6">
                        <section>
                            <h3 className="text-xs font-bold uppercase border-b border-black mb-3 pb-1 flex items-center gap-2">
                                <MessageSquare size={12}/> Notas de Proceso
                            </h3>
                            <div className="bg-gray-50 p-4 rounded border border-gray-200 min-h-[100px]">
                                {selectedProject.productionNotes?.slice(-3).map(note => (
                                    <div key={note.id} className="mb-2 last:mb-0 border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                                        <p className="text-[10px] italic text-gray-700">"{note.content}"</p>
                                        <p className="text-[8px] text-gray-400 text-right mt-1">{note.date} - {note.author}</p>
                                    </div>
                                ))}
                                {(!selectedProject.productionNotes || selectedProject.productionNotes.length === 0) && (
                                    <p className="text-[10px] text-gray-400 text-center py-4">Sin notas registradas.</p>
                                )}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-bold uppercase border-b border-black mb-3 pb-1 flex items-center gap-2">
                                <PenTool size={12}/> Observaciones Finales
                            </h3>
                             {isReadOnly ? (
                                <div className="min-h-[80px] text-xs text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-200 p-2 rounded">
                                    {observations || "Sin observaciones adicionales."}
                                </div>
                            ) : (
                                <textarea 
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    placeholder="Ingrese detalles de entrega, faltantes o instrucciones de instalación..."
                                    className="w-full p-2 border border-gray-300 rounded text-xs focus:outline-none min-h-[80px] bg-white resize-none"
                                ></textarea>
                            )}
                        </section>
                    </div>

                    {/* 6. TASKS CHECKLIST (SIDEBAR) */}
                    <div className="w-[65mm]">
                         <h3 className="text-xs font-bold uppercase border-b border-black mb-3 pb-1 flex items-center gap-2">
                            <CheckSquare size={12}/> Checklist
                        </h3>
                        <div className="space-y-1">
                            {projectTasks.filter(t => !t.completed).map(task => (
                                <div key={task.id} className="flex items-start gap-2 py-1">
                                    <div className="w-3 h-3 border border-gray-400 rounded-sm mt-0.5"></div>
                                    <span className="text-[10px] text-gray-700 leading-tight">{task.title}</span>
                                </div>
                            ))}
                            {projectTasks.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay tareas pendientes.</p>}
                        </div>

                        {/* QR Placeholder */}
                        <div className="mt-8 border border-gray-200 rounded p-4 flex flex-col items-center justify-center text-center bg-gray-50">
                            <QrCode size={64} className="text-black mb-2" />
                            <p className="text-[8px] font-bold uppercase text-gray-500">Escanea para ver<br/>estado digital</p>
                        </div>
                    </div>
                </div>

                {/* 7. SIGNATURE BLOCK (FOOTER) */}
                <div className="mt-auto grid grid-cols-3 gap-8 pt-8">
                    <div className="border-t border-black pt-2">
                        <p className="text-[9px] uppercase font-bold text-center">Control de Calidad</p>
                        <p className="text-[8px] text-gray-400 text-center mt-8">(Firma y Fecha)</p>
                    </div>
                    <div className="border-t border-black pt-2">
                        <p className="text-[9px] uppercase font-bold text-center">Jefe de Taller</p>
                        <p className="text-[8px] text-gray-400 text-center mt-8">(Firma y Fecha)</p>
                    </div>
                    <div className="border-t border-black pt-2">
                        <p className="text-[9px] uppercase font-bold text-center">Conformidad Cliente</p>
                        <p className="text-[8px] text-gray-400 text-center mt-8">(Firma y Aclaración)</p>
                    </div>
                </div>

            </div>

            {/* 8. SYSTEM FOOTER */}
            <footer className="h-[10mm] bg-gray-100 flex items-center justify-between px-8 text-[8px] text-gray-500 uppercase tracking-widest border-t border-gray-200">
                <span>Sistema Operativo rødën v2.1</span>
                <span>Generado por: {user.name}</span>
                <span>Página 1/1</span>
            </footer>

        </div>
    </div>
  );
};

export default Reports;
