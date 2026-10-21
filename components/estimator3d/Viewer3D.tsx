/**
 * Visor three.js del constructor 3D. Dibuja la escena que arma utils/furniture3d/geometry
 * (la misma que se exporta a FBX/OBJ), permite orbitar, seleccionar piezas o módulos y mover
 * módulos con imán a los vecinos y al piso: en 3D con las flechas del seleccionado; en la vista
 * de frente (pared) arrastrándolos directo, solo a los costados y arriba/abajo. Escena en mm.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { FurnitureScene, Box, Vec3, PlacedModule, boxCenter, boxSize, fitCameraDistance, snapModuleMove, unionBox } from '../../utils/furniture3d/geometry';

/** Lo que se mueve junto: el módulo con sus copias en fila, o una copia ubicada por separado. */
const groupOf = (m: PlacedModule) => (m.ownLayout ? `${m.moduleIndex}#${m.instance}` : `${m.moduleIndex}`);
type DragTarget = { group: string; moduleIndex: number; instance: number; moving: Box; others: Box[] };
const dragTarget = (scene: FurnitureScene, m: PlacedModule): DragTarget => {
  const group = groupOf(m);
  return {
    group, moduleIndex: m.moduleIndex, instance: m.ownLayout ? m.instance : 0,
    moving: unionBox(scene.modules.filter(sm => groupOf(sm.module) === group).map(sm => sm.module.worldBox)),
    others: scene.modules.filter(sm => groupOf(sm.module) !== group).map(sm => sm.module.worldBox),
  };
};
import { materialColorFor } from '../../utils/furniture3d/exporters';

