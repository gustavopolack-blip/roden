import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Plus, Trash2, StickyNote, X, Check, Archive,
  ChevronDown, ChevronRight, CornerDownRight, Pencil,
  CalendarPlus, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';

interface SubNota {
  id: string;
  texto: string;
  hecha: boolean;
}

interface Nota {
  id: string;
  texto: string;
  hecha: boolean;
  archivada: boolean;
  subnotas: SubNota[];
  created_at: string;
}

interface EventoModal {
  notaId: string;
  titulo: string;
  fecha: string;   // YYYY-MM-DD
  hora: string;    // HH:MM
  duracion: number; // minutos
}

interface NotasGestionProps {
  onClose: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 10);

// Próximo día de semana a partir de hoy
const nextWeekday = (dayName: string): string => {
  const days: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
    jueves: 4, viernes: 5, sábado: 6, sabado: 6
  };
  const target = days[dayName.toLowerCase()];
  if (target === undefined) return '';
  const today = new Date();
  const diff = (target - today.getDay() + 7) % 7 || 7;
  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return result.toISOString().slice(0, 10);
};

// Intentar inferir fecha/hora del texto de la nota
const inferirFechaHora = (texto: string): { fecha: string; hora: string } => {
  const lower = texto.toLowerCase();
  const hoy = new Date();
  let fecha = '';
  let hora = '09:00';

  // "próximo/proximo lunes/martes/..."
  const diasMatch = lower.match(/próximo\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/);
  if (diasMatch) fecha = nextWeekday(diasMatch[1]);

  // "este lunes/martes/..."
  if (!fecha) {
    const esteMatch = lower.match(/este\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/);
    if (esteMatch) fecha = nextWeekday(esteMatch[1]);
  }

  // Solo nombre del día
  if (!fecha) {
    const diaMatch = lower.match(/\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/);
    if (diaMatch) fecha = nextWeekday(diaMatch[1]);
  }

  // "mañana"
  if (!fecha && lower.includes('mañana')) {
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    fecha = manana.toISOString().slice(0, 10);
  }

  // "hoy"
  if (!fecha && lower.includes('hoy')) {
    fecha = hoy.toISOString().slice(0, 10);
  }

  // Hora: "a las 15", "15hs", "15:00", "3pm", "3 pm"
  const horaMatch = lower.match(/a\s+las\s+(\d{1,2})(?::(\d{2}))?|(\d{1,2})\s*hs|(\d{1,2}):(\d{2})|(\d{1,2})\s*(am|pm)/);
  if (horaMatch) {
    let h = parseInt(horaMatch[1] || horaMatch[3] || horaMatch[4] || horaMatch[6] || '9');
    const m = parseInt(horaMatch[2] || horaMatch[5] || '0');
    if (horaMatch[7] === 'pm' && h < 12) h += 12;
    if (horaMatch[7] === 'am' && h === 12) h = 0;
    hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Fallback fecha: mañana
  if (!fecha) {
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    fecha = manana.toISOString().slice(0, 10);
  }

  return { fecha, hora };
};

const NotasGestion: React.FC<NotasGestionProps> = ({ onClose }) => {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoTexto, setEditandoTexto] = useState('');
  const [subnotaInput, setSubnotaInput] = useState<Record<string, string>>({});
  const [eventoModal, setEventoModal] = useState<EventoModal | null>(null);
  const [eventoStatus, setEventoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [eventoMsg, setEventoMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cargarNotas(); }, []);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const cargarNotas = async () => {
    const { data, error } = await supabase
      .from('notas_gestion')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setNotas(data.map((n: any) => ({
        ...n,
        archivada: n.archivada ?? false,
        subnotas: Array.isArray(n.subnotas) ? n.subnotas : [],
      })));
    }
    setLoading(false);
  };

  // ── NOTA PRINCIPAL ─────────────────────────────────────

  const agregarNota = async () => {
    const texto = nuevoTexto.trim();
    if (!texto) return;
    const { data, error } = await supabase
      .from('notas_gestion')
      .insert({ texto, subnotas: [] })
      .select()
      .single();
    if (!error && data) {
      setNotas(prev => [{ ...data, archivada: false, subnotas: [] }, ...prev]);
      setNuevoTexto('');
    }
  };

  const toggleHecha = async (nota: Nota) => {
    const nuevo = !nota.hecha;
    const { error } = await supabase.from('notas_gestion').update({ hecha: nuevo }).eq('id', nota.id);
    if (!error) setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, hecha: nuevo } : n));
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta nota permanentemente?')) return;
    const { error } = await supabase.from('notas_gestion').delete().eq('id', id);
    if (!error) setNotas(prev => prev.filter(n => n.id !== id));
  };

  const archivar = async (nota: Nota) => {
    const nuevo = !nota.archivada;
    const { error } = await supabase.from('notas_gestion').update({ archivada: nuevo }).eq('id', nota.id);
    if (!error) setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, archivada: nuevo } : n));
  };

  const iniciarEdicion = (nota: Nota) => {
    setEditandoId(nota.id);
    setEditandoTexto(nota.texto);
  };

  const guardarEdicion = async (nota: Nota) => {
    const texto = editandoTexto.trim();
    if (!texto) { setEditandoId(null); return; }
    const { error } = await supabase.from('notas_gestion').update({ texto }).eq('id', nota.id);
    if (!error) setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, texto } : n));
    setEditandoId(null);
  };

  // ── EVENTO CALENDARIO ──────────────────────────────────

  const abrirEventoModal = (nota: Nota) => {
    const { fecha, hora } = inferirFechaHora(nota.texto);
    setEventoModal({
      notaId: nota.id,
      titulo: nota.texto,
      fecha,
      hora,
      duracion: 60,
    });
    setEventoStatus('idle');
    setEventoMsg('');
  };

  const crearEvento = async () => {
    if (!eventoModal) return;
    setEventoStatus('loading');
    setEventoMsg('');

    try {
      const startDt = `${eventoModal.fecha}T${eventoModal.hora}:00`;
      const endDate = new Date(`${eventoModal.fecha}T${eventoModal.hora}:00`);
      endDate.setMinutes(endDate.getMinutes() + eventoModal.duracion);
      const endDt = endDate.toISOString().slice(0, 16) + ':00';

      // Generar link directo a Google Calendar (funciona sin tokens ni APIs)
      // Formato: https://calendar.google.com/calendar/render?action=TEMPLATE&...
      const fmt = (dt: string) => dt.replace(/[-:]/g, '').replace('T', 'T');
      const start = fmt(startDt);
      const end   = fmt(endDt);
      const params = new URLSearchParams({
        action:  'TEMPLATE',
        text:    eventoModal.titulo,
        dates:   `${start}/${end}`,
        details: 'Creado desde rødën OS — Notas de gestión',
        ctz:     'America/Argentina/Buenos_Aires',
      });
      const link = `https://calendar.google.com/calendar/render?${params.toString()}`;

      setEventoStatus('ok');
      setEventoMsg(link);
    } catch (e: any) {
      setEventoStatus('error');
      setEventoMsg(e.message || 'Error generando el link');
    }
  };

  // ── SUBNOTAS ───────────────────────────────────────────

  const agregarSubnota = async (nota: Nota) => {
    const texto = (subnotaInput[nota.id] || '').trim();
    if (!texto) return;
    const nuevaSub: SubNota = { id: genId(), texto, hecha: false };
    const nuevasSubnotas = [...nota.subnotas, nuevaSub];
    const { error } = await supabase.from('notas_gestion').update({ subnotas: nuevasSubnotas }).eq('id', nota.id);
    if (!error) {
      setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, subnotas: nuevasSubnotas } : n));
      setSubnotaInput(prev => ({ ...prev, [nota.id]: '' }));
    }
  };

  const toggleSubnota = async (nota: Nota, subId: string) => {
    const nuevasSubnotas = nota.subnotas.map(s => s.id === subId ? { ...s, hecha: !s.hecha } : s);
    const { error } = await supabase.from('notas_gestion').update({ subnotas: nuevasSubnotas }).eq('id', nota.id);
    if (!error) setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, subnotas: nuevasSubnotas } : n));
  };

  const eliminarSubnota = async (nota: Nota, subId: string) => {
    const nuevasSubnotas = nota.subnotas.filter(s => s.id !== subId);
    const { error } = await supabase.from('notas_gestion').update({ subnotas: nuevasSubnotas }).eq('id', nota.id);
    if (!error) setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, subnotas: nuevasSubnotas } : n));
  };

  const toggleExpandida = (id: string) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── RENDER NOTA ────────────────────────────────────────

  const renderNota = (nota: Nota, opaca = false) => {
    const expandida = expandidas.has(nota.id);
    const editando  = editandoId === nota.id;
    const subPend   = nota.subnotas.filter(s => !s.hecha).length;
    const subTotal  = nota.subnotas.length;

    return (
      <div key={nota.id} className={`border-b border-gray-100 transition-colors ${opaca ? 'opacity-60 hover:opacity-90' : 'hover:bg-gray-50/60'}`}>

        <div className="flex items-start gap-4 px-8 py-4 group">

          <button
            onClick={() => toggleHecha(nota)}
            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
              ${nota.hecha ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300 hover:border-amber-400'}`}
          >
            {nota.hecha && <Check size={11} className="text-white" />}
          </button>

          <div className="flex-1 min-w-0">
            {editando ? (
              <input
                autoFocus
                value={editandoTexto}
                onChange={e => setEditandoTexto(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') guardarEdicion(nota);
                  if (e.key === 'Escape') setEditandoId(null);
                }}
                onBlur={() => guardarEdicion(nota)}
                className="w-full text-lg border border-amber-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
              />
            ) : (
              <span
                onDoubleClick={() => iniciarEdicion(nota)}
                className={`text-lg leading-snug cursor-default select-none ${nota.hecha ? 'line-through text-gray-400' : 'text-gray-800'}`}
              >
                {nota.texto}
              </span>
            )}

            {subTotal > 0 && !editando && (
              <button
                onClick={() => toggleExpandida(nota.id)}
                className="flex items-center gap-1 mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {expandida ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                {subPend > 0 ? `${subPend} de ${subTotal} pendiente${subPend !== 1 ? 's' : ''}` : `${subTotal} subtarea${subTotal !== 1 ? 's' : ''} completada${subTotal !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
            <button onClick={() => iniciarEdicion(nota)} title="Editar"
              className="p-1.5 rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors">
              <Pencil size={15} />
            </button>
            <button
              onClick={() => { if (!expandidas.has(nota.id)) toggleExpandida(nota.id); }}
              title="Agregar subtarea"
              className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
              <CornerDownRight size={15} />
            </button>
            <button onClick={() => abrirEventoModal(nota)} title="Enviar a Google Calendar"
              className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
              <CalendarPlus size={15} />
            </button>
            <button onClick={() => archivar(nota)} title={nota.archivada ? 'Desarchivar' : 'Archivar'}
              className="p-1.5 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-colors">
              <Archive size={15} />
            </button>
            <button onClick={() => eliminar(nota.id)} title="Eliminar"
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {expandida && (
          <div className="pl-20 pr-8 pb-4 space-y-2 bg-gray-50/50">
            {nota.subnotas.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 py-1 group/sub">
                <button
                  onClick={() => toggleSubnota(nota, sub.id)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                    ${sub.hecha ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300 hover:border-amber-400'}`}
                >
                  {sub.hecha && <Check size={9} className="text-white" />}
                </button>
                <span className={`flex-1 text-base leading-snug ${sub.hecha ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {sub.texto}
                </span>
                <button onClick={() => eliminarSubnota(nota, sub.id)}
                  className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-gray-300 hover:text-red-400 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={subnotaInput[nota.id] || ''}
                onChange={e => setSubnotaInput(prev => ({ ...prev, [nota.id]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && agregarSubnota(nota)}
                placeholder="Agregar subtarea..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-4 py-2 outline-none focus:ring-1 focus:ring-amber-400 bg-white"
              />
              <button onClick={() => agregarSubnota(nota)}
                disabled={!(subnotaInput[nota.id] || '').trim()}
                className="bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const activas    = notas.filter(n => !n.archivada);
  const archivadas = notas.filter(n => n.archivada);
  const pendientes = activas.filter(n => !n.hecha);
  const hechas     = activas.filter(n => n.hecha);

  return (
    <>
    {/* ── PANTALLA COMPLETA DE NOTAS ── */}
    <div className="fixed inset-0 z-[300] bg-white flex flex-col">
      <div className="relative bg-white w-full h-full flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <StickyNote size={22} className="text-amber-500" />
            <span className="font-bold text-2xl text-gray-800">Notas de gestión</span>
            {pendientes.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">
                {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {archivadas.length > 0 && (
              <button
                onClick={() => setVerArchivadas(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${verArchivadas ? 'bg-purple-50 border-purple-200 text-purple-700 font-medium' : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                <Archive size={13} />
                Archivadas ({archivadas.length})
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Input nueva nota */}
        <div className="px-8 py-4 border-b border-gray-100 shrink-0">
          <div className="flex gap-3 max-w-4xl">
            <input
              ref={inputRef}
              type="text"
              value={nuevoTexto}
              onChange={e => setNuevoTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarNota()}
              placeholder="Nueva nota... (Enter para agregar)"
              className="flex-1 text-base border border-gray-200 rounded-xl px-5 py-3 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-gray-50"
            />
            <button onClick={agregarNota} disabled={!nuevoTexto.trim()}
              className="bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl px-6 py-3 font-semibold transition-colors flex items-center gap-2 text-base shrink-0">
              <Plus size={18} /> Agregar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-16">Cargando...</p>
          ) : !verArchivadas ? (
            activas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-16">
                <StickyNote size={32} className="opacity-30" />
                <p className="text-sm">Sin notas. Agregá tu primera tarea.</p>
              </div>
            ) : (
              <>
                {pendientes.length > 0 && (
                  <div className="px-5 pt-4 pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                      Pendientes · {pendientes.length}
                    </span>
                  </div>
                )}
                {pendientes.map(nota => renderNota(nota))}
                {hechas.length > 0 && (
                  <>
                    <div className="px-5 pt-4 pb-1.5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                        Completadas · {hechas.length}
                      </span>
                    </div>
                    {hechas.map(nota => renderNota(nota, true))}
                  </>
                )}
              </>
            )
          ) : (
            archivadas.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-16">No hay notas archivadas.</p>
            ) : (
              <>
                <div className="px-5 pt-4 pb-1.5">
                  <span className="text-[10px] uppercase font-bold text-purple-400 tracking-widest">
                    Archivadas · {archivadas.length}
                  </span>
                </div>
                {archivadas.map(nota => renderNota(nota, true))}
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-between items-center">
          <span className="text-[11px] text-gray-400">
            Doble clic para editar · <CalendarPlus size={10} className="inline mb-0.5" /> para enviar al calendario
          </span>
          <span className="text-[11px] text-gray-400">
            {activas.length} nota{activas.length !== 1 ? 's' : ''} activa{activas.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>

    {/* ── MODAL DE EVENTO CALENDARIO ── */}
    {eventoModal && (
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-green-50">
            <div className="flex items-center gap-2">
              <CalendarPlus size={18} className="text-green-600" />
              <span className="font-bold text-sm text-gray-800">Enviar a Google Calendar</span>
            </div>
            <button onClick={() => setEventoModal(null)} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">

            {/* Título */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Título del evento</label>
              <input
                type="text"
                value={eventoModal.titulo}
                onChange={e => setEventoModal(prev => prev ? { ...prev, titulo: e.target.value } : null)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
              />
            </div>

            {/* Fecha y hora */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
                <input
                  type="date"
                  value={eventoModal.fecha}
                  onChange={e => setEventoModal(prev => prev ? { ...prev, fecha: e.target.value } : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Hora inicio</label>
                <input
                  type="time"
                  value={eventoModal.hora}
                  onChange={e => setEventoModal(prev => prev ? { ...prev, hora: e.target.value } : null)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                />
              </div>
            </div>

            {/* Duración */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Duración</label>
              <select
                value={eventoModal.duracion}
                onChange={e => setEventoModal(prev => prev ? { ...prev, duracion: Number(e.target.value) } : null)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1 hora 30 min</option>
                <option value={120}>2 horas</option>
                <option value={180}>3 horas</option>
                <option value={480}>Todo el día (8hs)</option>
              </select>
            </div>

            {/* Estado */}
            {eventoStatus === 'ok' && (
              <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2.5 text-sm">
                <CheckCircle2 size={16} className="shrink-0" />
                <div>
                  <p className="font-medium">Listo — hacé clic para confirmar en Google Calendar</p>
                  {eventoMsg && (
                    <a href={eventoMsg} target="_blank" rel="noopener noreferrer"
                      className="text-xs underline text-green-600 hover:text-green-800 font-bold">
                      Abrir Google Calendar para guardar el evento →
                    </a>
                  )}
                </div>
              </div>
            )}
            {eventoStatus === 'error' && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{eventoMsg || 'No se pudo crear el evento. Verificá la conexión con Google Calendar.'}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-2 justify-end">
            <button onClick={() => setEventoModal(null)}
              className="px-4 py-2 text-sm text-gray-500 font-medium hover:text-gray-700 transition-colors">
              {eventoStatus === 'ok' ? 'Cerrar' : 'Cancelar'}
            </button>
            {eventoStatus !== 'ok' && (
              <button
                onClick={crearEvento}
                disabled={eventoStatus === 'loading' || !eventoModal.titulo.trim() || !eventoModal.fecha}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
              >
                {eventoStatus === 'loading' ? (
                  <><Loader2 size={14} className="animate-spin" /> Creando...</>
                ) : (
                  <><CalendarPlus size={14} /> Crear evento</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default NotasGestion;
