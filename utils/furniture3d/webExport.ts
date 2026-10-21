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
  const [{ default: threeSrc }, { default: orbitSrc }] = await Promise.all([
    import('/node_modules/three/build/three.module.min.js?raw'),
    import('three/examples/jsm/controls/OrbitControls.js?raw'),
  ]);
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
try {
  const mount = document.getElementById('v');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3f4f6');
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 1.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(2000, 4000, 3000); scene.add(dir);
  const model = new THREE.ObjectLoader().parse(JSON.parse(document.getElementById('m').textContent));
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
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

/** USDZ (Apple) en metros, a tamaño real. */
export const exportUsdz = async (model: THREE.Object3D): Promise<Uint8Array> => {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const root = new THREE.Group();
  root.scale.setScalar(0.001);   // la maqueta está en mm; USDZ usa metros
  root.add(model);
  root.updateMatrixWorld(true);
  return new USDZExporter().parseAsync(root);
};
