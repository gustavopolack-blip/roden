
import React, { useState } from 'react';
import { Save, Bell, Lock, Globe, Database, Building2, RefreshCw } from 'lucide-react';

interface SettingsProps {
    onLoadDemoData?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onLoadDemoData }) => {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="space-y-8 animate-fade-in relative max-w-4xl mx-auto">
      <header className="border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-bold text-roden-black tracking-tight">Configuración</h2>
        <p className="text-roden-gray text-sm mt-1">Administra las preferencias generales del sistema rødën OS.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="space-y-1">
          <button 
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Building2 size={18} /> General
          </button>
          <button 
             onClick={() => setActiveTab('notifications')}
             className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Bell size={18} /> Notificaciones
          </button>
          <button 
             onClick={() => setActiveTab('security')}
             className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Lock size={18} /> Seguridad
          </button>
          <button 
             onClick={() => setActiveTab('data')}
             className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'data' ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Database size={18} /> Datos & Demo
          </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
            
            {/* General Section */}
            {activeTab === 'general' && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-lg font-bold text-roden-black mb-4">Perfil de Empresa</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                                <input type="text" defaultValue="rødën Amoblamientos" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT / ID Fiscal</label>
                                <input type="text" defaultValue="30-71234567-9" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-gray-50" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección del Taller</label>
                                <input type="text" defaultValue="Av. del Libertador 2200, Olivos, Buenos Aires" className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-black outline-none bg-gray-50" />
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100">
                        <h3 className="text-lg font-bold text-roden-black mb-4">Preferencias Regionales</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"><Globe size={14}/> Idioma</label>
                                <select className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white">
                                    <option>Español (Argentina)</option>
                                    <option>English (US)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda Principal</label>
                                <select className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white">
                                    <option>USD - Dólar Estadounidense</option>
                                    <option>ARS - Peso Argentino</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button className="bg-roden-black text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors">
                            <Save size={16} /> Guardar Cambios
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications Section */}
            {activeTab === 'notifications' && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6 animate-fade-in">
                     <h3 className="text-lg font-bold text-roden-black mb-4">Alertas Automáticas</h3>
                     <div className="space-y-4">
                        {['Nuevos Leads ingresados', 'Presupuestos Aprobados', 'Retrasos en Producción > 2 días', 'Tareas de alta prioridad vencidas'].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                                <span className="text-sm font-medium text-gray-700">{item}</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked={i < 2} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-roden-black"></div>
                                </label>
                            </div>
                        ))}
                     </div>
                </div>
            )}

             {/* Data & Demo Section */}
             {activeTab === 'data' && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6 animate-fade-in">
                    <div>
                        <h3 className="text-lg font-bold text-roden-black mb-2">Datos de Prueba</h3>
                        <p className="text-sm text-gray-500 mb-6">Si estás en modo Demo, puedes restaurar los datos de ejemplo iniciales.</p>
                        
                        <button 
                            onClick={onLoadDemoData}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                        >
                            <RefreshCw size={18} /> Cargar / Resetear Datos Demo
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-6 mt-6">
                        <h3 className="text-lg font-bold text-gray-400 mb-2">Copia de Seguridad</h3>
                        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                            <p className="text-sm text-gray-400">La conexión con la base de datos es gestionada externamente.</p>
                        </div>
                    </div>
                </div>
            )}

             {activeTab === 'security' && (
                <div className="bg-white border border-gray-200 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center text-center animate-fade-in h-64">
                    <Lock size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold text-gray-400">Configuración Avanzada</h3>
                    <p className="text-sm text-gray-400 mt-2">Esta sección está restringida en la versión demo.</p>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
