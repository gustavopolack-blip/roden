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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LibraryMaterial, matchMaterial, roughnessFor, texturedBox } from '../../utils/furniture3d/materialLibrary';
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
  /** El visor deja acá la función que copia lo que se ve (en mm) para exportar la maqueta. */
  modelRef?: React.MutableRefObject<(() => THREE.Group | null) | null>;
  /** Biblioteca de materiales: cada pieza toma la textura de su placa (por nombre). */
  library?: LibraryMaterial[];
  /** URL pública de la imagen de un material (bucket material-textures). */
  textureUrl?: (path: string) => string;
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

/** Textura de un material (una sola carga por imagen; se repite según las coordenadas de la pieza). */
const textureFor = (c: { textures: Map<string, THREE.Texture>; renderer: THREE.WebGLRenderer }, url: string): THREE.Texture => {
  let t = c.textures.get(url);
  if (!t) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = c.renderer.capabilities.getMaxAnisotropy();
    c.textures.set(url, t);
  }
  return t;
};

/** Sol y piso de sombras ajustados al mueble que se ve. */
const fitShadow = (c: { content: THREE.Group; sun: THREE.DirectionalLight; scene: THREE.Scene }) => {
  const b = new THREE.Box3().setFromObject(c.content);
  if (b.isEmpty()) return;
  const center = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 500);
  c.sun.target.position.set(center.x, b.min.y, center.z);
  c.sun.position.set(center.x + r * 0.6, b.min.y + r * 1.6, center.z + r * 1.0);
  const sc = c.sun.shadow.camera;
  sc.left = -r * 1.3; sc.right = r * 1.3; sc.top = r * 1.3; sc.bottom = -r * 1.3; sc.near = r * 0.1; sc.far = r * 5;
  sc.updateProjectionMatrix();
  const floor = c.scene.children.find(o => o.userData.floor);
  if (floor) { floor.position.set(center.x, b.min.y - 0.5, center.z); floor.scale.set(r * 6, r * 6, 1); }
};

