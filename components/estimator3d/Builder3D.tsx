/**
 * rødën OS — Constructor 3D del estimador.
 *
 * Arma el amoblamiento con los módulos del estimador (los mismos objetos que se cotizan),
 * permite ubicarlos, ajustar medidas y frentes, ver el despiece explotado para el taller y
 * exportar a FBX (3ds Max) u OBJ/MTL.
 *
 * El despiece, herrajes y precios salen del motor del estimador (utils/estimatorEngine):
 * acá no se calcula ninguna medida ni costo propio. Se carga bajo demanda (React.lazy).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Download, Box as BoxIcon, Layers, Maximize2, RotateCw, AlertTriangle, Info, Check, RefreshCw, ChevronDown, ChevronUp, Expand, Shrink, Square, Image as ImageIcon, Smartphone,
} from 'lucide-react';
import Viewer3D from './Viewer3D';
import {
  buildAssembly, buildScene, PENDING_RULES, isManualModule, PlacedModule, RotY, Vec3, SNAP_DISTANCE, ModuleLayout3D, transformBox,
} from '../../utils/furniture3d/geometry';
import { exportFBX, exportOBJ, exportFileBase, safeName } from '../../utils/furniture3d/exporters';
import { exportViewerHtml, exportUsdz } from '../../utils/furniture3d/webExport';
import { LibraryMaterial, TEXTURE_BUCKET, matchMaterial } from '../../utils/furniture3d/materialLibrary';
import { zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import { supabase } from '../../services/supabaseClient';
import { calculateModuleParts, calculateItemQuantities, getBoardLabel, getFrontLayout, ExtendedCabinetModule } from '../../utils/estimatorEngine';
import { getTemplate, getFixedDims } from '../../utils/specialModules';

export interface Furniture3D { id: string; name: string; modules: ExtendedCabinetModule[] }

interface Builder3DProps {
  furnitures: Furniture3D[];          // en modo edición, uno solo
  readOnly?: boolean;
  onApply?: (furnitureId: string, modules: ExtendedCabinetModule[]) => void;
  onClose: () => void;
  priceLabel?: string | null;         // precio del ítem según el estimador (informativo)
  projectName?: string;                // obra (para el rótulo de la imagen JPG)
}

/** Qué se ve (el ítem con todos sus módulos o un módulo solo) y cómo (armado o despiezado). */
type ViewScope = 'item' | 'module';
type ViewPresentation = 'assembled' | 'exploded';

