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
import React, { useMemo, useRef, useState } from 'react';
import {
  X, Download, Box as BoxIcon, Layers, Maximize2, RotateCw, AlertTriangle, Info, Check, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import Viewer3D from './Viewer3D';
import {
  buildAssembly, buildScene, PENDING_RULES, isManualModule, PlacedModule, RotY, Assembly, planReorder, ReorderPlan,
} from '../../utils/furniture3d/geometry';
import { exportFBX, exportOBJ, exportFileBase } from '../../utils/furniture3d/exporters';
import { calculateModuleParts, calculateItemQuantities, getBoardLabel, getFrontLayout, ExtendedCabinetModule } from '../../utils/estimatorEngine';
import { getTemplate, getFixedDims } from '../../utils/specialModules';

export interface Furniture3D { id: string; name: string; modules: ExtendedCabinetModule[] }

interface Builder3DProps {
  furnitures: Furniture3D[];          // en modo edición, uno solo
  readOnly?: boolean;
  onApply?: (furnitureId: string, modules: ExtendedCabinetModule[]) => void;
  onClose: () => void;
  priceLabel?: string | null;         // precio del ítem según el estimador (informativo)
}

type ViewMode = 'assembled' | 'exploded' | 'module';

const download = (content: string, fileName: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const fmt = (v: number) => `${Math.round(v * 10) / 10}`;

/** Fija la posición (layout3d) de todos los módulos: la del plan si se mueven, la actual si no. */
const withLayouts = (modules: any[], assembly: Assembly, plan: ReorderPlan): any[] =>
  modules.map((m, i) => {
    if (isManualModule(m)) return m;
    const l = plan.layouts.get(i) || assembly.modules.find(x => x.moduleIndex === i && x.instance === 0)?.layout;
    return l ? { ...m, layout3d: { x: l.x, y: l.y, z: l.z, rotY: l.rotY } } : m;
  });

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

const Builder3D: React.FC<Builder3DProps> = ({ furnitures, readOnly = false, onApply, onClose, priceLabel }) => {
  const [activeId, setActiveId] = useState(furnitures[0]?.id);
  const [drafts, setDrafts] = useState<Record<string, ExtendedCabinetModule[]>>(
    () => Object.fromEntries(furnitures.map(f => [f.id, JSON.parse(JSON.stringify(f.modules || []))])),
  );
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<ViewMode>('assembled');
  const [factor, setFactor] = useState(0.6);
  const [selModuleKey, setSelModuleKey] = useState<string | null>(null);
  const [selPieceKey, setSelPieceKey] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [showRules, setShowRules] = useState(false);

  const active = furnitures.find(f => f.id === activeId) || furnitures[0];
  const baseModules = drafts[active.id] || [];
  const baseAssembly = useMemo(() => buildAssembly(active.name, baseModules), [active.name, baseModules]);
  // Arrastre en curso: los demás módulos se corren en vivo; se guarda al soltar.
  const [dragPlan, setDragPlan] = useState<ReorderPlan | null>(null);
  const dragRef = useRef<{ idx: number; offsetX: number; spanW: number } | null>(null);
  const previewModules = useMemo(
    () => (dragPlan?.changed ? withLayouts(baseModules, baseAssembly, dragPlan) : null),
    [dragPlan, baseModules, baseAssembly],
  );
  const modules = previewModules || baseModules;
  const assembly = useMemo(() => (previewModules ? buildAssembly(active.name, previewModules) : baseAssembly), [active.name, previewModules, baseAssembly]);
  const selectedPlaced: PlacedModule | undefined = assembly.modules.find(m => m.key === selModuleKey);
  const viewScene = useMemo(
    () => buildScene(assembly, mode === 'assembled' ? 0 : factor, mode === 'module' ? (selModuleKey || assembly.modules[0]?.key) : undefined),
    [assembly, mode, factor, selModuleKey],
  );
  const issueModuleKeys = useMemo(() => new Set(assembly.issues.filter(i => i.level === 'error').flatMap(i => i.moduleKeys || [])), [assembly]);

  const selModIndex = selectedPlaced ? selectedPlaced.moduleIndex : -1;
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
  const updateLayout = (idx: number, patch: Partial<{ x: number; y: number; z: number; rotY: RotY }>) => {
    const pm = assembly.modules.find(m => m.moduleIndex === idx && m.instance === 0);
    const cur = (modules[idx] as any).layout3d || (pm ? { x: pm.layout.x, y: pm.layout.y, z: pm.layout.z, rotY: pm.layout.rotY } : { x: 0, y: 0, z: 0, rotY: 0 });
    // Al ubicar un módulo a mano, los demás quedan fijos donde se ven: si no, los módulos sin
    // posición guardada se re-acomodarían en fila detrás del que se movió.
    setDrafts(prev => ({
      ...prev,
      [active.id]: prev[active.id].map((m: any, i) => {
        if (i === idx) return { ...m, layout3d: { ...cur, ...patch } };
        if (m.layout3d || isManualModule(m)) return m;
        const p = assembly.modules.find(x => x.moduleIndex === i && x.instance === 0);
        return p ? { ...m, layout3d: { x: p.layout.x, y: p.layout.y, z: p.layout.z, rotY: p.layout.rotY } } : m;
      }),
    }));
    setDirty(true);
  };
  const resetLayouts = () => {
    setDrafts(prev => ({ ...prev, [active.id]: prev[active.id].map(m => { const { layout3d, ...rest } = m as any; return rest; }) }));
    setDirty(true);
    setFitToken(t => t + 1);
  };
  /** Ubica el módulo seleccionado pegado a la derecha del módulo anterior. */
  const snapRight = (idx: number) => {
    const prev = assembly.modules.filter(m => m.moduleIndex < idx).pop();
    if (!prev) { updateLayout(idx, { x: 0, y: 0, z: 0 }); return; }
    updateLayout(idx, { x: prev.worldBox.max[0], y: prev.layout.y, z: prev.layout.z, rotY: 0 });
  };

  const onDrag = (e: { phase: 'start' | 'move' | 'end'; moduleKey: string; point: { x: number; y: number } }) => {
    if (e.phase === 'start') {
      const pm = baseAssembly.modules.find(m => m.key === e.moduleKey);
      if (!pm) return;
      const mine = baseAssembly.modules.filter(m => m.moduleIndex === pm.moduleIndex);
      const first = mine.find(m => m.instance === 0)!;
      if (first.layout.rotY !== 0) return; // los girados (alas de una L) se ubican con X/Y/Z
      dragRef.current = { idx: pm.moduleIndex, offsetX: first.layout.x - e.point.x, spanW: mine.reduce((a, m) => a + m.dims.w, 0) };
      setSelModuleKey(first.key); setSelPieceKey(null);
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const plan = planReorder(baseAssembly, d.idx, { x: e.point.x + d.offsetX + d.spanW / 2, y: e.point.y });
    if (e.phase === 'move') {
      setDragPlan(prev => (prev && plan && prev.slot === plan.slot && prev.rowY === plan.rowY && prev.changed === plan.changed ? prev : plan));
      return;
    }
    dragRef.current = null;
    setDragPlan(null);
    if (plan?.changed) {
      setDrafts(prev => ({ ...prev, [active.id]: withLayouts(prev[active.id], baseAssembly, plan) }));
      setDirty(true);
    }
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
      download(exportFBX(scene), `${base}.fbx`, 'application/octet-stream');
    }
  };

  const errors = assembly.issues.filter(i => i.level === 'error');
  const warnings = assembly.issues.filter(i => i.level !== 'error');

  // Despiece del módulo seleccionado: misma fuente que planilla de cortes y costos
  const selParts = selMod && !isManualModule(selMod) ? calculateModuleParts(selMod) : [];
  const selHardware = selMod && !isManualModule(selMod) ? Object.entries(calculateItemQuantities([{ ...selMod, quantity: 1 }]).detailedHardware) : [];

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-stretch justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1500px] flex flex-col overflow-hidden">
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
                {assembly.modules.filter(m => m.instance === 0).map(m => (
                  <button key={m.key}
                    onClick={() => { setSelModuleKey(m.key); setSelPieceKey(null); }}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${selModuleKey === m.key ? 'bg-indigo-50 border-indigo-400' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold truncate">{modules[m.moduleIndex]?.name || m.name}</span>
                      <span className="font-mono text-gray-500 shrink-0">{fmt(m.dims.w)}×{fmt(m.dims.h)}×{fmt(m.dims.d)}</span>
                    </div>
                    <div className="flex gap-2 mt-0.5 text-[10px]">
                      {(modules[m.moduleIndex]?.quantity || 1) > 1 && <span className="text-gray-500">×{modules[m.moduleIndex]?.quantity}</span>}
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
                    <select disabled={!editable} className="border border-gray-200 p-1.5 rounded text-xs" value={selMod.doorHingeSide || 'LEFT'} onChange={e => updateModule(selModIndex, { doorHingeSide: e.target.value })}>
                      <option value="LEFT">Izquierda</option>
                      <option value="RIGHT">Derecha</option>
                    </select>
                  </label>
                )}

                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold">Posición en el mueble (mm)</span>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['x', 'y', 'z'] as const).map(k => (
                      <NumField key={k} label={k.toUpperCase()} value={Math.round(selectedPlaced.layout[k] * 10) / 10} disabled={!editable}
                        onChange={v => updateLayout(selModIndex, { [k]: v })} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] text-gray-500 mr-1">Giro:</span>
                    {([0, 90, 180, 270] as RotY[]).map(r => (
                      <button key={r} disabled={!editable} onClick={() => updateLayout(selModIndex, { rotY: r })}
                        className={`px-2 py-1 rounded text-[11px] border ${selectedPlaced.layout.rotY === r ? 'bg-black text-white border-black' : 'bg-white border-gray-200'} disabled:opacity-50`}>
                        {r}°
                      </button>
                    ))}
                    <RotateCw size={12} className="text-gray-400 ml-1" />
                  </div>
                  {editable && (
                    <button onClick={() => snapRight(selModIndex)} className="mt-2 text-[11px] text-indigo-600 hover:underline">Pegar a la derecha del módulo anterior</button>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">X: izquierda → derecha · Y: altura desde el piso · Z: hacia el frente. Las copias (Cant.) se ubican una al lado de la otra.</p>
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
          <main className="flex-1 flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200">
              {([['assembled', 'Ensamblado', BoxIcon], ['exploded', 'Despiece del mueble', Layers], ['module', 'Despiece del módulo', Layers]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => { setMode(k); setFitToken(t => t + 1); }}
                  disabled={k === 'module' && !selModuleKey && assembly.modules.length === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${mode === k ? 'bg-black text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
              {mode !== 'assembled' && (
                <label className="flex items-center gap-2 text-xs text-gray-600 ml-2">
                  Separación
                  <input type="range" min={0.1} max={1.5} step={0.05} value={factor} onChange={e => setFactor(Number(e.target.value))} />
                </label>
              )}
              <button onClick={() => setFitToken(t => t + 1)} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 flex items-center gap-1.5"><Maximize2 size={14} /> Encuadrar</button>
              {editable && mode === 'assembled' && (
                <span className="text-[10px] text-gray-500 ml-1">Arrastrá un módulo para cambiarlo de lugar (arriba/abajo: pasa a la otra fila)</span>
              )}
              <div className="flex-1" />
              <span className="text-[10px] text-gray-400 hidden xl:inline">3ds Max: File → Import → .fbx (unidades del archivo: mm)</span>
              <button onClick={() => doExport('fbx')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><Download size={14} /> FBX ensamblado</button>
              <button onClick={() => doExport('fbx-exploded')} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-300 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5"><Download size={14} /> FBX despiece</button>
              <button onClick={() => doExport('obj')} className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"><Download size={14} /> OBJ + MTL</button>
            </div>
            <div className="flex-1 min-h-0">
              {assembly.modules.length > 0 ? (
                <Viewer3D
                  scene={viewScene} bbox={assembly.bbox}
                  selectedPieceKey={selPieceKey} selectedModuleKey={selModuleKey}
                  issueModuleKeys={issueModuleKeys} fitToken={fitToken}
                  onPick={({ pieceKey, moduleKey }) => { setSelPieceKey(pieceKey); if (moduleKey) setSelModuleKey(moduleKey); }}
                  dragEnabled={editable && mode === 'assembled'} onDrag={onDrag}
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
                  <p><span className="text-gray-500">Placa:</span> {selPiece.boardLabel}</p>
                  <p><span className="text-gray-500">Medidas:</span> <span className="font-mono">{fmt(selPiece.partSize.width)} × {fmt(selPiece.partSize.height)} × {selPiece.thickness} mm</span></p>
                  <p><span className="text-gray-500">Veta:</span> {selPiece.grain === 'horizontal' ? 'horizontal (a lo ancho)' : selPiece.grain === 'vertical' ? 'vertical (a lo alto)' : 'libre'}</p>
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