const Viewer3D: React.FC<Viewer3DProps> = ({ scene, bbox, selectedPieceKey, selectedModuleKey, issueModuleKeys, onPick, fitToken, moveEnabled = false, frontView = false, onMoveModule, captureRef, modelRef, library = [], textureUrl }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
    ortho: THREE.OrthographicCamera; orthoHalfH: number; front: boolean;
    controls: OrbitControls; content: THREE.Group; raf: number; fitted: boolean;
    sun: THREE.DirectionalLight; textures: Map<string, THREE.Texture>;
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
    // Terminación de presentación: tono neutro, reflejos de un ambiente interior y sombras suaves.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const s = new THREE.Scene();
    s.background = new THREE.Color('#f3f4f6');
    const pmrem = new THREE.PMREMGenerator(renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    s.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(2000, 4000, 3000);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.bias = -0.0004;
    dir.shadow.normalBias = 2;
    s.add(dir, dir.target);
    // Piso que solo recibe sombra (no se ve como superficie).
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.floor = true;
    s.add(floor);
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
      sun: dir, textures: new Map<string, THREE.Texture>(),
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
      state.textures.forEach(t => t.dispose());
      (s.environment as THREE.Texture | null)?.dispose();
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
        // Material de la biblioteca (por el nombre de la placa); si no hay, el color de referencia.
        const lib = sp.piece.shape === 'cylinder' ? null : matchMaterial(sp.piece.boardLabel, library);
        const tex = lib?.texture_path && textureUrl ? textureFor(c, textureUrl(lib.texture_path)) : null;
        const mat = new THREE.MeshStandardMaterial({
          color: tex ? 0xffffff : lib ? new THREE.Color(lib.color) : new THREE.Color(...materialColorFor(sp.piece.boardLabel)),
          map: tex, roughness: lib ? roughnessFor(lib) : 0.75, metalness: 0,
          emissive: new THREE.Color(isSel ? 0x4f46e5 : moduleSelected ? 0x1e1b4b : 0x000000),
          emissiveIntensity: isSel ? 0.55 : moduleSelected ? 0.12 : 0,
        });
        let geom: THREE.BufferGeometry;
        if (sp.piece.shape === 'cylinder') {
          geom = new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, Math.max(size[1], 0.1), 24);
        } else if (tex && lib) {
          // Coordenadas de textura a escala real, con la veta de la imagen siguiendo la de la pieza.
          const tb = texturedBox([Math.max(size[0], 0.1), Math.max(size[1], 0.1), Math.max(size[2], 0.1)], sp.piece.grainAxis, lib);
          geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.Float32BufferAttribute(tb.positions, 3));
          geom.setAttribute('normal', new THREE.Float32BufferAttribute(tb.normals, 3));
          geom.setAttribute('uv', new THREE.Float32BufferAttribute(tb.uvs, 2));
          geom.setIndex(tb.index);
        } else {
          geom = new THREE.BoxGeometry(Math.max(size[0], 0.1), Math.max(size[1], 0.1), Math.max(size[2], 0.1));
        }
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
    fitShadow(c);
  }, [scene, selectedPieceKey, selectedModuleKey, issueModuleKeys, moveEnabled, frontView, library]);

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
   * Captura JPG de lo que se ve en el visor, igual que en pantalla (misma cámara, encuadre, fondo
   * y grilla), sin las flechas de mover ni el resaltado de selección, con un rótulo abajo. Se
   * dibuja en el momento de la llamada (antes de abrir el cuadro de "Guardar como", que puede
   * sacar al navegador de pantalla completa y cambiar el visor). Resolución: el doble de la
   * pantalla, sin pasar el máximo de la placa de video.
   */
  const capture = (caption: string): Promise<Blob | null> => {
    const c = ctx.current;
    if (!c) return Promise.resolve(null);
    const { renderer } = c;
    const restore: (() => void)[] = [];
    const hide = (o: THREE.Object3D) => { if (o.visible) { o.visible = false; restore.push(() => { o.visible = true; }); } };
    hide(c.transform.getHelper());
    c.content.traverse(o => {
      if (o.userData.overlay) hide(o);
      const m = (o as any).material;
      if (m && !Array.isArray(m) && m.emissiveIntensity) { const v = m.emissiveIntensity; m.emissiveIntensity = 0; restore.push(() => { m.emissiveIntensity = v; }); }
    });
    const ratio = renderer.getPixelRatio();
    const el = renderer.domElement;
    const gl = renderer.getContext();
    const maxPx = Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096);
    const scale = Math.max(1, Math.min(2, maxPx / Math.max(1, el.clientWidth), maxPx / Math.max(1, el.clientHeight)));
    renderer.setPixelRatio(scale);
    renderer.render(c.scene, c.front ? c.ortho : c.camera);

    const W = el.width, H = el.height;
    const band = Math.round(40 * scale);
    const out = document.createElement('canvas');
    out.width = W; out.height = H + band;
    const g = out.getContext('2d')!;
    g.drawImage(el, 0, 0);
    restore.forEach(f => f());
    renderer.setPixelRatio(ratio);
    renderer.render(c.scene, c.front ? c.ortho : c.camera);

    g.fillStyle = '#ffffff'; g.fillRect(0, H, W, band);
    g.fillStyle = '#e5e7eb'; g.fillRect(0, H, W, Math.max(1, Math.round(scale)));
    g.fillStyle = '#111827'; g.font = `${Math.round(15 * scale)}px sans-serif`; g.textBaseline = 'middle';
    g.fillText(caption, Math.round(16 * scale), H + band / 2);
    return new Promise(res => out.toBlob(b => res(b), 'image/jpeg', 0.92));
  };
  if (captureRef) captureRef.current = capture;

  /** Copia de lo que se ve (en mm), sin marcas de selección ni resaltado, para exportar. */
  const cloneModel = (): THREE.Group | null => {
    const c = ctx.current;
    if (!c) return null;
    const copy = c.content.clone(true);
    const drop: THREE.Object3D[] = [];
    copy.traverse(o => {
      if (o.userData.overlay) { drop.push(o); return; }
      const m = (o as any).material;
      if (m && !Array.isArray(m) && m.emissiveIntensity) { (o as any).material = m.clone(); (o as any).material.emissiveIntensity = 0; }
    });
    drop.forEach(o => o.parent?.remove(o));
    copy.updateMatrixWorld(true);
    return copy;
  };
  if (modelRef) modelRef.current = cloneModel;

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
