/**
 * Configuración → Materiales 3D: biblioteca de materiales del constructor 3D (tabla
 * `material_library`, imágenes en el bucket `material-textures`). Solo dibujo: no toca costos.
 * Cada pieza del 3D toma el material cuyo nombre aparece en su placa, así que el nombre tiene que
 * ser el mismo que el color cargado en el estimador. Escribir: solo administrador (RLS).
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Image as ImageIcon, Palette } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { LibraryMaterial, MaterialKind, TEXTURE_BUCKET, normalizeName } from '../utils/furniture3d/materialLibrary';

const KINDS: [MaterialKind, string][] = [['MELAMINA', 'Melamina'], ['LACA', 'Laca'], ['ENCHAPADO', 'Enchapado']];
const GLOSS: [number, string][] = [[0.1, 'Mate'], [0.4, 'Semimate'], [0.85, 'Brillante']];
const MAX_TEXTURE_PX = 2048;

type Draft = Omit<LibraryMaterial, 'id'> & { id?: string };
const emptyDraft = (): Draft => ({
  name: '', brand: '', line: '', kind: 'MELAMINA', color: '#c8b8a0', texture_path: null,
  texture_width_mm: 1000, texture_height_mm: 1000, grain_vertical: true, gloss: 0.1,
});
const publicUrl = (path: string) => supabase.storage.from(TEXTURE_BUCKET).getPublicUrl(path).data.publicUrl;

/** Achica la imagen (lado mayor 2048 px) y la pasa a JPG: liviana para el visor y las maquetas. */
const toJpeg = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, MAX_TEXTURE_PX / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(img.src);
    cv.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen'))), 'image/jpeg', 0.88);
  };
  img.onerror = () => reject(new Error('No se pudo leer la imagen'));
  img.src = URL.createObjectURL(file);
});

