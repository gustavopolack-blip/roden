import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import {
  Megaphone, Plus, Trash2, Loader2, TrendingUp, Send, Users as UsersIcon,
  Image as ImageIcon, RefreshCw, Phone,
} from 'lucide-react';

// ── Tipos del módulo (tablas mkt_*) ─────────────────────────────────────────
interface MktLead {
  id: string;
  created_at: string;
  nombre: string;
  telefono: string | null;
  origen: string;
  tipo: 'Integral' | 'Ambiente' | 'Pieza';
  score: 'A' | 'B' | 'C' | 'D';
  estado: string;
  propuesta_fecha: string | null;
  notas: string | null;
}
interface MktAsset {
  id: string; created_at: string; proyecto: string; categoria: string;
  archivo: string; descripcion: string | null; estado: string;
}
interface MktPieza {
  id: string; created_at: string; tipo: string; titulo: string; pilar: string | null;
  proyecto: string | null; archivo: string | null; canal: string | null;
  publicada: boolean; fecha_publicacion: string | null; resultado: string | null;
}
interface RecompraRow {
  client_id: string; name: string; phone: string | null; total_value: number | null;
  obras_completadas: number; ultima_obra: string | null; satisfaccion: number | null;
}

const ESTADOS = ['En evaluación', 'Relevamiento', 'Propuesta enviada', 'Cerrado ganado', 'No viable', 'Cliente futuro'];
const ORIGENES = ['IG orgánico', 'IG pauta', 'Facebook', 'Web directa', 'Google', 'Referido', 'Cliente anterior'];

