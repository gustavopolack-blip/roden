import React, { useState } from 'react';
import { Zap, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { runContextualAnalysis } from '../services/geminiService';

interface RodenAIButtonProps {
  mode: 'clientes_cartera' | 'proyectos_atencion' | 'estimador_revision' | 'historial_diagnostico' | 'taller_checklist' | 'proveedores_costos' | 'finanzas_lectura' | 'dashboard_briefing';
  data: any;
  userRole?: string;
  label?: string;
}

const RodenAIButton: React.FC<RodenAIButtonProps> = ({ mode, data, userRole, label = "Analizar con rødën AI" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  // REGLA DE SEGURIDAD INVIOLABLE
  if (userRole !== 'administrador') return null;

  const handleAnalyze = async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      const result = await runContextualAnalysis(mode, data);
      setAnalysis(result);
    } catch (error) {
      setAnalysis("Error al procesar el análisis.");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Interpretar checkboxes [ ]
      if (line.trim().startsWith('[ ]')) {
        return (
          <div key={i} className="flex items-start gap-2 my-1 text-gray-700">
            <Square size={16} className="mt-1 flex-shrink-0 text-gray-400" />
            <span>{line.replace('[ ]', '').trim()}</span>
          </div>
        );
      }
      if (line.trim().startsWith('[x]') || line.trim().startsWith('[X]')) {
        return (
          <div key={i} className="flex items-start gap-2 my-1 text-gray-700">
            <CheckSquare size={16} className="mt-1 flex-shrink-0 text-indigo-500" />
            <span className="line-through text-gray-400">{line.replace(/\[x\]|\[X\]/gi, '').trim()}</span>
          </div>
        );
      }

      // Interpretar indicadores visuales (emojis)
      let indicator = null;
      if (line.includes('🔴')) indicator = <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-2" />;
      if (line.includes('🟡')) indicator = <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block mr-2" />;
      if (line.includes('🟢')) indicator = <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-2" />;

      const cleanLine = line.replace(/[🔴🟡🟢]/g, '').trim();

      if (!cleanLine && !indicator) return <br key={i} />;

      return (
        <p key={i} className={`my-1 flex items-center ${line.startsWith('---') ? 'border-t border-gray-100 pt-4 mt-4 font-bold text-gray-900' : 'text-gray-700'}`}>
          {indicator}
          {cleanLine}
        </p>
      );
    });
  };

  return (
    <>
      <button
        onClick={handleAnalyze}
        className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors font-medium text-sm shadow-sm"
      >
        <Zap size={16} className="fill-indigo-700" />
        {label}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
            <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-indigo-600 fill-indigo-600" />
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm">rødën AI Analysis</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
                  <Loader2 size={32} className="animate-spin text-indigo-500" />
                  <p className="text-sm font-medium animate-pulse">Procesando datos operativos...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {analysis ? renderContent(analysis) : "No hay datos para mostrar."}
                </div>
              )}
            </div>

            <footer className="p-6 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold text-center">
                Sistema de Inteligencia Operativa rødën
              </p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default RodenAIButton;
