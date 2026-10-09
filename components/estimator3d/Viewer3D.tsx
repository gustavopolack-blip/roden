/**
 * Visor three.js del constructor 3D. Dibuja la escena que arma utils/furniture3d/geometry
 * (la misma que se exporta a FBX/OBJ), permite orbitar y seleccionar piezas o módulos.
 * Escena en milímetros.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FurnitureScene, Box, boxCenter, boxSize } from '../../utils/furniture3d/geometry';
import { materialColorFor } from '../../utils/furniture3d/exporters';

interface Viewer3DProps {
  scene: FurnitureScene;
  bbox: Box;
  selectedPieceKey: string | null;
  selectedModuleKey: string | null;
  issueModuleKeys: Set<string>;
  onPick: (sel: { pieceKey: string | null; moduleKey: string | null }) => void;
  fitToken: number; // cambia para pedir "encuadrar"
  /** Arrastrar módulos con el mouse (solo vista ensamblada y editable). */
  dragEnabled?: boolean;
  onDrag?: (e: { phase: 'start' | 'move' | 'end'; moduleKey: string; point: { x: number; y: number } }) => void;
}

const disposeTree = (obj: THREE.Object3D) => {
  obj.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as any).material;
    if (Array.isArray(mat)) mat.forEach((x: THREE.Material) => x.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
};

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, bbox, selectedPieceKey, selectedModuleKey, issueModuleKeys, onPick, fitToken, dragEnabled = false, onDrag }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
    controls: OrbitControls; content: THREE.Group; raf: number; fitted: boolean;
  } | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const dragRef = useRef({ enabled: dragEnabled, onDrag });
  dragRef.current = { enabled: dragEnabled, onDrag };

  // Inicialización (una vez)
  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const s = new THREE.Scene();
    s.background = new THREE.Color('#f3f4f6');
    s.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(2000, 4000, 3000);
    s.add(dir);
    const grid = new THREE.GridHelper(10000, 20, 0xd1d5db, 0xe5e7eb);
    s.add(grid);

    const camera = new THREE.PerspectiveCamera(40, mount.clientWidth / Math.max(1, mount.clientHeight), 10, 200000);
    camera.position.set(2500, 2000, 4000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const content = new THREE.Group();
    s.add(content);

    const state = { renderer, scene: s, camera, controls, content, raf: 0, fitted: false };
    ctx.current = state;
    const loop = () => { controls.update(); renderer.render(s, camera); state.raf = requestAnimationFrame(loop); };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // Clic = seleccionar (ignora arrastres de órbita). Clic sostenido sobre un módulo y mover =
    // arrastrar ese módulo sobre el plano vertical que pasa por el punto tomado.
    const ray = new THREE.Raycaster();
    const toNdc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const hitAt = (e: PointerEvent) => {
      ray.setFromCamera(toNdc(e), camera);
      return ray.intersectObjects(content.children, true).find(h => h.object.userData.pickable);
    };
    const planePoint = (e: PointerEvent, plane: THREE.Plane) => {
      ray.setFromCamera(toNdc(e), camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, p) ? { x: p.x, y: p.y } : null;
    };
    let down: { x: number; y: number } | null = null;
    let grab: { moduleKey: string; plane: THREE.Plane; dragging: boolean; pointerId: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      grab = null;
      if (!dragRef.current.enabled || e.button !== 0) return;
      const hit = hitAt(e);
      const moduleKey = hit?.object.userData.moduleKey;
      if (!hit || !moduleKey) return;
      grab = { moduleKey, plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -hit.point.z), dragging: false, pointerId: e.pointerId };
      controls.enabled = false; // sin órbita mientras se toma un módulo
    };
    const onMove = (e: PointerEvent) => {
      if (!grab || !down) return;
      const pt = planePoint(e, grab.plane);
      if (!pt) return;
      if (!grab.dragging) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 4) return;
        grab.dragging = true;
        renderer.domElement.setPointerCapture(grab.pointerId);
        renderer.domElement.style.cursor = 'grabbing';
        dragRef.current.onDrag?.({ phase: 'start', moduleKey: grab.moduleKey, point: pt });
      }
      dragRef.current.onDrag?.({ phase: 'move', moduleKey: grab.moduleKey, point: pt });
    };
    const onUp = (e: PointerEvent) => {
      const g = grab;
      grab = null;
      controls.enabled = true;
      renderer.domElement.style.cursor = '';
      if (g?.dragging) {
        const pt = planePoint(e, g.plane);
        dragRef.current.onDrag?.({ phase: 'end', moduleKey: g.moduleKey, point: pt || { x: 0, y: 0 } });
        return;
      }
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const hit = hitAt(e);
      onPickRef.current(hit ? { pieceKey: hit.object.userData.pieceKey || null, moduleKey: hit.object.userData.moduleKey || null } : { pieceKey: null, moduleKey: null });
    };
    // captura: este manejador corre antes que el de OrbitControls y puede frenar la órbita
    renderer.domElement.addEventListener('pointerdown', onDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown, { capture: true });
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      disposeTree(s);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, []);

  // Contenido: se reconstruye cuando cambia la escena o la selección
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    disposeTree(c.content);
    c.content.clear();

    scene.modules.forEach(sm => {
      const g = new THREE.Group();
      g.position.set(sm.layout.x, sm.layout.y, sm.layout.z);
      g.rotation.y = THREE.MathUtils.degToRad(sm.layout.rotY);
      const moduleSelected = sm.module.key === selectedModuleKey;
      const hasIssue = issueModuleKeys.has(sm.module.key);

      sm.pieces.forEach(sp => {
        const size = boxSize(sp.box), center = boxCenter(sp.box);
        const isSel = sp.piece.key === selectedPieceKey;
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(...materialColorFor(sp.piece.boardLabel)),
          roughness: 0.75, metalness: 0,
          emissive: new THREE.Color(isSel ? 0x4f46e5 : moduleSelected ? 0x1e1b4b : 0x000000),
          emissiveIntensity: isSel ? 0.55 : moduleSelected ? 0.12 : 0,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size[0], 0.1), Math.max(size[1], 0.1), Math.max(size[2], 0.1)), mat);
        mesh.position.set(center[0], center[1], center[2]);
        mesh.userData = { pickable: true, pieceKey: sp.piece.key, moduleKey: sm.module.key };
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: isSel ? 0x4f46e5 : 0x6b7280 }));
        mesh.add(edges);
        // Marca de bisagra (lado de apertura) sobre el canto de la puerta
        if (sp.piece.hingeSide) {
          const mark = new THREE.Mesh(new THREE.BoxGeometry(4, size[1] * 0.8, 2), new THREE.MeshBasicMaterial({ color: 0x111827 }));
          mark.position.set((sp.piece.hingeSide === 'left' ? -1 : 1) * (size[0] / 2 - 10), 0, size[2] / 2 + 1);
          mesh.add(mark);
        }
        g.add(mesh);
      });

      if (sm.placeholder) {
        const size = boxSize(sm.placeholder), center = boxCenter(sm.placeholder);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: moduleSelected ? 0.45 : 0.25 }),
        );
        mesh.position.set(center[0], center[1], center[2]);
        mesh.userData = { pickable: true, pieceKey: null, moduleKey: sm.module.key };
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x2563eb })));
        g.add(mesh);
      }

      if (moduleSelected || hasIssue) {
        const b = sm.module.localBox;
        const helper = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)), hasIssue ? 0xdc2626 : 0x4f46e5);
        g.add(helper);
      }
      c.content.add(g);
    });

    if (!c.fitted && scene.modules.length) { fit(); c.fitted = true; }
  }, [scene, selectedPieceKey, selectedModuleKey, issueModuleKeys]);

  const fit = () => {
    const c = ctx.current;
    if (!c) return;
    const b = new THREE.Box3().setFromObject(c.content);
    if (b.isEmpty()) return;
    const center = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z, 600);
    c.controls.target.copy(center);
    c.camera.position.set(center.x + d * 0.7, center.y + d * 0.55, center.z + d * 1.5);
    c.camera.near = d / 200; c.camera.far = d * 50;
    c.camera.updateProjectionMatrix();
  };
  useEffect(() => { fit(); }, [fitToken]);

  const s = boxSize(bbox);
  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 bg-white/90 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-700 shadow-sm pointer-events-none">
        {Math.round(s[0])} × {Math.round(s[1])} × {Math.round(s[2])} mm <span className="text-gray-400">(ancho × alto × prof.)</span>
      </div>
    </div>
  );
};

export default Viewer3D;
