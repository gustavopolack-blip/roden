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
      const trimmedLine = line.trim();
      
      // Interpretar separadores ---
      if (trimmedLine.startsWith('---')) {
        return <hr key={i} className="my-4 border-gray-100" />;
      }

      // Interpretar títulos (líneas en mayúsculas o que terminan en :)
      const isHeader = trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && !trimmedLine.includes('$');
      if (isHeader || (trimmedLine.endsWith(':') && trimmedLine.length < 40)) {
        return (
          <h4 key={i} className="text-[10px] font-bold text-roden-black uppercase tracking-widest mt-6 mb-2 first:mt-0">
            {trimmedLine}
          </h4>
        );
      }

      // Interpretar checkboxes [ ]
      if (trimmedLine.startsWith('[ ]')) {
        return (
          <div key={i} className="flex items-start gap-2 my-1.5 text-roden-black">
            <Square size={14} className="mt-0.5 flex-shrink-0 text-gray-300" />
            <span className="text-xs leading-relaxed">{trimmedLine.replace('[ ]', '').trim()}</span>
          </div>
        );
      }
      if (trimmedLine.startsWith('[x]') || trimmedLine.startsWith('[X]')) {
        return (
          <div key={i} className="flex items-start gap-2 my-1.5 text-roden-black">
            <CheckSquare size={14} className="mt-0.5 flex-shrink-0 text-roden-black" />
            <span className="text-xs leading-relaxed line-through text-gray-400">{trimmedLine.replace(/\[x\]|\[X\]/gi, '').trim()}</span>
          </div>
        );
      }

      // Interpretar indicadores visuales (emojis)
      let indicator = null;
      if (line.includes('🔴')) indicator = <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-2 flex-shrink-0" />;
      if (line.includes('🟡')) indicator = <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block mr-2 flex-shrink-0" />;
      if (line.includes('🟢')) indicator = <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-2 flex-shrink-0" />;

      const cleanLine = line.replace(/[🔴🟡🟢]/g, '').trim();

      if (!cleanLine && !indicator) return <div key={i} className="h-2" />;

      // Líneas con flecha → (Acciones)
      if (cleanLine.startsWith('→')) {
        return (
          <p key={i} className="text-[10px] font-bold text-indigo-600 bg-indigo-50/50 p-2 rounded mt-4 border border-indigo-100/50 flex items-center gap-2">
            {cleanLine}
          </p>
        );
      }

      return (
        <p key={i} className="text-xs text-roden-black leading-relaxed my-1 flex items-start">
          {indicator}
          <span>{cleanLine}</span>
        </p>
      );
    });
  };

  return (
    <>
      <button
        onClick={handleAnalyze}
        className="inline-flex items-center gap-2 bg-white text-roden-black border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-all font-bold text-xs shadow-sm"
      >
        <Zap size={14} className="fill-roden-black" />
        {label}
      </button>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/10 backdrop-blur-[2px] transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-gray-100">
            <header className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-roden-black fill-roden-black" />
                <h3 className="font-bold text-roden-black uppercase tracking-widest text-[11px]">rødën AI Intelligence</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400">
                  <Loader2 size={24} className="animate-spin text-roden-black" />
                  <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Analizando datos...</p>
                </div>
              ) : (
                <div className="max-w-none">
                  {analysis ? renderContent(analysis) : "No hay datos para mostrar."}
                </div>
              )}
            </div>

            <footer className="p-6 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.2em] font-bold text-center">
                Propiedad Intelectual de rødën
              </p>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default RodenAIButton;
