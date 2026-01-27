import React, { useState, useRef, useEffect } from 'react';
import { BusinessData } from '../types';
import { askRodenAI } from '../services/geminiService';
import { Sparkles, Send, Bot, User, ArrowUp } from 'lucide-react';

interface AIAssistantProps {
  data: BusinessData;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Hola. Soy la IA de rødën. Tengo acceso a tus proyectos, clientes y presupuestos. ¿Cómo puedo ayudarte con la operación hoy?' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    setLoading(true);

    const response = await askRodenAI(userMsg, data);

    setMessages(prev => [...prev, { role: 'ai', content: response }]);
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-900 to-black px-4 py-1.5 rounded-full shadow-lg mb-4">
           <Sparkles size={14} className="text-yellow-200" />
           <span className="text-xs font-bold text-white uppercase tracking-widest">Inteligencia rødën</span>
        </div>
        <h2 className="text-3xl font-bold text-roden-black tracking-tight">Pregunta a rødën</h2>
        <p className="text-gray-500 text-sm mt-2">Análisis semántico de los datos de tu negocio.</p>
      </header>

      {/* Chat Container */}
      <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-xl shadow-gray-200/50">
        
        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.role === 'ai' ? 'bg-black border-black' : 'bg-white border-gray-200'}`}>
                {msg.role === 'ai' ? <Bot size={20} className="text-white" /> : <User size={20} className="text-black" />}
              </div>
              <div className={`max-w-[80%] p-6 rounded-2xl text-base leading-relaxed shadow-sm ${
                msg.role === 'ai' 
                  ? 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-none' 
                  : 'bg-black text-white rounded-tr-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex gap-6">
               <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center shadow-sm">
                 <Bot size={20} className="text-white" />
               </div>
               <div className="bg-gray-50 border border-gray-100 px-6 py-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white border-t border-gray-100">
          <div className="relative shadow-lg rounded-xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Pregunta sobre proyectos, clientes o ingresos..."
              className="w-full bg-white text-roden-black pl-6 pr-14 py-4 rounded-xl border border-gray-200 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all placeholder:text-gray-400 font-medium"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-black rounded-lg text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <ArrowUp size={20} />
            </button>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            {['Resumen de estado', 'Presupuestos pendientes', 'Checklist Cocina'].map(suggestion => (
               <button 
                key={suggestion} 
                onClick={() => {
                  setQuery(suggestion);
                }}
                className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-md hover:text-black hover:border-gray-300 transition-colors"
               >
                 {suggestion}
               </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;