/**
 * Configuración → Materiales 3D: biblioteca de materiales del constructor 3D (tabla
 * `material_library`, imágenes en el bucket `material-textures`). Solo dibujo: no toca costos.
 * Cada pieza del 3D toma el material cuyo nombre aparece en su placa, así que el nombre tiene que
 * ser el mismo que el color cargado en el estimador. Escribir: solo administrador (RLS).
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, X, Image as ImageIcon, Palette, Upload } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { LibraryMaterial, MaterialKind, TEXTURE_BUCKET, normalizeName, parseTextureFileName } from '../utils/furniture3d/materialLibrary';

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

/** Color promedio de la imagen (#rrggbb): color base del material mientras carga la textura. */
const averageColor = (file: File): Promise<string> => new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const g = cv.getContext('2d')!;
    g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4, h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    URL.revokeObjectURL(img.src);
    resolve(`#${h(r)}${h(gg)}${h(b)}`);
  };
  img.onerror = () => resolve('#c8b8a0');
  img.src = URL.createObjectURL(file);
});

/** Una fila de "Importar varias": una imagen y su material, a revisar antes de guardar. */
interface BatchRow { file: File; preview: string; name: string; brand: string; line: string; color: string; status?: 'ok' | 'error'; message?: string }

const MaterialLibrary: React.FC = () => {
  const [items, setItems] = useState<LibraryMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchRow[] | null>(null);
  const [batchLine, setBatchLine] = useState('');
  const [batchSize, setBatchSize] = useState<[number, number]>([1000, 1000]);
  const [batchGrainVertical, setBatchGrainVertical] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);

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

  /** Importar varias: arma la tabla con nombre y marca sacados del nombre de cada archivo. */
  const pickBatch = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const rows: BatchRow[] = await Promise.all(Array.from(files).map(async file => {
      const { name, brand } = parseTextureFileName(file.name);
      return { file, preview: URL.createObjectURL(file), name, brand: brand || '', line: '', color: await averageColor(file) };
    }));
    setDraft(null); setError(null); setBatch(rows);
  };
  const closeBatch = () => { batch?.forEach(r => URL.revokeObjectURL(r.preview)); setBatch(null); setProgress(null); };
  const existingFor = (name: string) => items.find(m => normalizeName(m.name) === normalizeName(name));

  /** Guarda todas: sube cada imagen y crea el material (o le reemplaza la imagen si ya existe). */
  const saveBatch = async () => {
    if (!batch) return;
    const names = batch.map(r => normalizeName(r.name));
    if (names.some(n => !n)) { setError('Hay filas sin nombre.'); return; }
    if (new Set(names).size !== names.length) { setError('Hay dos filas con el mismo nombre.'); return; }
    setBusy(true); setError(null);
    const rows = [...batch];
    let done = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.status === 'ok') { done++; continue; }   // reintento: no vuelve a subir las que ya entraron
      setProgress(`Guardando ${i + 1} de ${rows.length}…`);
      try {
        const jpg = await toJpeg(r.file);
        const path = `${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from(TEXTURE_BUCKET).upload(path, jpg, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        const old = existingFor(r.name);
        const row = {
          name: r.name.trim(), brand: r.brand.trim() || null, line: (r.line || batchLine).trim() || null, kind: 'MELAMINA', color: r.color,
          texture_path: path, texture_width_mm: batchSize[0] || 1000, texture_height_mm: batchSize[1] || 1000,
          grain_vertical: batchGrainVertical, gloss: old?.gloss ?? 0.1, updated_at: new Date().toISOString(),
        };
        const res = old ? await supabase.from('material_library').update(row).eq('id', old.id) : await supabase.from('material_library').insert(row);
        if (res.error) { await supabase.storage.from(TEXTURE_BUCKET).remove([path]); throw res.error; }
        if (old?.texture_path) await supabase.storage.from(TEXTURE_BUCKET).remove([old.texture_path]);
        rows[i] = { ...r, status: 'ok', message: old ? 'imagen reemplazada' : 'creado' };
        done++;
      } catch (e: any) {
        rows[i] = { ...r, status: 'error', message: e?.message?.includes('row-level security') ? 'solo un administrador puede cargar materiales' : (e?.message || 'error') };
        failed++;
      }
      setBatch([...rows]);
    }
    setBusy(false);
    setProgress(failed ? `Listo: ${done} guardados, ${failed} con error (corregí y volvé a guardar: las que ya entraron no se repiten).` : `Listo: ${done} materiales guardados.`);
    await load();
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
        {!draft && !batch && (
          <div className="flex gap-2 shrink-0">
            <label className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50" title="Elegí todas las imágenes de una carpeta a la vez (Ctrl + A en el selector)">
              <Upload size={16} /> Importar varias
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { pickBatch(e.target.files); e.target.value = ''; }} />
            </label>
            <button onClick={() => edit(null)} className="bg-black text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"><Plus size={16} /> Agregar</button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

      {batch && (
        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold">Importar {batch.length} imágenes</p>
          <p className="text-[11px] text-gray-500">
            Revisá el nombre de cada una: tiene que ser <b>igual al color del estimador</b>. Si ya existe un material con ese nombre,
            se le reemplaza la imagen. Las medidas y la veta de abajo valen para todas (después se pueden ajustar de a una).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label><span className={label}>Línea (para todas, opcional)</span>
              <input className={field} value={batchLine} onChange={e => setBatchLine(e.target.value)} placeholder="Nature" /></label>
            <label><span className={label}>Cada imagen cubre (mm, ancho × alto)</span>
              <div className="flex gap-1">
                <input type="number" className={field} value={batchSize[0]} onChange={e => setBatchSize([Number(e.target.value), batchSize[1]])} />
                <input type="number" className={field} value={batchSize[1]} onChange={e => setBatchSize([batchSize[0], Number(e.target.value)])} />
              </div></label>
            <label><span className={label}>Veta en las imágenes</span>
              <select className={field} value={batchGrainVertical ? 'v' : 'h'} onChange={e => setBatchGrainVertical(e.target.value === 'v')}>
                <option value="v">Vertical (de arriba abajo)</option>
                <option value="h">Horizontal (de lado a lado)</option>
              </select></label>
          </div>
          <div className="divide-y divide-indigo-100 max-h-[420px] overflow-y-auto">
            {batch.map((r, i) => {
              const set = (patch: Partial<BatchRow>) => setBatch(batch.map((x, k) => (k === i ? { ...x, ...patch, status: x.status === 'ok' ? 'ok' : undefined } : x)));
              const exists = existingFor(r.name);
              return (
                <div key={i} className="flex items-center gap-2 py-2">
                  <div className="w-10 h-10 rounded border border-gray-200 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${r.preview})`, backgroundColor: r.color }} />
                  <input className="flex-1 min-w-0 border border-gray-200 rounded-lg p-2 text-sm" value={r.name} disabled={r.status === 'ok'} onChange={e => set({ name: e.target.value })} title={r.file.name} />
                  <input className="w-28 shrink-0 border border-gray-200 rounded-lg p-2 text-sm" value={r.brand} disabled={r.status === 'ok'} onChange={e => set({ brand: e.target.value })} placeholder="Marca" />
                  <span className={`text-[10px] w-28 shrink-0 ${r.status === 'error' ? 'text-red-700 font-bold' : r.status === 'ok' ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                    {r.status ? r.message : exists ? 'ya existe: reemplaza la imagen' : 'nuevo'}
                  </span>
                  {!busy && r.status !== 'ok' && <button onClick={() => { URL.revokeObjectURL(r.preview); setBatch(batch.filter((_, k) => k !== i)); }} title="Quitar" className="p-1 text-gray-400 hover:text-red-500"><X size={14} /></button>}
                </div>
              );
            })}
          </div>
          {progress && <p className="text-sm font-bold">{progress}</p>}
          <div className="flex justify-end gap-2">
            <button disabled={busy} onClick={closeBatch} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-1.5 disabled:opacity-40"><X size={16} /> Cerrar</button>
            {batch.some(r => r.status !== 'ok') && (
              <button disabled={busy || batch.length === 0} onClick={saveBatch} className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-40"><Save size={16} /> {busy ? 'Guardando…' : 'Guardar todas'}</button>
            )}
          </div>
        </div>
      )}

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