const MaterialLibrary: React.FC = () => {
  const [items, setItems] = useState<LibraryMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: e } = await supabase.from('material_library').select('*').order('name');
    if (e) setError(e.message); else setItems((data || []) as LibraryMaterial[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const edit = (m: LibraryMaterial | null) => {
    setDraft(m ? { ...m } : emptyDraft());
    setFile(null); setPreview(null); setError(null);
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError('Falta el nombre (tiene que ser igual al color del estimador).'); return; }
    if (items.some(m => m.id !== draft.id && normalizeName(m.name) === normalizeName(name))) { setError(`Ya hay un material llamado "${name}".`); return; }
    setBusy(true); setError(null);
    try {
      let texture_path = draft.texture_path || null;
      if (file) {
        const jpg = await toJpeg(file);
        const path = `${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from(TEXTURE_BUCKET).upload(path, jpg, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        if (texture_path) await supabase.storage.from(TEXTURE_BUCKET).remove([texture_path]);
        texture_path = path;
      }
      const row = {
        name, brand: draft.brand?.trim() || null, line: draft.line?.trim() || null, kind: draft.kind, color: draft.color,
        texture_path, texture_width_mm: Number(draft.texture_width_mm) || 1000, texture_height_mm: Number(draft.texture_height_mm) || 1000,
        grain_vertical: draft.grain_vertical, gloss: draft.gloss, updated_at: new Date().toISOString(),
      };
      const res = draft.id
        ? await supabase.from('material_library').update(row).eq('id', draft.id)
        : await supabase.from('material_library').insert(row);
      if (res.error) throw res.error;
      setDraft(null); setFile(null); setPreview(null);
      await load();
    } catch (e: any) {
      setError(e?.message?.includes('row-level security') ? 'Solo un administrador puede cargar materiales.' : (e?.message || 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: LibraryMaterial) => {
    setBusy(true); setError(null);
    const res = await supabase.from('material_library').delete().eq('id', m.id);
    if (res.error) setError(res.error.message);
    else if (m.texture_path) await supabase.storage.from(TEXTURE_BUCKET).remove([m.texture_path]);
    setConfirmDelete(null); setBusy(false);
    await load();
  };

  const field = 'w-full border border-gray-200 rounded-lg p-2 text-sm';
  const label = 'text-[11px] font-bold text-gray-500 uppercase';
  const swatch = (m: { texture_path?: string | null; color: string }, url?: string | null) => (
    <div className="w-12 h-12 rounded-lg border border-gray-200 shrink-0 bg-center bg-cover"
      style={{ backgroundColor: m.color, backgroundImage: url ? `url(${url})` : m.texture_path ? `url(${publicUrl(m.texture_path)})` : undefined }} />
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><Palette size={18} /> Materiales 3D</h3>
          <p className="text-xs text-gray-500 mt-1">
            Texturas y colores para el constructor 3D, la imagen JPG y las maquetas. Cada pieza toma el material cuyo
            <b> nombre coincide con el color de su placa en el estimador</b> (ej. "Roble Kendal"). No cambia costos.
          </p>
        </div>
        {!draft && <button onClick={() => edit(null)} className="bg-black text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 shrink-0"><Plus size={16} /> Agregar</button>}
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

      {draft && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-1"><span className={label}>Nombre (igual que en el estimador)</span>
              <input className={field} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Roble Kendal" /></label>
            <label><span className={label}>Marca</span>
              <input className={field} value={draft.brand || ''} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="Faplac / Egger" /></label>
            <label><span className={label}>Línea</span>
              <input className={field} value={draft.line || ''} onChange={e => setDraft({ ...draft, line: e.target.value })} placeholder="Nature" /></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label><span className={label}>Tipo</span>
              <select className={field} value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as MaterialKind })}>
                {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label><span className={label}>Terminación</span>
              <select className={field} value={draft.gloss} onChange={e => setDraft({ ...draft, gloss: Number(e.target.value) })}>
                {GLOSS.map(([g, l]) => <option key={g} value={g}>{l}</option>)}
              </select></label>
            <label><span className={label}>Color base</span>
              <input type="color" className="w-full h-10 border border-gray-200 rounded-lg" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-3">
              {swatch(draft, preview)}
              <span className="flex-1"><span className={label}>Imagen de la textura</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="block text-xs mt-1"
                  onChange={e => { const f = e.target.files?.[0] || null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} /></span>
            </label>
            <label><span className={label}>La imagen cubre (mm, ancho × alto)</span>
              <div className="flex gap-1">
                <input type="number" className={field} value={draft.texture_width_mm} onChange={e => setDraft({ ...draft, texture_width_mm: Number(e.target.value) })} />
                <input type="number" className={field} value={draft.texture_height_mm} onChange={e => setDraft({ ...draft, texture_height_mm: Number(e.target.value) })} />
              </div></label>
            <label><span className={label}>Veta en la imagen</span>
              <select className={field} value={draft.grain_vertical ? 'v' : 'h'} onChange={e => setDraft({ ...draft, grain_vertical: e.target.value === 'v' })}>
                <option value="v">Vertical (de arriba abajo)</option>
                <option value="h">Horizontal (de lado a lado)</option>
              </select></label>
          </div>
          <p className="text-[11px] text-gray-500">
            Sin imagen se usa el color base (sirve para lacas y colores lisos). La medida es lo que representa la imagen en la
            placa real: si la foto muestra un trozo de 30 × 30 cm, poné 300 × 300. La imagen se achica a {MAX_TEXTURE_PX} px y se guarda en JPG.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDraft(null); setError(null); }} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"><X size={16} /> Cancelar</button>
            <button disabled={busy} onClick={save} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"><Save size={16} /> {busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : items.length === 0 ? (
        <p className="text-sm text-gray-400 flex items-center gap-2"><ImageIcon size={16} /> Todavía no hay materiales. Sin biblioteca, el 3D usa colores de referencia.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              {swatch(m)}
              <button onClick={() => edit(m)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold truncate">{m.name}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {[m.brand, m.line, KINDS.find(k => k[0] === m.kind)?.[1], GLOSS.find(g => g[0] === m.gloss)?.[1] ?? `brillo ${m.gloss}`,
                    m.texture_path ? `imagen ${m.texture_width_mm}×${m.texture_height_mm} mm` : 'color liso'].filter(Boolean).join(' · ')}
                </p>
              </button>
              {confirmDelete === m.id ? (
                <span className="flex items-center gap-1 text-xs">
                  <button disabled={busy} onClick={() => remove(m)} className="px-2 py-1 rounded bg-red-600 text-white font-bold">Borrar</button>
                  <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded hover:bg-gray-100">No</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(m.id)} title="Borrar" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialLibrary;
