
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Project, Client, SavedEstimate, ProductionOrder, Report, Estimate } from '../types';
import { translateProjectStatus, getProjectStatusColor, translateEstimateStatus, translateProductionOrderStatus } from '../translations';
import { 
  Archive as ArchiveIcon, 
  CheckCircle, 
  XCircle, 
  Search, 
  Calendar, 
  FolderOpen, 
  DollarSign, 
  FileText, 
  Hammer,
  Activity,
  X,
  Download,
  Eye,
  ClipboardList,
  TrendingUp
} from 'lucide-react';

interface ArchiveProps {
  projects: Project[];
  clients: Client[];
  savedEstimates?: SavedEstimate[];
  productionOrders?: ProductionOrder[];
  reports?: Report[];
  estimates?: Estimate[];
}

type ArchiveTab = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

const Archive: React.FC<ArchiveProps> = ({ 
  projects, 
  clients, 
  savedEstimates = [],
  productionOrders = [],
  reports = [],
  estimates = []
}) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente Desconocido';

  // Filter projects based on tab
  const getProjectsByTab = (tab: ArchiveTab) => {
    switch(tab) {
      case 'ACTIVE':
        return projects.filter(p => ['PROPOSAL', 'QUOTING', 'PRODUCTION', 'READY'].includes(p.status));
      case 'COMPLETED':
        return projects.filter(p => p.status === 'COMPLETED');
      case 'CANCELLED':
        return projects.filter(p => p.status === 'CANCELLED');
      default:
        return [];
    }
  };

  // Get suggestions based on search term
  const getSuggestions = () => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    const tabProjects = getProjectsByTab(activeTab);
    const lowerSearch = searchTerm.toLowerCase();
    
    const matches = tabProjects
      .map(p => {
        const clientName = getClientName(p.clientId);
        const titleMatch = (p.title || '').toLowerCase().includes(lowerSearch);
        const clientMatch = clientName.toLowerCase().includes(lowerSearch);
        
        if (titleMatch || clientMatch) {
          return {
            project: p,
            matchType: titleMatch ? 'title' : 'client',
            matchText: titleMatch ? p.title : clientName
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 5); // Máximo 5 sugerencias
    
    return matches;
  };

  const suggestions = getSuggestions();

  // Filter by search
  const displayedProjects = getProjectsByTab(activeTab).filter(p => {
    const searchMatch = (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        getClientName(p.clientId).toLowerCase().includes(searchTerm.toLowerCase());
    return searchMatch;
  });

  // Get documents for a project (Legajo)
  const getProjectDossier = (projectId: string) => {
    const projectEstimates = estimates.filter(e => e.projectId === projectId);
    const projectSavedEstimates = savedEstimates.filter(e => e.projectId === projectId);
    const projectOrders = productionOrders.filter(o => o.projectId === projectId);
    const projectReports = reports.filter(r => r.projectId === projectId);

    return {
      estimates: projectEstimates,
      savedEstimates: projectSavedEstimates,
      productionOrders: projectOrders,
      reports: projectReports,
      totalDocs: projectEstimates.length + projectSavedEstimates.length + projectOrders.length + projectReports.length
    };
  };

  // Calculate metrics
  const totalValue = displayedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const totalProjects = displayedProjects.length;

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-6 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-roden-black tracking-tight mb-2">Archivo - Centro de Documentación</h2>
           <p className="text-roden-gray text-sm">Gestión integral de obras: activas, terminadas y no concretadas.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Total Obras</span>
            <span className="text-2xl font-bold text-roden-black">{totalProjects}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Valor Total</span>
            <span className="text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</span>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
              {/* TAB 1: ACTIVAS */}
              <button 
                onClick={() => setActiveTab('ACTIVE')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'ACTIVE' 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                  <Activity size={16} /> Obras Activas
              </button>

              {/* TAB 2: TERMINADAS */}
              <button 
                onClick={() => setActiveTab('COMPLETED')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'COMPLETED' 
                    ? 'bg-white text-emerald-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                  <CheckCircle size={16} /> Terminadas
              </button>

              {/* TAB 3: NO CONCRETADAS */}
              <button 
                onClick={() => setActiveTab('CANCELLED')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'CANCELLED' 
                    ? 'bg-white text-red-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                  <XCircle size={16} /> No Concretadas
              </button>
          </div>

          {/* SEARCH */}
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Buscar por obra o cliente..."
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            
            {/* SUGGESTIONS DROPDOWN */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in">
                {suggestions.map((suggestion: any, idx: number) => {
                  const client = clients.find(c => c.id === suggestion.project.clientId);
                  return (
                    <button
                      key={suggestion.project.id}
                      onClick={() => {
                        setSearchTerm(suggestion.matchText);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-roden-black text-sm">
                            {suggestion.project.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Cliente: {client?.name || 'Desconocido'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          suggestion.matchType === 'title' 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {suggestion.matchType === 'title' ? 'Obra' : 'Cliente'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      {/* PROJECT LIST */}
      <div className="grid grid-cols-1 gap-4">
        {displayedProjects.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">
              {searchTerm ? 'No se encontraron obras con ese criterio' : 'No hay obras en esta categoría'}
            </p>
          </div>
        ) : (
          displayedProjects.map(project => {
            const dossier = getProjectDossier(project.id);
            const client = clients.find(c => c.id === project.clientId);

            return (
              <div 
                key={project.id}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-roden-black mb-1">{project.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {project.startDate || 'Sin fecha'}
                      </span>
                      <span>Cliente: {client?.name || 'Desconocido'}</span>
                      {project.budget > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold">
                          <DollarSign size={14} />
                          ${project.budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  {(() => {
                    const colors = getProjectStatusColor(project.status);
                    return (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                        {translateProjectStatus(project.status)}
                      </span>
                    );
                  })()}
                </div>

                {/* Archive Reason (if cancelled) */}
                {project.status === 'CANCELLED' && project.archiveReason && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700">
                      <strong>Motivo:</strong> {project.archiveReason}
                    </p>
                  </div>
                )}

                {/* Dossier Summary */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {dossier.estimates.length} Presupuestos
                    </span>
                    <span className="flex items-center gap-1">
                      <ClipboardList size={14} />
                      {dossier.savedEstimates.length} Planillas
                    </span>
                    <span className="flex items-center gap-1">
                      <Hammer size={14} />
                      {dossier.productionOrders.length} Órdenes
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp size={14} />
                      {dossier.reports.length} Informes
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedProject(project)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Eye size={16} />
                    Ver Legajo ({dossier.totalDocs})
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LEGAJO MODAL */}
      {selectedProject && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* HEADER */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-roden-black mb-1">
                    Legajo: {selectedProject.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Cliente: {getClientName(selectedProject.clientId)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* PROJECT INFO */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-xs text-gray-500">Estado</span>
                  <p className="font-bold text-roden-black">{translateProjectStatus(selectedProject.status)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Inicio</span>
                  <p className="font-bold text-roden-black">{selectedProject.startDate || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Presupuesto</span>
                  <p className="font-bold text-emerald-600">${selectedProject.budget?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Avance</span>
                  <p className="font-bold text-roden-black">{selectedProject.progress || 0}%</p>
                </div>
              </div>

              {/* PRESUPUESTOS/ESTIMATES */}
              {(() => {
                const projectEstimates = estimates.filter(e => e.projectId === selectedProject.id);
                return projectEstimates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-roden-black mb-3 flex items-center gap-2">
                      <FileText size={20} className="text-indigo-600" />
                      Presupuestos Enviados ({projectEstimates.length})
                    </h3>
                    <div className="space-y-2">
                      {projectEstimates.map(est => (
                        <div key={est.id} className="p-4 bg-white border border-gray-200 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-medium text-roden-black">{est.title}</p>
                            <p className="text-xs text-gray-500">{est.description}</p>
                            <p className="text-sm font-bold text-emerald-600 mt-1">
                              ${est.totalAmount?.toLocaleString() || 0}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            est.status === 'SENT'     ? 'bg-blue-100 text-blue-700'    :
                            est.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                            est.status === 'REJECTED' ? 'bg-red-100 text-red-700'      :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {translateEstimateStatus(est.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* PLANILLAS DE COSTOS */}
              {(() => {
                const projectSavedEstimates = savedEstimates.filter(e => e.projectId === selectedProject.id);
                return projectSavedEstimates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-roden-black mb-3 flex items-center gap-2">
                      <ClipboardList size={20} className="text-amber-600" />
                      Planillas de Costos ({projectSavedEstimates.length})
                    </h3>
                    <div className="space-y-2">
                      {projectSavedEstimates.map(est => (
                        <div key={est.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                          <p className="font-medium text-roden-black">{est.customProjectName || 'Planilla sin nombre'}</p>
                          <p className="text-xs text-gray-500">
                            Guardado el {est.createdAt || est.date || 'fecha desconocida'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ÓRDENES DE PRODUCCIÓN */}
              {(() => {
                const projectOrders = productionOrders.filter(o => o.projectId === selectedProject.id);
                return projectOrders.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-roden-black mb-3 flex items-center gap-2">
                      <Hammer size={20} className="text-orange-600" />
                      Órdenes de Producción ({projectOrders.length})
                    </h3>
                    <div className="space-y-2">
                      {projectOrders.map(order => (
                        <div key={order.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                          <p className="font-medium text-roden-black">Orden #{order.id.substring(0, 8)}</p>
                          <p className="text-xs text-gray-500">Estado: {translateProductionOrderStatus(order.status)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* INFORMES */}
              {(() => {
                const projectReports = reports.filter(r => r.projectId === selectedProject.id);
                return projectReports.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-roden-black mb-3 flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-600" />
                      Informes Generados ({projectReports.length})
                    </h3>
                    <div className="space-y-2">
                      {projectReports.map(report => (
                        <div key={report.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                          <p className="font-medium text-roden-black">{report.title}</p>
                          <p className="text-xs text-gray-500">
                            {report.date || report.generatedDate || 'Sin fecha'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* NOTAS DE PRODUCCIÓN */}
              {selectedProject.productionNotes && Array.isArray(selectedProject.productionNotes) && selectedProject.productionNotes.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-roden-black mb-3">
                    Notas de Producción ({selectedProject.productionNotes.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedProject.productionNotes.map((note: any, idx: number) => (
                      <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-roden-black">{note.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {note.author} - {note.date}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {(() => {
                const dossier = getProjectDossier(selectedProject.id);
                return dossier.totalDocs === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">No hay documentos en este legajo todavía</p>
                  </div>
                );
              })()}

            </div>

            {/* FOOTER */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
export default Archive;