interface Viewer3DProps {
  scene: FurnitureScene;
  bbox: Box;                     // caja de lo que se está viendo (ítem o módulo): medidas del rótulo
  selectedPieceKey: string | null;
  selectedModuleKey: string | null;
  issueModuleKeys: Set<string>;
  onPick: (sel: { pieceKey: string | null; moduleKey: string | null }) => void;
  fitToken: number; // cambia para pedir "encuadrar"
  moveEnabled?: boolean;   // se pueden mover módulos (flechas en 3D, arrastre directo de frente)
  frontView?: boolean;     // vista de frente sin perspectiva: la pared de apoyo es el plano de la pantalla
  onMoveModule?: (moduleIndex: number, instance: number, delta: Vec3) => void;   // al soltar: desplazamiento (mm) ya con imán; instance 0 = el módulo con sus copias no separadas
  /** El visor deja acá la función que saca una imagen JPG de lo que se ve (con un rótulo abajo). */
  captureRef?: React.MutableRefObject<((caption: string) => Promise<Blob | null>) | null>;
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

const setOrthoFrustum = (c: { ortho: THREE.OrthographicCamera; camera: THREE.PerspectiveCamera; orthoHalfH: number }) => {
  const h = c.orthoHalfH, w = h * c.camera.aspect;
  c.ortho.left = -w; c.ortho.right = w; c.ortho.top = h; c.ortho.bottom = -h;
  c.ortho.updateProjectionMatrix();
};

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, bbox, selectedPieceKey, selectedModuleKey, issueModuleKeys, onPick, fitToken, moveEnabled = false, frontView = false, onMoveModule, captureRef }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
    ortho: THREE.OrthographicCamera; orthoHalfH: number; front: boolean;
    controls: OrbitControls; content: THREE.Group; raf: number; fitted: boolean;
    transform: TransformControls;
    drag: (DragTarget & { origin: Vec3 }) | null;
    parents: Map<string, THREE.Group>;
  } | null>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const moveRef = useRef(moveEnabled);
  moveRef.current = moveEnabled;
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

    // Vista de frente: cámara sin perspectiva mirando la pared (eje −Z), para alinear a ojo.
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1e6);

    const content = new THREE.Group();
    s.add(content);

    // Flechas de mover (como el gizmo de 3ds Max). Mientras se arrastra no se orbita.
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.9);
    s.add(transform.getHelper());
    const state = {
      renderer, scene: s, camera, ortho, orthoHalfH: 1000, front: false, controls, content, raf: 0, fitted: false, transform,
      drag: null as (DragTarget & { origin: Vec3 }) | null,
      parents: new Map<string, THREE.Group>(),
    };
    const activeCam = () => (state.front ? ortho : camera);
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
      if (delta.some(v => Math.abs(v) > 0.01)) onMoveRef.current?.(d.moduleIndex, d.instance, delta);
    });
    const loop = () => { controls.update(); renderer.render(s, activeCam()); state.raf = requestAnimationFrame(loop); };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      setOrthoFrustum(state);
    });
    ro.observe(mount);

    const rayAt = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, activeCam());
      return ray;
    };
    const pickAt = (e: PointerEvent) => rayAt(e).intersectObjects(content.children, true).find(h => h.object.userData.pickable);

    // Vista de frente: arrastre directo de un módulo sobre el plano de la pared (solo X e Y).
    let wall: (DragTarget & { moduleKey: string; plane: THREE.Plane; start: THREE.Vector3; origin: Vec3; delta: Vec3 }) | null = null;
    const wallPoint = (e: PointerEvent, plane: THREE.Plane) => rayAt(e).ray.intersectPlane(plane, new THREE.Vector3());

    // Selección por clic (ignora arrastres de órbita)
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      if (!state.front || !moveRef.current || e.button !== 0) return;
      const hit = pickAt(e);
      const pm = hit && sceneRef.current.modules.find(sm => sm.module.key === hit.object.userData.moduleKey)?.module;
      if (!hit || !pm) return;
      const target = dragTarget(sceneRef.current, pm);
      const parent = state.parents.get(target.group);
      if (!parent) return;
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -hit.point.z);
      wall = {
        ...target, moduleKey: pm.key, plane, start: hit.point.clone(),
        origin: parent.position.toArray() as Vec3, delta: [0, 0, 0],
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!wall) {
        // En la vista de frente, la mano indica qué se puede arrastrar.
        if (state.front && moveRef.current) renderer.domElement.style.cursor = pickAt(e) ? 'grab' : '';
        return;
      }
      const p = wallPoint(e, wall.plane);
      const parent = state.parents.get(wall.group);
      if (!p || !parent) return;
      const d = snapModuleMove(wall.moving, wall.others, [p.x - wall.start.x, p.y - wall.start.y, 0]);
      wall.delta = [d[0], d[1], 0];   // la profundidad no cambia: el módulo sigue contra la pared
      parent.position.set(wall.origin[0] + d[0], wall.origin[1] + d[1], wall.origin[2]);
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onUp = (e: PointerEvent) => {
      if (wall) {
        const w = wall;
        wall = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = '';
        if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
        if (w.delta.some(v => Math.abs(v) > 0.01)) {
          onMoveRef.current?.(w.moduleIndex, w.instance, w.delta);
          onPickRef.current({ pieceKey: null, moduleKey: w.moduleKey });
          return;
        }
      }
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      if (transform.axis) return;   // clic sobre las flechas: no cambia la selección
      const hit = pickAt(e);
      onPickRef.current(hit ? { pieceKey: hit.object.userData.pieceKey || null, moduleKey: hit.object.userData.moduleKey || null } : { pieceKey: null, moduleKey: null });
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      transform.detach();
      // No dispose(): en three r169 llama a this.traverse, que TransformControls ya no tiene, y
      // rompe el cierre del visor. disconnect() saca los eventos; sus mallas cuelgan de la escena
      // y las libera disposeTree.
      transform.disconnect();
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
    const parents = new Map<string, THREE.Group>();
    c.parents = parents;
    const parentOf = (key: string, at: { x: number; y: number; z: number }) => {
      let p = parents.get(key);
      if (!p) { p = new THREE.Group(); p.position.set(at.x, at.y, at.z); parents.set(key, p); c.content.add(p); }
      return p;
    };

    scene.modules.forEach(sm => {
      const g = new THREE.Group();
      const parent = parentOf(groupOf(sm.module), sm.layout);
      g.position.set(sm.layout.x - parent.position.x, sm.layout.y - parent.position.y, sm.layout.z - parent.position.z);
      const rad = THREE.MathUtils.degToRad;
      g.rotation.set(rad(sm.layout.rotX || 0), rad(sm.layout.rotY), rad(sm.layout.rotZ || 0), 'YXZ');
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
        helper.userData.overlay = true;   // marca de selección: no sale en la imagen exportada
        g.add(helper);
      }
      parent.add(g);
    });

    const sel = scene.modules.find(sm => sm.module.key === selectedModuleKey);
    if (moveEnabled && !frontView && sel) {
      const target = dragTarget(scene, sel.module);
      const parent = parents.get(target.group)!;
      c.drag = { ...target, origin: parent.position.toArray() as Vec3 };
      c.transform.attach(parent);
    }

    if (!c.fitted && scene.modules.length) { fit(); c.fitted = true; }
  }, [scene, selectedPieceKey, selectedModuleKey, issueModuleKeys, moveEnabled, frontView]);

  const fit = () => {
    const c = ctx.current;
    if (!c) return;
    const b = new THREE.Box3().setFromObject(c.content);
    if (b.isEmpty()) return;
    const center = b.getCenter(new THREE.Vector3());
    if (c.front) {
      // De frente: todo el ancho y el alto en pantalla, con margen.
      const size = b.getSize(new THREE.Vector3());
      c.orthoHalfH = Math.max(size.y / 2, size.x / 2 / Math.max(c.camera.aspect, 0.1), 300) * 1.15;
      c.ortho.zoom = 1;
      c.ortho.position.set(center.x, center.y, b.max.z + 50000);
      c.ortho.lookAt(center.x, center.y, center.z);
      c.controls.target.set(center.x, center.y, center.z);
      setOrthoFrustum(c);
      return;
    }
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

  /**
   * Imagen JPG de la vista actual (misma cámara), al doble de resolución, fondo blanco, sin
   * flechas ni resaltado de selección, con un rótulo abajo. Se dibuja y se copia en el mismo
   * paso, así no hace falta conservar el buffer de WebGL.
   */
  const capture = (caption: string): Promise<Blob | null> => {
    const c = ctx.current;
    if (!c) return Promise.resolve(null);
    const { renderer } = c;
    const restore: (() => void)[] = [];
    const helper = c.transform.getHelper();
    const helperVisible = helper.visible;
    helper.visible = false;
    restore.push(() => { helper.visible = helperVisible; });
    c.content.traverse(o => {
      if (o.userData.overlay && o.visible) { o.visible = false; restore.push(() => { o.visible = true; }); }
      const m = (o as any).material;
      if (m && !Array.isArray(m) && m.emissiveIntensity) { const v = m.emissiveIntensity; m.emissiveIntensity = 0; restore.push(() => { m.emissiveIntensity = v; }); }
    });
    const bg = c.scene.background;
    c.scene.background = new THREE.Color('#ffffff');
    restore.push(() => { c.scene.background = bg; });
    const ratio = renderer.getPixelRatio();
    renderer.setPixelRatio(Math.max(2, ratio));
    renderer.render(c.scene, c.front ? c.ortho : c.camera);

    const src = renderer.domElement;
    const scale = src.width / Math.max(1, src.clientWidth);
    const band = Math.round(44 * scale);
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height + band;
    const g = out.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0);
    g.fillStyle = '#e5e7eb'; g.fillRect(0, src.height, out.width, Math.max(1, Math.round(scale)));
    g.fillStyle = '#111827'; g.font = `${Math.round(15 * scale)}px sans-serif`; g.textBaseline = 'middle';
    g.fillText(caption, Math.round(16 * scale), src.height + band / 2);

    restore.forEach(f => f());
    renderer.setPixelRatio(ratio);
    renderer.render(c.scene, c.front ? c.ortho : c.camera);
    return new Promise(res => out.toBlob(b => res(b), 'image/jpeg', 0.92));
  };
  if (captureRef) captureRef.current = capture;

  // Cambio de vista: de frente no se orbita (solo desplazar y acercar).
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.front = frontView;
    c.controls.object = frontView ? c.ortho : c.camera;
    c.controls.enableRotate = !frontView;
    (c.transform as any).camera = frontView ? c.ortho : c.camera;
    fit();
  }, [frontView]);

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