const weekStart = (): Date => {
  const x = new Date();
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const monthStart = (): Date => {
  const x = new Date();
  x.setDate(1); x.setHours(0, 0, 0, 0);
  return x;
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const Marketing: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<MktLead[]>([]);
  const [assets, setAssets] = useState<MktAsset[]>([]);
  const [piezas, setPiezas] = useState<MktPieza[]>([]);
  const [recompra, setRecompra] = useState<RecompraRow[]>([]);

  // Form de alta de lead
  const [fNombre, setFNombre] = useState('');
  const [fTelefono, setFTelefono] = useState('');
  const [fOrigen, setFOrigen] = useState(ORIGENES[0]);
  const [fTipo, setFTipo] = useState<MktLead['tipo']>('Ambiente');
  const [fScore, setFScore] = useState<MktLead['score']>('B');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, a, p, r] = await Promise.all([
        supabase.from('mkt_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('mkt_assets').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('mkt_piezas').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.rpc('mkt_recompra_admin'),
      ]);
      if (l.error) throw l.error;
      setLeads(l.data || []);
      setAssets(a.data || []);
      setPiezas(p.data || []);
      setRecompra(r.data || []);
    } catch (err: any) {
      console.error('[Marketing] Error cargando datos:', err);
      setError(err.message?.includes('row-level security')
        ? 'Tu usuario no tiene permisos de administrador para este módulo.'
        : `Error de conexión: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Stats ──
  const ws = weekStart(), ms = monthStart();
  const propsSemana = leads.filter(l => l.propuesta_fecha && new Date(l.propuesta_fecha) >= ws).length;
  const leadsMes = leads.filter(l => new Date(l.created_at) >= ms);
  const pctIntegral = leadsMes.length
    ? Math.round(100 * leadsMes.filter(l => l.tipo === 'Integral').length / leadsMes.length)
    : 0;
  const piezasPendientes = piezas.filter(p => !p.publicada).length;

  // ── Handlers ──
  const handleAddLead = async () => {
    if (!fNombre.trim()) { alert('Falta el nombre del lead.'); return; }
    setSaving(true);
    try {
      const { error: e } = await supabase.from('mkt_leads').insert({
        nombre: fNombre.trim(), telefono: fTelefono.trim() || null,
        origen: fOrigen, tipo: fTipo, score: fScore, estado: 'En evaluación',
      });
      if (e) throw e;
      setFNombre(''); setFTelefono('');
      fetchAll();
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEstado = async (lead: MktLead, estado: string) => {
    const upd: Partial<MktLead> = { estado };
    if (estado === 'Propuesta enviada' && !lead.propuesta_fecha) upd.propuesta_fecha = new Date().toISOString();
    const { error: e } = await supabase.from('mkt_leads').update(upd).eq('id', lead.id);
    if (e) alert(`Error: ${e.message}`); else fetchAll();
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('¿Eliminar este lead del registro?')) return;
    const { error: e } = await supabase.from('mkt_leads').delete().eq('id', id);
    if (e) alert(`Error: ${e.message}`); else fetchAll();
  };

  const handlePiezaPublicada = async (p: MktPieza, publicada: boolean) => {
    const { error: e } = await supabase.from('mkt_piezas').update({
      publicada, fecha_publicacion: publicada ? new Date().toISOString().slice(0, 10) : null,
    }).eq('id', p.id);
    if (e) alert(`Error: ${e.message}`); else fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
        <p className="font-bold mb-2">Módulo de Marketing</p>
        <p className="text-sm">{error}</p>
        <button onClick={fetchAll} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    );
  }

  const scoreBadge = (s: string) => {
    const map: Record<string, string> = {
      A: 'bg-emerald-100 text-emerald-700', B: 'bg-blue-100 text-blue-700',
      C: 'bg-amber-100 text-amber-700', D: 'bg-gray-100 text-gray-500',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] || ''}`}>{s}</span>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-roden-black flex items-center gap-3">
            <Megaphone size={26} /> Marketing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Admisión calificada: máximo 5 propuestas por semana. Objetivo: migrar la mezcla hacia proyectos integrales.
          </p>
        </div>
        <button onClick={fetchAll} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Actualizar">
          <RefreshCw size={18} className="text-gray-500" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-xl p-5 border ${propsSemana >= 5 ? 'bg-amber-50 border-amber-300' : 'bg-roden-black border-roden-black text-white'}`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-70"><Send size={14} /> Propuestas semana</div>
          <p className="text-3xl font-bold mt-2">{propsSemana} / 5</p>
          <p className="text-xs mt-1 opacity-70">{propsSemana >= 5 ? 'Cupo completo: solo un integral A desplaza.' : 'Cupo disponible.'}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400"><TrendingUp size={14} /> % Integral (mes)</div>
          <p className="text-3xl font-bold mt-2 text-roden-black">{pctIntegral}%</p>
          <p className="text-xs mt-1 text-gray-400">Histórico ~5% · meta 20–25%</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400"><UsersIcon size={14} /> Leads del mes</div>
          <p className="text-3xl font-bold mt-2 text-roden-black">{leadsMes.length}</p>
          <p className="text-xs mt-1 text-gray-400">Con origen registrado</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400"><ImageIcon size={14} /> Piezas sin publicar</div>
          <p className="text-3xl font-bold mt-2 text-roden-black">{piezasPendientes}</p>
          <p className="text-xs mt-1 text-gray-400">Listas en el banco de contenido</p>
        </div>
      </div>

      {/* Alta de lead */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-bold text-roden-black mb-4">Nuevo lead</h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="col-span-2 lg:col-span-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Nombre</label>
            <input value={fNombre} onChange={e => setFNombre(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Teléfono</label>
            <input value={fTelefono} onChange={e => setFTelefono(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-black outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Origen</label>
            <select value={fOrigen} onChange={e => setFOrigen(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {ORIGENES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Tipo</label>
            <select value={fTipo} onChange={e => setFTipo(e.target.value as MktLead['tipo'])}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option>Integral</option><option>Ambiente</option><option>Pieza</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Score</label>
            <select value={fScore} onChange={e => setFScore(e.target.value as MktLead['score'])}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option>A</option><option>B</option><option>C</option><option>D</option>
            </select>
          </div>
          <button onClick={handleAddLead} disabled={saving}
            className="px-4 py-2.5 bg-roden-black text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Agregar
          </button>
        </div>
      </div>

      {/* Tabla de leads */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Origen</th><th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Score</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Sin leads registrados. Cargá el primero cuando entre una consulta por WhatsApp.
                </td></tr>
              )}
              {leads.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-roden-black">
                    {l.nombre}
                    {l.telefono && <span className="block text-xs text-gray-400">{l.telefono}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{l.origen}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${l.tipo === 'Integral' ? 'bg-roden-black text-white' : l.tipo === 'Ambiente' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>{l.tipo}</span>
                  </td>
                  <td className="px-4 py-3">{scoreBadge(l.score)}</td>
                  <td className="px-4 py-3">
                    <select value={l.estado} onChange={e => handleEstado(l, e.target.value)}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                      {ESTADOS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDeleteLead(l.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recompra + Archivo */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-roden-black mb-1">Candidatos a recompra</h2>
          <p className="text-xs text-gray-400 mb-4">Clientes con obras entregadas, ordenados por antigüedad. Protocolo: 1 contacto /proximo por semana.</p>
          <div className="space-y-2">
            {recompra.length === 0 && <p className="text-sm text-gray-400">Sin clientes con obras completadas.</p>}
            {recompra.map(r => (
              <div key={r.client_id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-roden-black">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    Última obra: {fmtDate(r.ultima_obra)} · {r.obras_completadas} obra{r.obras_completadas !== 1 ? 's' : ''}
                    {r.satisfaccion != null && ` · ★ ${r.satisfaccion}`}
                  </p>
                </div>
                {r.phone && (
                  <a href={`https://wa.me/${r.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-roden-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap">
                    <Phone size={12} /> /proximo
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-roden-black mb-1">Piezas generadas</h2>
          <p className="text-xs text-gray-400 mb-4">Generadas por Claude desde el banco de contenido. Tildá al publicar.</p>
          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
            {piezas.length === 0 && <p className="text-sm text-gray-400">Sin piezas registradas.</p>}
            {piezas.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={p.publicada} onChange={e => handlePiezaPublicada(p, e.target.checked)}
                  className="w-4 h-4 accent-black shrink-0" />
                <div className="min-w-0">
                  <p className={`text-sm truncate ${p.publicada ? 'text-gray-400 line-through' : 'text-roden-black font-medium'}`}>{p.titulo}</p>
                  <p className="text-xs text-gray-400 truncate">{p.tipo} · {p.canal}{p.fecha_publicacion ? ` · publicada ${fmtDate(p.fecha_publicacion)}` : ''}</p>
                </div>
              </label>
            ))}
          </div>
          {assets.length > 0 && (
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
              Material disponible en banco: {assets.length} archivo{assets.length !== 1 ? 's' : ''} registrado{assets.length !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketing;
