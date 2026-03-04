import React, { useState, useRef, useEffect } from 'react';
import { BusinessData, User } from '../types';
import { askRodenAI } from '../services/geminiService';
import { Sparkles, Send, Bot, User as UserIcon, ArrowUp, Trash2, Zap } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import RodenAIButton from '../components/RodenAIButton';

interface AIAssistantProps {
  data: BusinessData;
  user: User;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ data, user }) => {
  const userEmail = user.email;
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Hola. Soy rødën AI, tu Sistema de Inteligencia Operativa. Tengo acceso a la operación en tiempo real. ¿Qué necesitás saber hoy?', timestamp: Date.now() }
  ]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load History from Supabase
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data: historyData, error } = await supabase
          .from('ai_chat_history')
          .select('messages')
          .eq('user_email', userEmail)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error("Error loading chat history:", error);
        } else if (historyData && historyData.messages) {
          setMessages(historyData.messages);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadHistory();
  }, [userEmail]);

  // Save History to Supabase
  const saveHistory = async (newMessages: Message[]) => {
    try {
      const { error } = await supabase
        .from('ai_chat_history')
        .upsert({
          user_email: userEmail,
          messages: newMessages,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_email' });

      if (error) console.error("Error saving chat history:", error);
    } catch (err) {
      console.error("Failed to save chat history:", err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = query.trim();
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg, timestamp: Date.now() }];
    
    setMessages(newMessages);
    setQuery('');
    setLoading(true);

    try {
      const responseContent = await askRodenAI(userMsg, data);
      const finalMessages: Message[] = [...newMessages, { role: 'ai', content: responseContent, timestamp: Date.now() }];
      setMessages(finalMessages);
      saveHistory(finalMessages);
    } catch (error) {
      const errorMessages: Message[] = [...newMessages, { role: 'ai', content: "Error en la conexión con rødën AI. Reintentá en unos momentos.", timestamp: Date.now() }];
      setMessages(errorMessages);
      saveHistory(errorMessages);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (confirm("¿Deseas borrar el historial de chat?")) {
      const initialMessages: Message[] = [{ role: 'ai', content: 'Historial borrado. ¿Qué necesitás saber hoy?', timestamp: Date.now() }];
      setMessages(initialMessages);
      await supabase.from('ai_chat_history').delete().eq('user_email', userEmail);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isInitialLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Bot size={48} className="text-gray-300 animate-pulse" />
          <p className="text-gray-500 font-medium">Iniciando rødën AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col max-w-5xl mx-auto animate-fade-in">
      <header className="mb-8 flex justify-between items-end">
        <div className="text-left">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-900 to-black px-4 py-1.5 rounded-full shadow-lg mb-4">
             <Sparkles size={14} className="text-yellow-200" />
             <span className="text-xs font-bold text-white uppercase tracking-widest">rødën AI</span>
          </div>
          <h2 className="text-3xl font-bold text-roden-black tracking-tight">Inteligencia Operativa</h2>
          <p className="text-gray-500 text-sm mt-2">Análisis estratégico y gestión de taller en tiempo real.</p>
        </div>
        <div className="flex items-end gap-3">
          <RodenAIButton 
            mode="historial_diagnostico" 
            data={data} 
            userRole={user.role}
          />
          <button 
            onClick={clearHistory}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors mb-2"
          >
            <Trash2 size={14} /> Borrar Historial
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-xl shadow-gray-200/50">
        
        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.role === 'ai' ? 'bg-black border-black' : 'bg-white border-gray-200'}`}>
                {msg.role === 'ai' ? <Bot size={20} className="text-white" /> : <UserIcon size={20} className="text-black" />}
              </div>
              <div className={`max-w-[80%] p-6 rounded-2xl text-base leading-relaxed shadow-sm ${
                msg.role === 'ai' 
                  ? 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-none' 
                  : 'bg-black text-white rounded-tr-none'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
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
              placeholder="Preguntá sobre riesgos, rentabilidad o pedí un briefing..."
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
            {['Briefing diario', 'Alerta de riesgos', 'Análisis de rentabilidad'].map(suggestion => (
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