const download = (content: string, fileName: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const fmt = (v: number) => `${Math.round(v * 10) / 10}`;

/** Recalcula las piezas de un módulo especial con sus opciones guardadas (misma plantilla). */
const recalcSpecial = (mod: any): any => {
  const tpl = getTemplate(mod.specialTemplateId);
  if (!tpl || !mod.specialOptions) return mod;
  const fixed = getFixedDims(tpl, mod.specialOptions);
  const params = { width: fixed.width ?? mod.width, height: fixed.height ?? mod.height, depth: fixed.depth ?? mod.depth };
  const r = tpl.calculate(params, mod.specialOptions);
  return { ...mod, ...fixed, specialParts: r.parts, specialHardware: r.hardware, specialLaborDays: r.laborDays };
};

const NumField: React.FC<{ label: string; value: number | undefined; onChange?: (v: number) => void; disabled?: boolean; suffix?: string }> =
  ({ label, value, onChange, disabled, suffix }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-500 uppercase font-bold">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number" disabled={disabled || !onChange}
          className="w-full border border-gray-200 p-1.5 rounded text-xs text-right disabled:bg-gray-50 disabled:text-gray-400"
          value={value ?? 0}
          onChange={e => onChange && onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-[10px] text-gray-400">{suffix}</span>}
      </div>
    </label>
  );

const Builder3D: React.FC<Builder3DProps> = ({ furnitures, readOnly = false, onApply, onClose, priceLabel, projectName }) => {
  const [activeId, setActiveId] = useState(furnitures[0]?.id);
  const [drafts, setDrafts] = useState<Record<string, ExtendedCabinetModule[]>>(
    () => Object.fromEntries(furnitures.map(f => [f.id, JSON.parse(JSON.stringify(f.modules || []))])),
  );
  const [dirty, setDirty] = useState(false);
  const [scope, setScope] = useState<ViewScope>('item');
  const [presentation, setPresentation] = useState<ViewPresentation>('assembled');
  const [factor, setFactor] = useState(0.6);
  const [selModuleKey, setSelModuleKey] = useState<string | null>(null);
  const [selPieceKey, setSelPieceKey] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [showRules, setShowRules] = useState(false);
  // Visor a pantalla completa: pantalla completa del navegador sobre el visor y su barra; donde el
  // navegador no lo permite (iPhone), el visor igual tapa toda la ventana.
  const [maximized, setMaximized] = useState(false);
  // Vista de frente: la pared de apoyo es el plano de la pantalla; los módulos se arrastran directo.
  const [frontView, setFrontView] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const captureRef = useRef<((caption: string) => Promise<Blob | null>) | null>(null);
  const modelRef = useRef<(() => any) | null>(null);
  // Biblioteca de materiales (Configuración → Materiales 3D). Si no carga, se dibuja como antes.
  const [library, setLibrary] = useState<LibraryMaterial[]>([]);
  useEffect(() => {
    let alive = true;
    supabase.from('material_library').select('*').then(({ data, error }) => {
      if (error) { console.warn('[Builder3D] Biblioteca de materiales:', error.message); return; }
      if (alive && data) setLibrary(data as LibraryMaterial[]);
    });
    return () => { alive = false; };
  }, []);
  const textureUrl = (path: string) => supabase.storage.from(TEXTURE_BUCKET).getPublicUrl(path).data.publicUrl;
  const viewerRef = useRef<HTMLElement>(null);
  const toggleMaximized = () => {
    if (maximized) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setMaximized(false);
    } else {
      setMaximized(true);
      viewerRef.current?.requestFullscreen?.().catch(() => {});
    }
    setTimeout(() => setFitToken(t => t + 1), 150);
  };
  useEffect(() => {
    // Esc del navegador (o el cuadro de "Guardar como") sale de pantalla completa: el visor vuelve
    // a su lugar sin mover la cámara.
    const onChange = () => { if (!document.fullscreenElement) setMaximized(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const active = furnitures.find(f => f.id === activeId) || furnitures[0];
  const modules = drafts[active.id] || [];
  const assembly = useMemo(() => buildAssembly(active.name, modules), [active.name, modules]);
  const selectedPlaced: PlacedModule | undefined = assembly.modules.find(m => m.key === selModuleKey);
  // En vista de módulo se muestra el seleccionado; sin selección, el primero.
  const viewPlaced = scope === 'module' ? (selectedPlaced || assembly.modules[0]) : undefined;
  const viewScene = useMemo(
    () => buildScene(assembly, presentation === 'assembled' ? 0 : factor, viewPlaced?.key),
    [assembly, presentation, factor, viewPlaced?.key],
  );
  const showScope = (next: ViewScope) => {
    if (next === 'module' && !selModuleKey && assembly.modules[0]) setSelModuleKey(assembly.modules[0].key);
    setScope(next);
    setFitToken(t => t + 1);
  };
  const issueModuleKeys = useMemo(() => new Set(assembly.issues.filter(i => i.level === 'error').flatMap(i => i.moduleKeys || [])), [assembly]);

  const selModIndex = selectedPlaced ? selectedPlaced.moduleIndex : -1;
  // Lo que se edita: la copia, si está ubicada por separado; si no, el módulo con sus copias.
  const selInst = selectedPlaced?.ownLayout ? selectedPlaced.instance : 0;
  const selMod: any = selModIndex >= 0 ? modules[selModIndex] : null;
  const selPiece = selectedPlaced?.pieces.find(p => p.key === selPieceKey)
    || selectedPlaced?.gridPieces.find(p => p.key === selPieceKey) || null;

  const editable = !readOnly;
  const isStandard = selMod && !selMod.isSpecialModule && !isManualModule(selMod);
  const specialEditable = selMod && selMod.isSpecialModule && !isManualModule(selMod) && !!selMod.specialOptions;
  const tpl = selMod?.specialTemplateId ? getTemplate(selMod.specialTemplateId) : null;
  const fixedDims = tpl ? getFixedDims(tpl, selMod.specialOptions || {}) : {};

  const updateModule = (idx: number, patch: any) => {
    setDrafts(prev => {
      const list = [...prev[active.id]];
      let m = { ...list[idx], ...patch };
      if (m.isSpecialModule && !isManualModule(m) && ('width' in patch || 'height' in patch || 'depth' in patch)) m = recalcSpecial(m);
      list[idx] = m;
      return { ...prev, [active.id]: list };
    });
    setDirty(true);
  };
  /**
   * Cambia la ubicación del módulo (inst 0: el módulo y sus copias en fila) o de una copia
   * ubicada por separado (inst > 0, en layout3dCopies).
   */
  const updateLayout = (idx: number, patch: Partial<ModuleLayout3D>, inst = 0) => {
    const base = assembly.modules.find(m => m.moduleIndex === idx && m.instance === 0);
    const copy = assembly.modules.find(m => m.moduleIndex === idx && m.instance === inst);
    setDrafts(prev => ({
      ...prev,
      [active.id]: freezeOthers(prev[active.id], idx).map((m: any, i) => {
        if (i !== idx) return m;
        const layout3d = m.layout3d || (base ? { ...base.layout } : { x: 0, y: 0, z: 0, rotY: 0 });
        if (inst === 0) return { ...m, layout3d: { ...layout3d, ...patch } };
        return { ...m, layout3d, layout3dCopies: { ...(m.layout3dCopies || {}), [inst]: { ...(copy ? copy.layout : layout3d), ...patch } } };
      }),
    }));
    setDirty(true);
  };
  /**
   * Al ubicar un módulo a mano, los demás quedan fijos donde se ven: si no, los módulos sin
   * posición guardada se re-acomodarían en fila detrás del que se movió.
   */
  const freezeOthers = (list: ExtendedCabinetModule[], idx: number) => list.map((m: any, i) => {
    if (i === idx || m.layout3d || isManualModule(m)) return m;
    const p = assembly.modules.find(x => x.moduleIndex === i && x.instance === 0);
    return p ? { ...m, layout3d: { ...p.layout } } : m;
  });
  /** Copias (Cant.) ubicadas por separado: cada una se mueve y gira sola, desde donde está ahora. */
  const separateCopies = (idx: number) => {
    const copies = assembly.modules.filter(m => m.moduleIndex === idx && m.instance > 0);
    const base = assembly.modules.find(m => m.moduleIndex === idx && m.instance === 0);
    setDrafts(prev => ({
      ...prev,
      [active.id]: freezeOthers(prev[active.id], idx).map((m: any, i) => i !== idx ? m : {
        ...m, layout3d: m.layout3d || (base ? { ...base.layout } : undefined),
        layout3dCopies: Object.fromEntries(copies.map(c => [c.instance, { ...c.layout }])),
      }),
    }));
    setDirty(true);
  };
  const joinCopies = (idx: number) => {
    setDrafts(prev => ({ ...prev, [active.id]: prev[active.id].map((m: any, i) => { if (i !== idx) return m; const { layout3dCopies, ...rest } = m; return rest; }) }));
    setDirty(true);
  };
  /** Material de la biblioteca para estructura / frentes (solo dibujo). idx null = todos los módulos. */
  const setMaterial3d = (idx: number | null, material3d: { structure?: string; fronts?: string }) => {
    const value = material3d.structure || material3d.fronts ? material3d : undefined;
    setDrafts(prev => ({ ...prev, [active.id]: prev[active.id].map((m: any, i) => (idx === null || i === idx) ? { ...m, material3d: value } : m) }));
    setDirty(true);
  };
  const libraryOptions = useMemo(() => [...library].sort((a, b) => a.name.localeCompare(b.name, 'es')), [library]);
  /**
   * Giro en su lugar: la caja girada arranca en la misma esquina (mínimo X/Y/Z) que antes, así no
   * se mete en el vecino ni baja del piso.
   */
  const rotateInPlace = (idx: number, inst: number, patch: Partial<ModuleLayout3D>) => {
    const pm = assembly.modules.find(m => m.moduleIndex === idx && m.instance === inst);
    if (!pm) return;
    const b = transformBox(pm.localBox, { ...pm.layout, ...patch, x: 0, y: 0, z: 0 });
    const r = (v: number) => Math.round(v * 10) / 10;
    updateLayout(idx, { ...patch, x: r(pm.worldBox.min[0] - b.min[0]), y: r(pm.worldBox.min[1] - b.min[1]), z: r(pm.worldBox.min[2] - b.min[2]) }, inst);
  };
  /** Arrastre en el visor: mueve el módulo (o la copia separada) el desplazamiento ya ajustado por el imán. */
  const moveModule = (idx: number, inst: number, delta: Vec3) => {
    const pm = assembly.modules.find(m => m.moduleIndex === idx && m.instance === inst);
    if (!pm) return;
    const r = (v: number) => Math.round(v * 10) / 10;
    updateLayout(idx, { x: r(pm.layout.x + delta[0]), y: r(pm.layout.y + delta[1]), z: r(pm.layout.z + delta[2]) }, inst);
  };
  // Las flechas de mover solo en el ítem completo armado (en despiece las posiciones no son las reales).
  const moveEnabled = editable && scope === 'item' && presentation === 'assembled';

  const resetLayouts = () => {
    setDrafts(prev => ({ ...prev, [active.id]: prev[active.id].map(m => { const { layout3d, layout3dCopies, ...rest } = m as any; return rest; }) }));
    setDirty(true);
    setFitToken(t => t + 1);
  };
  /** Ubica el módulo seleccionado pegado a la derecha del módulo anterior. */
  const snapRight = (idx: number) => {
    const prev = assembly.modules.filter(m => m.moduleIndex < idx).pop();
    if (!prev) { updateLayout(idx, { x: 0, y: 0, z: 0 }); return; }
    updateLayout(idx, { x: prev.worldBox.max[0], y: prev.layout.y, z: prev.layout.z, rotY: 0 });
  };

  const doExport = (kind: 'fbx' | 'fbx-exploded' | 'obj') => {
    const exploded = kind === 'fbx-exploded';
    const scene = buildScene(assembly, exploded ? Math.max(factor, 0.4) : 0);
    const base = exportFileBase(active.name, exploded);
    if (kind === 'obj') {
      const { obj, mtl } = exportOBJ(scene, `${base}.mtl`);
      download(obj, `${base}.obj`, 'text/plain');
      download(mtl, `${base}.mtl`, 'text/plain');
    } else {
      // Con materiales de la biblioteca: colores y brillo en el FBX; si alguno tiene imagen, ZIP
      // con el .fbx y las imágenes en la misma carpeta (3ds Max las busca al lado del archivo).
      const files = new Map<string, LibraryMaterial>();   // nombre de archivo → material
      const used = new Set<string>();
      const fileFor = (m: LibraryMaterial) => {
        for (const [f, mm] of files) if (mm.id === m.id) return f;
        let f = `${safeName(m.name)}.jpg`, i = 2;
        while (used.has(f)) f = `${safeName(m.name)}_${i++}.jpg`;
        used.add(f); files.set(f, m);
        return f;
      };
      const hex = (h: string): [number, number, number] => {
        const c = parseInt((h || '#cccccc').replace('#', ''), 16);
        return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
      };
      const fbx = exportFBX(scene, {
        materials: label => {
          const m = matchMaterial(label, library);
          if (!m) return null;
          return {
            color: hex(m.color), gloss: m.gloss,
            texture: m.texture_path ? { fileName: fileFor(m), widthMm: m.texture_width_mm, heightMm: m.texture_height_mm, grainVertical: m.grain_vertical } : undefined,
          };
        },
      });
      if (files.size === 0) { download(fbx, `${base}.fbx`, 'application/octet-stream'); return; }
      const zip = (async () => {
        const entries: Record<string, Uint8Array> = { [`${base}.fbx`]: strToU8(fbx) };
        await Promise.all([...files].map(async ([f, m]) => {
          const r = await fetch(textureUrl(m.texture_path!));
          if (!r.ok) throw new Error(`No se pudo bajar la imagen de "${m.name}" (${r.status}).`);
          entries[f] = new Uint8Array(await r.arrayBuffer());
        }));
        return new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' });
      })().catch(e => { setExportError(e.message); return null; });
      saveFile(zip, `${base}.zip`, 'FBX con texturas (ZIP)', 'application/zip', ['.zip']);
    }
  };

  /**
   * Guarda un archivo: en Chrome y Edge, cuadro de "Guardar como" (carpeta y nombre); en Firefox y
   * Safari, descarga con el nombre sugerido. `content` ya tiene que estar en marcha antes de abrir
   * el cuadro (que puede sacar al navegador de pantalla completa y cambiar el visor).
   */
  const saveFile = async (content: Promise<Blob | null>, fileName: string, description: string, mime: string, exts: string[]) => {
    const picker = (window as any).showSaveFilePicker;
    let handle: any = null;
    if (picker) {
      try {
        handle = await picker({ suggestedName: fileName, types: [{ description, accept: { [mime]: exts } }] });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;   // canceló el cuadro
        handle = null;
      }
    }
    const blob = await content;
    if (!blob) return;
    if (handle) {
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /** Imagen JPG de lo que se ve en el visor, como una captura, tomada en el clic. */
  const saveImage = () => {
    const caption = [projectName && `Obra: ${projectName}`, `Mueble: ${active.name}`].filter(Boolean).join('   ·   ');
    const shot = captureRef.current?.(caption);
    if (!shot) return;
    saveFile(shot, `${exportFileBase(active.name, presentation === 'exploded')}.jpg`, 'Imagen JPG', 'image/jpeg', ['.jpg', '.jpeg']);
  };

  /**
   * Maqueta para ver y girar en el celular, la tablet o la PC: HTML (cualquier navegador, sin
   * internet) o USDZ (iPhone/iPad, con realidad aumentada a tamaño real). Copia de lo que se ve.
   */
  const saveWebModel = (kind: 'html' | 'usdz') => {
    const model = modelRef.current?.();
    if (!model) return;
    const base = exportFileBase(active.name, presentation === 'exploded');
    const s = viewPlaced ? viewPlaced.localBox : assembly.bbox;
    const dims = `${Math.round(s.max[0] - s.min[0])} × ${Math.round(s.max[1] - s.min[1])} × ${Math.round(s.max[2] - s.min[2])} mm`;
    const caption = [projectName && `Obra: ${projectName}`, `Mueble: ${active.name}`, dims].filter(Boolean).join('  ·  ');
    if (kind === 'html') {
      const html = exportViewerHtml(model, { title: `${active.name} — rødën`, caption }).then(t => new Blob([t], { type: 'text/html' }));
      saveFile(html, `${base}.html`, 'Maqueta 3D (página web)', 'text/html', ['.html']);
    } else {
      const usdz = exportUsdz(model).then(b => new Blob([b], { type: 'model/vnd.usdz+zip' }));
      saveFile(usdz, `${base}.usdz`, 'Maqueta 3D (iPhone/iPad)', 'model/vnd.usdz+zip', ['.usdz']);
    }
  };

  const errors = assembly.issues.filter(i => i.level === 'error');
  const warnings = assembly.issues.filter(i => i.level !== 'error');

  // Despiece del módulo seleccionado: misma fuente que planilla de cortes y costos
  const selParts = selMod && !isManualModule(selMod) ? calculateModuleParts(selMod) : [];
  const selHardware = selMod && !isManualModule(selMod) ? Object.entries(calculateItemQuantities([{ ...selMod, quantity: 1 }]).detailedHardware) : [];

  return (
    <div className="fixed inset-0 z-[300] bg-white flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <BoxIcon size={20} className="text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-tight truncate">Constructor 3D — {active.name}</h3>
              <p className="text-xs text-gray-500">
                {assembly.modules.length} módulo(s) · {Math.round(assembly.size.w)} × {Math.round(assembly.size.h)} × {Math.round(assembly.size.d)} mm
                {priceLabel ? <> · <span className="font-bold text-gray-700">{priceLabel}</span></> : null}
                {readOnly && <span className="ml-2 text-amber-700 font-bold">Solo lectura</span>}
              </p>
            </div>
            {furnitures.length > 1 && (
              <select className="border border-gray-200 rounded-lg text-sm p-1.5 ml-2" value={active.id} onChange={e => { setActiveId(e.target.value); setSelModuleKey(null); setSelPieceKey(null); setFitToken(t => t + 1); }}>
                {furnitures.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editable && onApply && (
              <button
                disabled={!dirty || errors.length > 0}
                title={errors.length ? 'Corregí los errores antes de aplicar' : ''}
                onClick={() => { onApply(active.id, modules); setDirty(false); }}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-40">
                <Check size={16} /> Aplicar al estimador
              </button>
            )}
            <button onClick={() => { if (!dirty || confirm('Hay cambios sin aplicar. ¿Cerrar igual?')) onClose(); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Panel izquierdo: módulos y edición */}
          <aside className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Módulos</h4>
                {editable && <button onClick={resetLayouts} className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1"><RefreshCw size={11} /> Alinear en fila</button>}
              </div>
              <div className="space-y-1">
                {assembly.modules.filter(m => m.instance === 0 || m.ownLayout).map(m => (
                  <button key={m.key}
                    onClick={() => { setSelModuleKey(m.key); setSelPieceKey(null); if (scope === 'module') setFitToken(t => t + 1); }}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${selModuleKey === m.key ? 'bg-indigo-50 border-indigo-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold truncate">{(modules[m.moduleIndex] as any)?.layout3dCopies ? m.name : (modules[m.moduleIndex]?.name || m.name)}</span>
                      <span className="font-mono text-gray-500 shrink-0">{fmt(m.dims.w)}×{fmt(m.dims.h)}×{fmt(m.dims.d)}</span>
                    </div>
                    <div className="flex gap-2 mt-0.5 text-[10px]">
                      {!(modules[m.moduleIndex] as any)?.layout3dCopies && (modules[m.moduleIndex]?.quantity || 1) > 1 && <span className="text-gray-500">×{modules[m.moduleIndex]?.quantity}</span>}
                      {m.ownLayout && <span className="text-gray-500">copia separada</span>}
                      {m.status === 'approximate' && <span className="text-amber-600">aproximado</span>}
                      {m.status === 'unplaced' && <span className="text-blue-600">sin ubicación de piezas</span>}
                      {issueModuleKeys.has(m.key) && <span className="text-red-600 font-bold">con error</span>}
                    </div>
                  </button>
                ))}
                {modules.some(m => isManualModule(m)) && (
                  <p className="text-[10px] text-gray-400 italic px-1">Los módulos manuales (solo costo) no tienen geometría.</p>
                )}
              </div>
            </div>

            {selMod && selectedPlaced && (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{selMod.name || 'Módulo'}</h4>

                <div className="grid grid-cols-3 gap-2">
                  {(['width', 'height', 'depth'] as const).map((k, i) => (
                    <NumField key={k} label={['Ancho', 'Alto', 'Prof.'][i]} value={selMod[k]}
                      disabled={!editable || (!isStandard && !specialEditable) || (fixedDims as any)[k] !== undefined}
                      onChange={v => updateModule(selModIndex, { [k]: v })} />
                  ))}
                </div>
                {selMod.isSpecialModule && !specialEditable && !isManualModule(selMod) && (
                  <p className="text-[10px] text-amber-700">Medidas fijas: este módulo especial se creó sin guardar sus opciones; para cambiarlo, volvé a cargarlo en el estimador.</p>
                )}

                {isStandard && (
                  <div className="grid grid-cols-3 gap-2">
                    <NumField label="Puertas" value={selMod.cntDoors} disabled={!editable} onChange={v => updateModule(selModIndex, { cntDoors: Math.max(0, Math.round(v)) })} />
                    <NumField label="Abatib." value={selMod.cntFlaps} disabled={!editable} onChange={v => updateModule(selModIndex, { cntFlaps: Math.max(0, Math.round(v)) })} />
                    <NumField label="Cajones" value={selMod.cntDrawers} disabled={!editable} onChange={v => updateModule(selModIndex, { cntDrawers: Math.max(0, Math.round(v)) })} />
                  </div>
                )}
                {isStandard && ((selMod.cntDrawers > 0 ? 1 : 0) + (selMod.cntFlaps > 0 ? 1 : 0) + (selMod.cntDoors > 0 ? 1 : 0)) > 1 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selMod.cntDrawers > 0 && <NumField label="Alto cajón" value={selMod.drawerFrontHeight || Math.round(getFrontLayout(selMod).drawerH)} disabled={!editable} onChange={v => updateModule(selModIndex, { drawerFrontHeight: v || undefined })} suffix="mm" />}
                    {selMod.cntFlaps > 0 && <NumField label="Alto abatib." value={selMod.flapFrontHeight || Math.round(getFrontLayout(selMod).flapH)} disabled={!editable} onChange={v => updateModule(selModIndex, { flapFrontHeight: v || undefined })} suffix="mm" />}
                  </div>
                )}
                {((isStandard && selMod.cntDoors === 1) || selMod.specialTemplateId === 'PUERTA_18MM') && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Apertura (bisagra)</span>
                    <select disabled={!editable} className="border border-gray-200 p-1.5 rounded text-xs" value={selMod.doorHingeSide || ''} onChange={e => updateModule(selModIndex, { doorHingeSide: e.target.value || undefined })}>
                      <option value="">Automático (lado del eje del mueble)</option>
                      <option value="LEFT">Izquierda</option>
                      <option value="RIGHT">Derecha</option>
                    </select>
                  </label>
                )}

                {!isManualModule(selMod) && (
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Material 3D (solo dibujo)</span>
                    {libraryOptions.length === 0 ? (
                      <p className="text-[10px] text-gray-400 mt-1">La biblioteca está vacía: cargá materiales en Configuración → Materiales 3D.</p>
                    ) : (<>
                      {([['structure', 'Estructura', 'Según la placa'], ['fronts', 'Frentes', 'Igual a estructura']] as const).map(([k, label, none]) => (
                        <label key={k} className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
                          <select disabled={!editable} className="flex-1 min-w-0 border border-gray-200 p-1.5 rounded text-xs"
                            value={selMod.material3d?.[k] || ''}
                            onChange={e => setMaterial3d(selModIndex, { ...selMod.material3d, [k]: e.target.value || undefined })}>
                            <option value="">{none}</option>
                            {libraryOptions.map(m => <option key={m.id} value={m.name}>{m.name}{m.brand ? ` (${m.brand})` : ''}</option>)}
                          </select>
                        </label>
                      ))}
                      {editable && modules.length > 1 && (
                        <button onClick={() => setMaterial3d(null, { ...selMod.material3d })} className="mt-2 text-[11px] text-indigo-600 hover:underline block">Aplicar estos materiales a todo el mueble</button>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">No cambia el despiece ni el costo. Cajones de 15 mm y fondos blancos quedan como están.</p>
                    </>)}
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Posición en el mueble (mm)</span>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['x', 'y', 'z'] as const).map(k => (
                      <NumField key={k} label={k.toUpperCase()} value={Math.round(selectedPlaced.layout[k] * 10) / 10} disabled={!editable}
                        onChange={v => updateLayout(selModIndex, { [k]: v }, selInst)} />
                    ))}
                  </div>
                  {([['rotY', 'Girar en planta (Y)'], ['rotX', 'Volcar al frente (X)'], ['rotZ', 'Volcar de costado (Z)']] as const).map(([axis, label]) => (
                    <div key={axis} className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] text-gray-500 w-28 shrink-0">{label}</span>
                      {([0, 90, 180, 270] as RotY[]).map(r => (
                        <button key={r} disabled={!editable} onClick={() => rotateInPlace(selModIndex, selInst, { [axis]: r })}
                          className={`px-2 py-1 rounded text-[11px] border ${(selectedPlaced.layout[axis] || 0) === r ? 'bg-black text-white border-black' : 'bg-white border-gray-200'} disabled:opacity-50`}>
                          {r}°
                        </button>
                      ))}
                    </div>
                  ))}
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><RotateCw size={11} /> Gira en su lugar; después ubicalo arrastrando o con X/Y/Z.</p>
                  {editable && (selMod.quantity || 1) > 1 && (
                    selMod.layout3dCopies && Object.keys(selMod.layout3dCopies).length > 0 ? (
                      <button onClick={() => joinCopies(selModIndex)} className="mt-2 text-[11px] text-indigo-600 hover:underline block">Volver a poner las copias en fila</button>
                    ) : (
                      <button onClick={() => separateCopies(selModIndex)} className="mt-2 text-[11px] text-indigo-600 hover:underline block">Ubicar las {selMod.quantity} copias por separado</button>
                    )
                  )}
                  {editable && (
                    <button onClick={() => snapRight(selModIndex)} className="mt-2 text-[11px] text-indigo-600 hover:underline">Pegar a la derecha del módulo anterior</button>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">X: izquierda → derecha · Y: altura desde el piso · Z: hacia el frente. Las copias (Cant.) van una al lado de la otra salvo que se ubiquen por separado (cada una se mueve y gira sola; el despiece y el costo no cambian).</p>
                </div>

                {selectedPlaced.notes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-800 space-y-0.5">
                    {selectedPlaced.notes.map((n, i) => <p key={i}>• {n}</p>)}
                  </div>
                )}
              </div>
            )}

            {/* Validaciones */}
            <div className="border-t border-gray-100 pt-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Validación</h4>
              {assembly.issues.length === 0 && <p className="text-[11px] text-emerald-700 flex items-center gap-1"><Check size={12} /> Sin solapamientos ni medidas inválidas.</p>}
              <div className="space-y-1">
                {errors.map((i, k) => <p key={`e${k}`} className="text-[11px] text-red-700 flex gap-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" />{i.message}</p>)}
                {warnings.map((i, k) => <p key={`w${k}`} className={`text-[11px] flex gap-1 ${i.level === 'warning' ? 'text-amber-700' : 'text-gray-500'}`}><Info size={12} className="shrink-0 mt-0.5" />{i.message}</p>)}
              </div>
              <button onClick={() => setShowRules(v => !v)} className="mt-2 text-[11px] text-gray-500 hover:text-gray-800 flex items-center gap-1">
                {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Supuestos de dibujo pendientes de validar
              </button>
              {showRules && <ul className="mt-1 space-y-0.5">{PENDING_RULES.map((r, i) => <li key={i} className="text-[10px] text-gray-500">• {r}</li>)}</ul>}
            </div>
          </aside>

          {/* Centro: visor */}
          <main ref={viewerRef} className={maximized ? 'fixed inset-0 z-[310] bg-white flex flex-col' : 'flex-1 flex flex-col min-w-0'}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200">
              <div className="flex rounded-lg border border-gray-200 p-0.5">
                {([['item', 'Ítem completo'], ['module', 'Módulo']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => showScope(k)}
                    disabled={k === 'module' && assembly.modules.length === 0}
                    className={`px-3 py-1 rounded-md text-xs font-bold disabled:opacity-40 ${scope === k ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-gray-200 p-0.5">
                {([['assembled', 'Ensamblado', BoxIcon], ['exploded', 'Despiece', Layers]] as const).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => { setPresentation(k); setFitToken(t => t + 1); }}
                    className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 ${presentation === k ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
              {viewPlaced && <span className="text-xs text-gray-600 font-bold truncate max-w-[220px]">{modules[viewPlaced.moduleIndex]?.name || viewPlaced.name}</span>}
              {presentation === 'exploded' && (
                <label className="flex items-center gap-2 text-xs text-gray-600 ml-2">
                  Separación
                  <input type="range" min={0.1} max={1.5} step={0.05} value={factor} onChange={e => setFactor(Number(e.target.value))} />
                </label>
              )}
              <button onClick={() => setFitToken(t => t + 1)} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"><Maximize2 size={14} /> Encuadrar</button>
              <button onClick={() => setFrontView(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${frontView ? 'bg-black text-white border-black' : 'text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                <Square size={14} /> Vista de frente (pared)
              </button>
              <button onClick={toggleMaximized} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-100 flex items-center gap-1.5">
                {maximized ? <><Shrink size={14} /> Salir de pantalla completa</> : <><Expand size={14} /> Pantalla completa</>}
              </button>
              {moveEnabled && (
                <span className="text-[10px] text-gray-500">
                  {frontView ? `Arrastrá un módulo: a los costados o arriba/abajo (imán a ${SNAP_DISTANCE} mm)`
                    : selModuleKey ? `Mover: arrastrá las flechas (imán a ${SNAP_DISTANCE} mm)` : 'Clic en un módulo para moverlo'}
                </span>
              )}
              <div className="flex-1" />
              <span className="text-[10px] text-gray-400 hidden xl:inline">3ds Max: File → Import → .fbx (unidades del archivo: mm)</span>
              <button onClick={saveImage} title="Imagen de lo que se ve en el visor, para la documentación técnica" className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><ImageIcon size={14} /> Imagen JPG</button>
              <button onClick={() => saveWebModel('html')} title="Un archivo que se abre en cualquier navegador (celular, tablet o PC) para girar la maqueta con el dedo o el mouse. Funciona sin internet." className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><Smartphone size={14} /> Maqueta web (.html)</button>
              <button onClick={() => saveWebModel('usdz')} title="Formato de Apple: en iPhone/iPad se abre solo, se gira y se ve en el ambiente con realidad aumentada, a tamaño real." className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><Smartphone size={14} /> iPhone/iPad (.usdz)</button>
              {exportError && <span className="text-[11px] text-red-700 font-bold" onClick={() => setExportError(null)} title="Clic para ocultar">{exportError}</span>}
              <button onClick={() => { setExportError(null); doExport('fbx'); }} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><Download size={14} /> FBX ensamblado</button>
              <button onClick={() => { setExportError(null); doExport('fbx-exploded'); }} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-300 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5"><Download size={14} /> FBX despiece</button>
              <button onClick={() => doExport('obj')} className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><Download size={14} /> OBJ + MTL</button>
            </div>
            <div className="flex-1 min-h-0">
              {assembly.modules.length > 0 ? (
                <Viewer3D
                  scene={viewScene} bbox={viewPlaced ? viewPlaced.localBox : assembly.bbox}
                  selectedPieceKey={selPieceKey} selectedModuleKey={selModuleKey}
                  issueModuleKeys={issueModuleKeys} fitToken={fitToken}
                  moveEnabled={moveEnabled} frontView={frontView} onMoveModule={moveModule} captureRef={captureRef} modelRef={modelRef}
                  library={library} textureUrl={textureUrl}
                  onPick={({ pieceKey, moduleKey }) => { setSelPieceKey(pieceKey); if (moduleKey) setSelModuleKey(moduleKey); }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">Este mueble no tiene módulos con geometría.</div>
              )}
            </div>
          </main>

          {/* Panel derecho: pieza seleccionada y despiece del módulo */}
          <aside className="w-80 shrink-0 border-l border-gray-200 overflow-y-auto p-4 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Pieza seleccionada</h4>
              {selPiece ? (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-bold text-sm text-indigo-900">{selPiece.name}</p>
                  {selPiece.role === 'hardware' ? (
                    <p><span className="text-gray-500">Herraje:</span> <span className="font-mono">Ø {fmt(selPiece.partSize.width)} × {fmt(selPiece.partSize.height)} mm</span> (no va al despiece)</p>
                  ) : selPiece.role === 'obra' ? (
                    <p><span className="text-gray-500">Obra:</span> <span className="font-mono">{fmt(selPiece.partSize.width)} × {fmt(selPiece.partSize.height)} × {selPiece.thickness} mm</span> (no se cobra)</p>
                  ) : (<>
                  <p><span className="text-gray-500">Placa:</span> {selPiece.boardLabel}</p>
                  <p><span className="text-gray-500">Medidas:</span> <span className="font-mono">{fmt(selPiece.partSize.width)} × {fmt(selPiece.partSize.height)} × {selPiece.thickness} mm</span></p>
                  <p><span className="text-gray-500">Veta:</span> {selPiece.grain === 'horizontal' ? 'horizontal (a lo ancho)' : selPiece.grain === 'vertical' ? 'vertical (a lo alto)' : 'libre'}</p>
                  </>)}
                  {selPiece.hingeSide && <p><span className="text-gray-500">Bisagra:</span> {selPiece.hingeSide === 'left' ? 'izquierda' : 'derecha'}</p>}
                  {selPiece.groove && <p className="text-gray-500">Va en ranura.</p>}
                  <p className="text-gray-500">Módulo: {selectedPlaced?.name}</p>
                </div>
              ) : <p className="text-[11px] text-gray-400">Hacé clic en una pieza del modelo.</p>}
            </div>

            {selMod && !isManualModule(selMod) && (
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Despiece del módulo (1 unidad)</h4>
                <table className="w-full text-[10px]">
                  <thead><tr className="text-gray-400 border-b border-gray-200"><th className="text-left py-1">Pieza</th><th>Cant.</th><th className="text-right">Medidas</th></tr></thead>
                  <tbody>
                    {selParts.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 align-top">
                        <td className="py-1 pr-1">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          <span className="block text-gray-400">{getBoardLabel(selMod, p)}</span>
                        </td>
                        <td className="text-center">{p.quantity || 1}</td>
                        <td className="text-right font-mono whitespace-nowrap">{fmt(p.width)}×{fmt(p.height)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selHardware.length > 0 && (
                  <>
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase mt-3 mb-1">Herrajes</h5>
                    {selHardware.map(([name, q]) => <p key={name} className="text-[10px] flex justify-between"><span>{name}</span><span className="font-mono">{q as number}</span></p>)}
                  </>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Mismo cálculo que la planilla de cortes y de costos del estimador.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Builder3D;
