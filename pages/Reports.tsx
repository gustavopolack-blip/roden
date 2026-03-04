
import React, { useState } from 'react';
import { Project, Client, Task, Report, ProductionStep, User } from '../types';
import { FileText, Printer, Calendar, ArrowLeft, Hammer, CheckSquare, Plus, Search, X, Archive, Filter, Eye, Clock, Lock, MessageSquare, QrCode, PenTool, Zap } from 'lucide-react';
import RodenAIButton from '../components/RodenAIButton';

interface ReportsProps {
  projects: Project[];
  clients: Client[];
  tasks: Task[];
  reports: Report[];
  user: User;
  onSaveReport: (report: Report) => void;
}

const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
    'ANTICIPO_PLANOS': 'Anticipo',
    'COMPRA_MATERIALES': 'Materiales',
    'FABRICACION': 'Fabricación',
    'LUSTRE': 'Lustre',
    'PREPARACION': 'Preparación',
    'LISTO': 'Listo'
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

  // Filter Logic for Modal (RESTRICTED TO PRODUCTION/READY ONLY)
  const allowedStatusesForReport = ['PRODUCTION', 'READY'];
  
  const filteredProjectsForModal = projects.filter(p => {
      const nameMatch = p.title.toLowerCase().includes(projectSearchTerm.toLowerCase());
      const statusMatch = allowedStatusesForReport.includes(p.status);
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
                <div className="flex gap-3">
                     <RodenAIButton 
                        mode="finanzas_lectura" 
                        data={{ projects, reports }} 
                        userRole={user.role}
                     />
                     <button
                        onClick={() => window.print()}
                        className="bg-white border border-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm no-print"
                    >
                        <Printer size={16} /> Imprimir Lista
                    </button>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-roden-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg shadow-gray-200">
                        <Plus size={16} /> Generar Informe Técnico
                    </button>
                </div>
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
                <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="flex min-h-full items-center justify-center p-4">
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
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                    <Lock size={12} /> Solo se pueden generar informes de obras en Fabricación o Listas.
                                </p>
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
                                        No hay obras disponibles en estado Fabricación o Listo.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- RENDER: REPORT VIEW (CREATE OR ARCHIVE) ---
  if (!selectedProject) return null;

  const projectTasks = getProjectTasks(selectedProject.id);
  const daysRemaining = calculateDaysRemaining(selectedProject.deadline);
  const isReadOnly = view === 'VIEW';

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
                    display: flex !important;
                    flex-direction: column !important;
                }
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
            <div className="flex gap-3 no-print">
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
            
            {/* 1. HEADER (REDUCED HEIGHT & LOGO SIZE) */}
            <header className="h-[14mm] bg-black text-white flex items-center justify-between px-10 relative">
                {/* Left Group */}
                <div className="flex items-baseline gap-4">
                    <h1 className="text-4xl font-bold tracking-tighter leading-none">rødën</h1>
                    <span className="text-3xl font-light text-gray-500 pb-0.5">|</span>
                    <span className="text-lg font-medium mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Informe avance de obra
                    </span>
                </div>

                {/* Right */}
                <div className="text-right">
                    <div className="text-sm font-bold">
                        {new Date().toLocaleDateString('es-AR')}
                    </div>
                    <div className="text-xs opacity-70 mt-0.5">
                        Página 1 de 1
                    </div>
                </div>
            </header>

            {/* Content Padding */}
            <div className="px-10 py-8 flex-1 flex flex-col gap-8">

                {/* 2. PROJECT IDENTITY (LARGE - NO UPPERCASE) */}
                <section className="border-b border-gray-300 pb-4">
                     <h1 className="text-4xl font-extrabold text-black tracking-tight leading-none mb-1">
                        {selectedProject.title}
                     </h1>
                </section>

                {/* 3. COLORED METRICS GRID (CENTERED CONTENT) */}
                <section className="grid grid-cols-4 gap-6">
                    <div className="flex flex-col items-center text-center text-blue-700">
                        <span className="text-sm uppercase font-bold mb-1">Inicio Prod.</span>
                        <span className="text-3xl font-bold">{selectedProject.productionStartDate ? new Date(selectedProject.productionStartDate).toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'}) : '-'}</span>
                    </div>
                    <div className="flex flex-col items-center text-center text-amber-600">
                        <span className="text-sm uppercase font-bold mb-1">Entrega Pactada</span>
                        <span className="text-3xl font-bold">{selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'}) : 'A definir'}</span>
                    </div>
                    <div className="flex flex-col items-center text-center text-red-600">
                        <span className="text-sm uppercase font-bold mb-1">Restante</span>
                        <span className="text-3xl font-bold">{daysRemaining} Días</span>
                    </div>
                    <div className="flex flex-col items-center text-center text-emerald-600">
                        <span className="text-sm uppercase font-bold mb-1">Avance</span>
                        <span className="text-3xl font-bold">{selectedProject.progress}%</span>
                    </div>
                </section>

                {/* 4. TECHNICAL STAGES (DARK GRAY GRAPHICS) */}
                <section className="py-6 border-b border-gray-300">
                    <div className="flex justify-between items-start w-full px-2">
                        {Object.entries(PRODUCTION_STEP_LABELS).map(([key, label], idx) => {
                            // Logic for active step
                            const steps = Object.keys(PRODUCTION_STEP_LABELS);
                            const currentIdx = steps.indexOf(selectedProject.productionStep || 'ANTICIPO_PLANOS');
                            const thisIdx = steps.indexOf(key);
                            const status = thisIdx < currentIdx ? 'completed' : thisIdx === currentIdx ? 'active' : 'pending';

                            return (
                                <div key={key} className="flex flex-col items-center flex-1 text-center">
                                    <div className={`w-16 h-16 rounded-full border-2 text-lg flex items-center justify-center font-bold mb-4 transition-colors ${
                                        status === 'completed' ? 'bg-gray-800 border-gray-800 text-white' :
                                        status === 'active' ? 'bg-white border-gray-800 text-gray-800 scale-110 shadow-lg' :
                                        'bg-white border-gray-300 text-gray-300'
                                    }`}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-xs uppercase font-bold leading-tight ${
                                        status === 'pending' ? 'text-gray-300' : 'text-gray-800'
                                    }`}>{label}</span>
                                    {selectedProject.stepDates?.[key] && (
                                        <span className="text-sm font-bold text-gray-600 mt-1">{selectedProject.stepDates[key]}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* 5. VERTICAL STACKED SECTIONS */}
                <div className="flex flex-col gap-8">
                    
                    {/* A. NOTES */}
                    <section>
                        <h3 className="text-base font-bold uppercase border-b border-gray-300 mb-4 pb-1 flex items-center gap-2 text-black">
                            <MessageSquare size={18}/> Notas de Proceso (Bitácora)
                        </h3>
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 min-h-[120px]">
                            {selectedProject.productionNotes?.length ? (
                                selectedProject.productionNotes.map(note => (
                                    <div key={note.id} className="mb-5 last:mb-0 border-b border-gray-200 last:border-0 pb-5 last:pb-0">
                                        <p className="text-lg text-gray-900 leading-relaxed font-medium">"{note.content}"</p>
                                        <p className="text-sm text-gray-500 mt-1 font-bold">{note.date} — {note.author}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-base text-gray-400 italic text-center py-4">Sin notas registradas en la bitácora.</p>
                            )}
                        </div>
                    </section>

                    {/* B. CHECKLIST */}
                    <section>
                         <h3 className="text-base font-bold uppercase border-b border-gray-300 mb-4 pb-1 flex items-center gap-2 text-black">
                            <CheckSquare size={18}/> Checklist de Tareas
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            {projectTasks.filter(t => !t.completed).map(task => (
                                <div key={task.id} className="flex items-start gap-4 py-2 border-b border-gray-100">
                                    <div className="w-6 h-6 border-2 border-gray-300 rounded mt-0.5 shrink-0"></div>
                                    <span className="text-base text-gray-800 font-medium leading-tight pt-0.5">{task.title}</span>
                                </div>
                            ))}
                            {projectTasks.length === 0 && <p className="col-span-2 text-base text-gray-400 italic">No hay tareas pendientes.</p>}
                        </div>
                    </section>

                    {/* C. OBSERVATIONS */}
                    <section>
                        <h3 className="text-base font-bold uppercase border-b border-gray-300 mb-4 pb-1 flex items-center gap-2 text-black">
                            <PenTool size={18}/> Observaciones Finales
                        </h3>
                         {isReadOnly ? (
                            <div className="min-h-[120px] text-lg text-gray-900 leading-relaxed whitespace-pre-wrap border border-gray-200 p-6 rounded-lg bg-white">
                                {observations || "Sin observaciones adicionales."}
                            </div>
                        ) : (
                            <textarea 
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                placeholder="Ingrese detalles técnicos de entrega, faltantes de herrajes o instrucciones específicas de instalación..."
                                className="w-full p-6 border border-gray-300 rounded-lg text-lg focus:outline-none min-h-[150px] bg-white resize-none font-medium text-gray-800"
                            ></textarea>
                        )}
                    </section>
                </div>

            </div>

            {/* 6. COMPACT FOOTER (ADJUSTED SIZES) */}
            <footer className="h-[10mm] bg-gray-300 flex items-center justify-between px-10 mt-auto border-t border-gray-300 leading-none text-gray-800">
                <span className="text-xs tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: '400' }}>Devoto | Buenos Aires | Argentina</span>
                <span className="text-xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: '700' }}>www.rodenmobel.com</span>
            </footer>

        </div>
    </div>
  );
};

export default Reports;
