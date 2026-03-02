
import React, { useState } from 'react';
import { Project, Client, ProjectStatus, ProjectDossier } from '../types';
import { Archive as ArchiveIcon, CheckCircle, XCircle, Search, Calendar, FolderOpen, DollarSign, MessageSquare, FileText, TrendingUp, Target } from 'lucide-react';

interface ArchiveProps {
  projects: Project[];
  clients: Client[];
}

const Archive: React.FC<ArchiveProps> = ({ projects, clients }) => {
  const [activeTab, setActiveTab] = useState<'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [searchTerm, setSearchTerm] = useState('');

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente Desconocido';

  // Filter projects based on tab and search
  const displayedProjects = projects.filter(p => {
      const statusMatch = p.status === activeTab;
      const searchMatch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          getClientName(p.clientId).toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && searchMatch;
  });

  // Calculate Metrics
  const totalValue = displayedProjects.reduce((sum, p) => sum + (p.budget || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in relative">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-gray-200 pb-6 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-roden-black tracking-tight mb-2">Archivo de Obras</h2>
           <p className="text-roden-gray text-sm">Historial de proyectos finalizados y oportunidades perdidas.</p>
        </div>
      </header>

      {/* TABS & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
              <button 
                onClick={() => setActiveTab('COMPLETED')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'COMPLETED' 
                    ? 'bg-white text-emerald-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                  <CheckCircle size={16} /> Obras Finalizadas
              </button>
              <button 
                onClick={() => setActiveTab('CANCELLED')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'CANCELLED' 
                    ? 'bg-white text-red-700 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                  <XCircle size={16} /> No Concretados
              </button>
          </div>

          <div className="relative w-full md:w-64">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
             <input 
                type="text" 
                placeholder="Buscar en archivo..." 
                className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-black"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
      </div>

      {/* METRICS SUMMARY (Optional) */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl flex items-center gap-6 shadow-sm">
          <div className="p-3 bg-gray-50 rounded-lg text-gray-500">
             {activeTab === 'COMPLETED' ? <FolderOpen size={24}/> : <ArchiveIcon size={24}/>}
          </div>
          <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  {activeTab === 'COMPLETED' ? 'Proyectos Entregados' : 'Propuestas Perdidas'}
              </p>
              <p className="text-2xl font-bold text-roden-black">
                  {displayedProjects.length} <span className="text-sm font-normal text-gray-400">Registros</span>
              </p>
          </div>
          {activeTab === 'COMPLETED' && (
              <div className="ml-auto text-right">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Valor Histórico Total</p>
                  <p className="text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</p>
              </div>
          )}
      </div>

      {/* LIST VIEW */}
      <div className="grid grid-cols-1 gap-4">
          {displayedProjects.map(project => (
              <div key={project.id} className="bg-white border border-roden-border p-6 rounded-xl hover:shadow-md transition-shadow group flex flex-col md:flex-row gap-6">
                  
                  {/* Left: Basic Info */}
                  <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-roden-black">{project.title}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              activeTab === 'COMPLETED' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-red-50 text-red-700 border-red-100'
                          }`}>
                              {activeTab === 'COMPLETED' ? 'Finalizado' : 'Cancelado'}
                          </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-1">{getClientName(project.clientId)}</p>
                      
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          {project.startDate && (
                              <span className="flex items-center gap-1"><Calendar size={12}/> Inicio: {project.startDate}</span>
                          )}
                          {project.deadline && (
                              <span className="flex items-center gap-1"><Calendar size={12}/> Fin/Cierre: {project.deadline}</span>
                          )}
                      </div>
                  </div>

                  {/* Middle: Reason / Comment or Dossier */}
                  <div className="flex-[2] bg-gray-50 rounded-lg p-4 border border-gray-100">
                      {project.dossier ? (
                          <div className="space-y-3">
                              <p className="text-xs font-bold text-indigo-600 uppercase mb-2 flex items-center gap-1">
                                  <FileText size={12}/> Legajo Técnico de Cierre
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <p className="text-[10px] text-gray-400 uppercase">Rentabilidad</p>
                                      <p className={`text-sm font-bold ${project.dossier.profitability >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                          ${project.dossier.profitability.toLocaleString()}
                                      </p>
                                  </div>
                                  <div>
                                      <p className="text-[10px] text-gray-400 uppercase">Costo Total</p>
                                      <p className="text-sm font-bold text-gray-700">${project.dossier.totalCost.toLocaleString()}</p>
                                  </div>
                                  <div className="col-span-2">
                                      <p className="text-[10px] text-gray-400 uppercase">Resumen</p>
                                      <p className="text-xs text-gray-600 leading-tight">{project.dossier.summary}</p>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <>
                              <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                                  <MessageSquare size={12}/> {activeTab === 'COMPLETED' ? 'Notas de Cierre' : 'Motivo de Pérdida'}
                              </p>
                              {project.archiveReason ? (
                                  <p className="text-sm text-gray-700 italic leading-relaxed">"{project.archiveReason}"</p>
                              ) : (
                                  <p className="text-sm text-gray-400 italic">Sin comentarios registrados.</p>
                              )}
                          </>
                      )}
                  </div>

                  {/* Right: Actions / Budget */}
                  <div className="flex flex-col items-end justify-between min-w-[120px]">
                      {activeTab === 'COMPLETED' && (
                           <div className="text-right">
                               <p className="text-xs text-gray-400 uppercase">Presupuesto</p>
                               <p className="text-lg font-bold text-emerald-600">${project.budget.toLocaleString()}</p>
                           </div>
                      )}
                      
                      {project.driveFolderUrl && (
                          <a 
                              href={project.driveFolderUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="mt-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded transition-colors"
                          >
                              Ver Carpeta Drive
                          </a>
                      )}
                  </div>
              </div>
          ))}

          {displayedProjects.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <ArchiveIcon size={48} className="mx-auto text-gray-300 mb-4"/>
                  <p className="text-gray-500 font-medium">No se encontraron proyectos en esta sección.</p>
                  <p className="text-sm text-gray-400">Verifica los filtros de búsqueda.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default Archive;
