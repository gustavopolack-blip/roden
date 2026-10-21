/**
 * Maqueta 3D para ver en el celular, la tablet o la PC (sin instalar nada):
 * - HTML: un solo archivo que se abre en cualquier navegador y se gira con el dedo o el mouse.
 *   Lleva adentro three.js y la maqueta, así funciona sin internet.
 * - USDZ: el formato de Apple. En iPhone/iPad se abre solo (Archivos, WhatsApp, Mail) y permite
 *   girarlo y verlo en el ambiente con realidad aumentada, a tamaño real.
 * La maqueta es una copia de lo que se ve en el visor (en mm).
 */
import * as THREE from 'three';

export interface WebModelInfo { title: string; caption: string }

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));

export const exportViewerHtml = async (model: THREE.Object3D, info: WebModelInfo): Promise<string> => {
  // Se cargan solo al exportar (no pesan en la app).
  const [{ default: threeSrc }, { default: orbitSrc }, { default: roomSrc }] = await Promise.all([
    import('/node_modules/three/build/three.module.min.js?raw'),
    import('three/examples/jsm/controls/OrbitControls.js?raw'),
    import('three/examples/jsm/environments/RoomEnvironment.js?raw'),
  ]);
  embedTextures(model);
  // Las aristas usan EdgesGeometry, que ObjectLoader no sabe reconstruir: se pasan a una geometría
  // común (en la copia; el visor no cambia).
  model.traverse(o => {
    const g = (o as THREE.LineSegments).geometry;
    if ((o as THREE.LineSegments).isLineSegments && g && g.type !== 'BufferGeometry') (o as THREE.LineSegments).geometry = new THREE.BufferGeometry().copy(g);
  });
  const json = JSON.stringify(model.toJSON()).replace(/</g, '\\u003c');
  const importMap = JSON.stringify({ imports: {
    three: `data:text/javascript;base64,${b64(threeSrc)}`,
    'three-orbit': `data:text/javascript;base64,${b64(orbitSrc)}`,
    'three-room': `data:text/javascript;base64,${b64(roomSrc)}`,
  } });
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${esc(info.title)}</title>
<style>
html,body{margin:0;height:100%;background:#f3f4f6;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}
#v{position:fixed;inset:0;touch-action:none}
#t{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:10px 14px;font-size:14px;color:#111827}
#h{position:fixed;top:10px;left:50%;transform:translateX(-50%);max-width:92vw;box-sizing:border-box;text-align:center;background:rgba(255,255,255,.9);border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px;font-size:12px;color:#4b5563}
#e{display:none;padding:24px;color:#991b1b}
</style>
<script type="importmap">${importMap}</script>
</head><body>
<div id="v"></div>
<div id="h">Arrastrá para girar · pellizcá o rueda para acercar · dos dedos para mover</div>
<div id="t">${esc(info.caption)}</div>
<div id="e">Este navegador no pudo mostrar la maqueta 3D. Probá abrir el archivo con Chrome, Edge o Safari.</div>
<script type="application/json" id="m">${json}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three-orbit';
import { RoomEnvironment } from 'three-room';
try {
  const mount = document.getElementById('v');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3f4f6');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 0.9));
  const model = new THREE.ObjectLoader().parse(JSON.parse(document.getElementById('m').textContent));
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.length() / 2, 500);
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(center.x + r * 0.6, box.min.y + r * 1.6, center.z + r);
  dir.target.position.set(center.x, box.min.y, center.z);
  dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.bias = -0.0004; dir.shadow.normalBias = 2;
  Object.assign(dir.shadow.camera, { left: -r * 1.3, right: r * 1.3, top: r * 1.3, bottom: -r * 1.3, near: r * 0.1, far: r * 5 });
  dir.shadow.camera.updateProjectionMatrix();
  scene.add(dir, dir.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(r * 6, r * 6), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(center.x, box.min.y - 0.5, center.z); floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(Math.max(size.x, size.z) * 3, 30, 0xd1d5db, 0xe5e7eb); grid.position.set(center.x, box.min.y, center.z); scene.add(grid);
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1e6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.target.copy(center);
  const fit = () => {
    const w = mount.clientWidth, h = Math.max(1, mount.clientHeight);
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    const r = size.length() / 2, half = THREE.MathUtils.degToRad(camera.fov / 2);
    const d = r / Math.sin(Math.min(half, Math.atan(Math.tan(half) * camera.aspect))) * 1.15;
    camera.position.copy(center).addScaledVector(new THREE.Vector3(0.7, 0.55, 1.5).normalize(), d);
    camera.near = d / 200; camera.far = d * 50; camera.updateProjectionMatrix();
  };
  fit();
  window.addEventListener('resize', () => { const w = mount.clientWidth, h = Math.max(1, mount.clientHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); });
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  window.__rodenReady = true;
} catch (err) { document.getElementById('e').style.display = 'block'; console.error(err); }
</script>
</body></html>`;
};

/**
 * Las texturas del visor vienen de una URL (Supabase); para que el archivo funcione sin internet
 * se meten adentro como JPG (en la copia; el visor no cambia). Una imagen todavía sin cargar se
 * deja afuera: la pieza queda con su color base.
 */
const embedTextures = (model: THREE.Object3D) => {
  const done = new Map<THREE.Texture, THREE.Texture | null>();
  model.traverse(o => {
    const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!mat || Array.isArray(mat) || !mat.map) return;
    if (!done.has(mat.map)) {
      const img = mat.map.image as HTMLImageElement | undefined;
      let copy: THREE.Texture | null = null;
      if (img && img.complete && img.naturalWidth > 0) {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext('2d')!.drawImage(img, 0, 0);
        const jpg = new Image();
        jpg.src = cv.toDataURL('image/jpeg', 0.85);   // toJSON guarda tal cual una imagen data:
        copy = mat.map.clone();
        copy.source = new THREE.Source(jpg);
      }
      done.set(mat.map, copy);
    }
    const copy = done.get(mat.map)!;
    const m2 = mat.clone();
    m2.map = copy;
    if (!copy) m2.color.set(0xd8cfc0);   // sin imagen: tono neutro de madera
    (o as THREE.Mesh).material = m2;
  });
};

/** USDZ (Apple) en metros, a tamaño real. */
export const exportUsdz = async (model: THREE.Object3D): Promise<Uint8Array> => {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const root = new THREE.Group();
  root.scale.setScalar(0.001);   // la maqueta está en mm; USDZ usa metros
  root.add(model);
  root.updateMatrixWorld(true);
  return new USDZExporter().parseAsync(root);
};
