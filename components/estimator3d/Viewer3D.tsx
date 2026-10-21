/**
 * Visor three.js del constructor 3D. Dibuja la escena que arma utils/furniture3d/geometry
 * (la misma que se exporta a FBX/OBJ), permite orbitar, seleccionar piezas o módulos y mover el
 * módulo seleccionado con las flechas (con imán a los vecinos y al piso). Escena en milímetros.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { FurnitureScene, Box, Vec3, boxCenter, boxSize, fitCameraDistance, snapModuleMove, unionBox } from '../../utils/furniture3d/geometry';
import { materialColorFor } from '../../utils/furniture3d/exporters';

interface Viewer3DProps {
  scene: FurnitureScene;
  bbox: Box;                     // caja de lo que se está viendo (ítem o módulo): medidas del rótulo
  selectedPieceKey: string | null;
  selectedModuleKey: string | null;
  issueModuleKeys: Set<string>;
  onPick: (sel: { pieceKey: string | null; moduleKey: string | null }) => void;
  fitToken: number; // cambia para pedir "encuadrar"
  moveEnabled?: boolean;   // mostrar las flechas de mover sobre el módulo seleccionado
  onMoveModule?: (moduleIndex: number, delta: Vec3) => void;   // al soltar: desplazamiento (mm) ya con imán
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

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, bbox, selectedPieceKey, selectedModuleKey, issueModuleKeys, onPick, fitToken, moveEnabled = false, onMoveModule }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
    controls: OrbitControls; content: THREE.Group; raf: number; fitted: boolean;
    transform: TransformControls;
    drag: { moduleIndex: number; moving: Box; others: Box[]; origin: Vec3 } | null;
  } | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onMoveRef = useRef(onMoveModule);
  onMoveRef.current = onMoveModule;

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

    // Flechas de mover (como el gizmo de 3ds Max). Mientras se arrastra no se orbita.
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.9);
    s.add(transform.getHelper());
    const state = { renderer, scene: s, camera, controls, content, raf: 0, fitted: false, transform, drag: null as { moduleIndex: number; moving: Box; others: Box[]; origin: Vec3 } | null };
    ctx.current = state;
    transform.addEventListener('dragging-changed', (e: any) => { controls.enabled = !e.value; });
    transform.addEventListener('objectChange', () => {
      const obj = transform.object, d = state.drag;
      if (!obj || !d) return;
      const o = d.origin;
      const snapped = snapModuleMove(d.moving, d.others, [obj.position.x - o[0], obj.position.y - o[1], obj.position.z - o[2]]);
      obj.position.set(o[0] + snapped[0], o[1] + snapped[1], o[2] + snapped[2]);
    });
    transform.addEventListener('mouseUp', () => {
      const obj = transform.object, d = state.drag;
      if (!obj || !d) return;
      const delta: Vec3 = [obj.position.x - d.origin[0], obj.position.y - d.origin[1], obj.position.z - d.origin[2]];
      if (delta.some(v => Math.abs(v) > 0.01)) onMoveRef.current?.(d.moduleIndex, delta);
    });
    const loop = () => { controls.update(); renderer.render(s, camera); state.raf = requestAnimationFrame(loop); };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // Selección por clic (ignora arrastres de órbita)
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      if (transform.axis) return;   // clic sobre las flechas: no cambia la selección
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(content.children, true).find(h => h.object.userData.pickable);
      onPickRef.current(hit ? { pieceKey: hit.object.userData.pieceKey || null, moduleKey: hit.object.userData.moduleKey || null } : { pieceKey: null, moduleKey: null });
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      transform.detach();
      transform.dispose();
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
    c.transform.detach();
    c.drag = null;
    disposeTree(c.content);
    c.content.clear();

    // Las copias (Cant.) de un módulo cuelgan de un mismo grupo, ubicado en la primera copia
    // (ahí aparecen las flechas): se mueven juntas.
    const parents = new Map<number, THREE.Group>();
    const parentOf = (mi: number, at: { x: number; y: number; z: number }) => {
      let p = parents.get(mi);
      if (!p) { p = new THREE.Group(); p.position.set(at.x, at.y, at.z); parents.set(mi, p); c.content.add(p); }
      return p;
    };

    scene.modules.forEach(sm => {
      const g = new THREE.Group();
      const parent = parentOf(sm.module.moduleIndex, sm.layout);
      g.position.set(sm.layout.x - parent.position.x, sm.layout.y - parent.position.y, sm.layout.z - parent.position.z);
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
        const geom = sp.piece.shape === 'cylinder'
          ? new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, Math.max(size[1], 0.1), 24)
          : new THREE.BoxGeometry(Math.max(size[0], 0.1), Math.max(size[1], 0.1), Math.max(size[2], 0.1));
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(center[0], center[1], center[2]);
        if (sp.piece.rotX) mesh.rotation.x = THREE.MathUtils.degToRad(sp.piece.rotX);
        mesh.userData = { pickable: true, pieceKey: sp.piece.key, moduleKey: sm.module.key };
        // Cilindro: solo el contorno de las tapas (sin las aristas de cada segmento).
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, sp.piece.shape === 'cylinder' ? 30 : 1), new THREE.LineBasicMaterial({ color: isSel ? 0x4f46e5 : 0x6b7280 }));
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
      parent.add(g);
    });

    const sel = scene.modules.find(sm => sm.module.key === selectedModuleKey);
    if (moveEnabled && sel) {
      const mi = sel.module.moduleIndex;
      c.drag = {
        moduleIndex: mi,
        moving: unionBox(scene.modules.filter(sm => sm.module.moduleIndex === mi).map(sm => sm.module.worldBox)),
        others: scene.modules.filter(sm => sm.module.moduleIndex !== mi).map(sm => sm.module.worldBox),
        origin: parents.get(mi)!.position.toArray() as Vec3,
      };
      c.transform.attach(parents.get(mi)!);
    }

    if (!c.fitted && scene.modules.length) { fit(); c.fitted = true; }
  }, [scene, selectedPieceKey, selectedModuleKey, issueModuleKeys, moveEnabled]);

  const fit = () => {
    const c = ctx.current;
    if (!c) return;
    const b = new THREE.Box3().setFromObject(c.content);
    if (b.isEmpty()) return;
    const center = b.getCenter(new THREE.Vector3());
    // Distancia según el tamaño real (incluido el despiece explotado) y la proporción del visor:
    // antes era un múltiplo fijo de la medida mayor y en visores angostos el mueble quedaba cortado.
    const dist = fitCameraDistance({ min: b.min.toArray(), max: b.max.toArray() }, c.camera.fov, c.camera.aspect);
    const dir = new THREE.Vector3(0.7, 0.55, 1.5).normalize();
    c.controls.target.copy(center);
    c.camera.position.copy(center).addScaledVector(dir, dist);
    c.camera.near = dist / 200; c.camera.far = dist * 50;
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
