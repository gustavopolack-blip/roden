---
name: roden-propuesta
description: >
  Genera una propuesta comercial completa de rødën (rodenmobel.com) directamente en
  Figma, lista para enviar por WhatsApp. Activar cuando el usuario diga "nueva
  propuesta", "armar propuesta para [cliente]", "propuesta rødën", "generar
  presentación de mueble", o cuando suba renders o planos con intención de presentar
  un proyecto de mobiliario a medida. También activar cuando el contexto sea rødën
  y el usuario mencione cliente + imágenes + precio juntos. La skill recoge los datos
  del proyecto, comprime las imágenes, crea un archivo Figma nuevo y construye los
  8 frames del sistema rødën con todo personalizado y listo para exportar a PNG.
---

# rødën — Generador de Propuesta Comercial

Workflow completo: datos + imágenes del usuario → 8 frames en Figma → link para exportar y enviar.

---

## Estructura de los 8 frames

| Frame | Rol           | Contenido dinámico                                      |
|-------|---------------|---------------------------------------------------------|
| F01   | Cover         | Nombre del proyecto, cliente, render principal (70%)    |
| F02   | Hero          | Render principal full-bleed, sin texto                  |
| F03   | Concepto      | Texto de concepto personalizable                        |
| F04   | Detalle A     | Imagen de detalle de material/acabado                   |
| F05   | Detalle B     | Imagen de detalle funcional/herraje                     |
| F06   | Técnico       | Plano técnico o imagen de dimensiones                   |
| F07   | Inversión     | Precio principal, bullets de valor, opcionales          |
| F08   | CTA           | Fijo — branding rødën + botón de acción                 |

---

## PASO 1 — Recopilar datos del proyecto

Usar `AskUserQuestion` para obtener en una sola pantalla los siguientes datos.
Si alguno ya está en la conversación, no volver a pedirlo.

Preguntas sugeridas:
- Nombre del cliente (ej: "Lucino")
- Nombre del proyecto (ej: "Mueble TV Suite")
- Precio principal (ej: "$2.986.340 — Panel enlistonado")
- Precio variante (opcional, ej: "$2.834.590 — Panel plano")
- Adicionales/opcionales (opcional, ej: "Sistema LED dimerizable · $196.280")
- Plazo de entrega (ej: "60 días")
- Texto de concepto (dejar vacío para usar el texto por defecto)

**Texto de concepto por defecto:**
> "Integración vertical para centralizar instalaciones y maximizar la altura percibida del ambiente."

---

## PASO 2 — Recopilar imágenes

Pedir al usuario que suba las imágenes en este orden. Indicar claramente para qué se usa cada una:

1. **Render principal** *(obligatoria)* → se coloca en F01 (portada) y F02 (hero)
2. **Detalle material / acabado** *(opcional)* → se coloca en F04
3. **Detalle herraje / funcional** *(opcional)* → se coloca en F05
4. **Plano técnico** *(opcional)* → se coloca en F06

Si una imagen no se sube, el placeholder gris con su label queda en el frame — el usuario puede reemplazarlo manualmente en Figma después.

---

## PASO 3 — Comprimir imágenes

Para cada imagen subida, ejecutar el script de compresión desde bash.
Las imágenes subidas por el usuario están en la carpeta de uploads de la sesión.

```bash
python3 /sessions/sleepy-cool-cray/mnt/roden-fixed/roden-propuesta/scripts/prepare_image.py \
  /ruta/a/la/imagen_subida.jpg
```

El script imprime por stdout el string base64 comprimido (sin salto de línea).
Guardarlo en una variable. Cada base64 resultante tendrá < 44.000 caracteres,
lo que permite pasarlo como variable dentro del código JS de use_figma (límite: 50.000 chars).

Si PIL no está instalado: `pip install Pillow --break-system-packages --quiet`

---

## PASO 4 — Crear archivo Figma

Llamar a `whoami` para obtener el planKey si no se conoce.
Luego llamar a `create_new_file`:

- **fileName**: `"{proyecto} — {cliente} | rødën"`
- **planKey**: el key del plan del usuario
- **editorType**: `"design"`

Guardar el `file_key` del resultado para los pasos siguientes.

---

## PASO 5 — Construir los 8 frames con texto personalizado

Hacer **un solo llamado** a `use_figma` con el código de construcción completo.
Sustituir todos los marcadores `%%VARIABLE%%` con los valores reales del proyecto.

```javascript
// ── CARGAR FUENTES ──────────────────────────────────────────────
await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
await figma.loadFontAsync({ family: "Inter", style: "Light" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });

const page = figma.currentPage;
page.name = "rødën — %%PROYECTO%%";

// ── DATOS DEL PROYECTO (sustituir antes de ejecutar) ────────────
const D = {
  proyecto:    "%%PROYECTO%%",
  cliente:     "%%CLIENTE%%",
  precio:      "%%PRECIO%%",
  variante:    "%%VARIANTE%%",      // vacío si no aplica
  adicionales: "%%ADICIONALES%%",   // vacío si no aplica
  plazo:       "%%PLAZO%%",
  concepto:    "%%CONCEPTO%%",
};

// ── PALETA ──────────────────────────────────────────────────────
const C = {
  black:    {r:0,g:0,b:0}, white:{r:1,g:1,b:1},
  gray:     {r:.929,g:.929,b:.929}, phLight:{r:.769,g:.769,b:.769},
  phDark:   {r:.102,g:.102,b:.102}, textMid:{r:.533,g:.533,b:.533},
  textDim:  {r:.733,g:.733,b:.733}, textGhost:{r:.8,g:.8,b:.8},
  divider:  {r:.894,g:.894,b:.894},
};
const FW=1080, FH=1920, SZ=80, CG=100, RG=100;

// ── HELPERS ─────────────────────────────────────────────────────
const fill = (c,o=1) => [{type:'SOLID',color:c,opacity:o}];
function mkRect(w,h,c,n=''){const r=figma.createRectangle();r.resize(w,h);r.fills=fill(c);if(n)r.name=n;return r;}
function mkText(chars,size,style,color,opts={}){
  const t=figma.createText();
  t.fontName={family:"Inter",style};
  t.fontSize=size;
  if(opts.fw){t.textAutoResize="HEIGHT";t.resize(opts.fw,100);}
  t.characters=chars;
  t.fills=fill(color);
  if(opts.align)t.textAlignHorizontal=opts.align;
  if(opts.ls!==undefined)t.letterSpacing={value:opts.ls,unit:'PERCENT'};
  if(opts.lh!==undefined)t.lineHeight={value:opts.lh,unit:'PERCENT'};
  return t;
}
function mkPH(w,h,dark,label){
  const f=figma.createFrame();
  f.name=`☐ Placeholder — ${label}`;
  f.resize(w,h);f.fills=fill(dark?C.phDark:C.phLight);f.clipsContent=true;
  const l=mkText(label.toUpperCase(),22,"Regular",dark?{r:.28,g:.28,b:.28}:{r:.6,g:.6,b:.6},{ls:18,fw:w,align:'CENTER'});
  l.x=0;l.y=(h-l.height)/2;f.appendChild(l);return f;
}
function pos(n,x,y){n.x=x;n.y=y;}
function mkFrame(name,bg,col,row){
  const f=figma.createFrame();f.name=name;f.resize(FW,FH);
  f.fills=fill(bg);f.x=col*(FW+CG);f.y=row*(FH+RG);f.clipsContent=true;return f;
}
function mkFn(n,c){return mkText(String(n).padStart(2,'0'),22,"Regular",c,{ls:20});}

// ════ F01 — COVER ═══════════════════════════════════════════════
{const f=mkFrame("F01 — Cover",C.white,0,0);
const imgH=Math.round(FH*.7);
const img=mkPH(FW,imgH,false,"render principal");pos(img,0,0);f.appendChild(img);
const band=mkRect(FW,FH-imgH,C.white,"text-band");pos(band,0,imgH);f.appendChild(band);
const logo=mkText("rødën",30,"Bold",C.white,{ls:4});pos(logo,FW-SZ-logo.width,SZ);f.appendChild(logo);
const title=mkText(D.proyecto,100,"Bold",C.black,{lh:108,fw:FW-SZ*2});pos(title,SZ,imgH+SZ);f.appendChild(title);
const sub=mkText("PROYECTO A MEDIDA",22,"Regular",C.textDim,{ls:22});pos(sub,SZ,imgH+SZ+title.height+20);f.appendChild(sub);
if(D.cliente){const cli=mkText(D.cliente.toUpperCase(),18,"Regular",C.textGhost,{ls:28});pos(cli,SZ,imgH+SZ+title.height+20+sub.height+12);f.appendChild(cli);}
const fn=mkFn(1,C.textGhost);pos(fn,SZ,FH-SZ-fn.height);f.appendChild(fn);}

// ════ F02 — HERO ════════════════════════════════════════════════
{const f=mkFrame("F02 — Hero",C.black,1,0);
const img=mkPH(FW,FH,true,"render principal");pos(img,0,0);f.appendChild(img);
const fn=mkFn(2,{r:.18,g:.18,b:.18});pos(fn,SZ,SZ);f.appendChild(fn);}

// ════ F03 — CONCEPTO ════════════════════════════════════════════
{const f=mkFrame("F03 — Concepto",C.black,2,0);
const fn=mkFn(3,{r:.18,g:.18,b:.18});pos(fn,SZ,SZ);f.appendChild(fn);
const cy=FH/2;
const eye=mkText("DISEÑO",20,"Regular",{r:.27,g:.27,b:.27},{ls:32,align:'CENTER',fw:FW-SZ*2});pos(eye,SZ,cy-270);f.appendChild(eye);
const rule=mkRect(32,1,{r:.22,g:.22,b:.22},"rule");pos(rule,(FW-32)/2,eye.y+eye.height+28);f.appendChild(rule);
const title=mkText("Lógica de\nDiseño",100,"Bold",C.white,{lh:108,align:'CENTER',fw:FW-SZ*2});pos(title,SZ,rule.y+32);f.appendChild(title);
const body=mkText(D.concepto,36,"Light",{r:.53,g:.53,b:.53},{lh:170,align:'CENTER',fw:FW-SZ*2-80});pos(body,SZ+40,title.y+title.height+48);f.appendChild(body);
const logo=mkText("rødën",22,"Regular",{r:.2,g:.2,b:.2},{ls:12});pos(logo,FW-SZ-logo.width,FH-SZ-logo.height);f.appendChild(logo);}

// ════ F04 — DETALLE A ═══════════════════════════════════════════
{const f=mkFrame("F04 — Detalle A",C.white,3,0);
const half=FH/2;
const img=mkPH(FW,half,false,"detalle material");pos(img,0,0);f.appendChild(img);
const band=mkRect(FW,half,C.white,"text-band");pos(band,0,half);f.appendChild(band);
const title=mkText("Continuidad\nMaterial",90,"Bold",C.black,{lh:108,fw:FW-SZ*2});pos(title,SZ,half+SZ);f.appendChild(title);
const body=mkText("Vetas seleccionadas para un\nacabado monolítico.",34,"Regular",C.textMid,{lh:160,fw:FW-SZ*2});pos(body,SZ,half+SZ+title.height+28);f.appendChild(body);
const fn=mkFn(4,C.textGhost);pos(fn,SZ,SZ);f.appendChild(fn);
const logo=mkText("rødën",22,"Regular",{r:.82,g:.82,b:.82},{ls:12});pos(logo,FW-SZ-logo.width,FH-SZ-logo.height);f.appendChild(logo);}

// ════ F05 — DETALLE B ═══════════════════════════════════════════
{const f=mkFrame("F05 — Detalle B",C.gray,0,1);
const fn=mkFn(5,{r:.72,g:.72,b:.72});pos(fn,FW-SZ-fn.width,SZ);f.appendChild(fn);
const imgS=FW-SZ*2;
const img=mkPH(imgS,imgS,false,"detalle herraje");pos(img,SZ,SZ);f.appendChild(img);
const title=mkText("Herrajes\nInvisibles",90,"Bold",C.black,{lh:108,fw:FW-SZ*2});pos(title,SZ,SZ+imgS+56);f.appendChild(title);
const body=mkText("Sistemas push-to-open para una\nestética libre de ruidos visuales.",34,"Regular",{r:.46,g:.46,b:.46},{lh:160,fw:FW-SZ*2});pos(body,SZ,SZ+imgS+56+title.height+24);f.appendChild(body);}

// ════ F06 — TÉCNICO ═════════════════════════════════════════════
{const f=mkFrame("F06 — Técnico",C.white,1,1);
const fn=mkFn(6,C.textGhost);pos(fn,SZ,SZ);f.appendChild(fn);
const eye=mkText("DOCUMENTACIÓN",20,"Regular",C.textGhost,{ls:28});pos(eye,SZ,SZ+70);f.appendChild(eye);
const title=mkText("Implantación\ny Medidas",90,"Bold",C.black,{lh:108,fw:FW-SZ*2});pos(title,SZ,eye.y+eye.height+24);f.appendChild(title);
const sub=mkText("Ajuste milimétrico según relevamiento en obra.",32,"Light",{r:.66,g:.66,b:.66},{lh:155,fw:FW-SZ*2});pos(sub,SZ,title.y+title.height+24);f.appendChild(sub);
const dy=sub.y+sub.height+56;
const draw=mkPH(FW-SZ*2,FH-dy-SZ,false,"plano técnico");
draw.fills=[{type:'SOLID',color:{r:.976,g:.976,b:.976}}];
draw.strokes=[{type:'SOLID',color:C.divider}];draw.strokeWeight=1;
pos(draw,SZ,dy);f.appendChild(draw);}

// ════ F07 — INVERSIÓN ═══════════════════════════════════════════
{const f=mkFrame("F07 — Inversión",C.white,2,1);
const fn=mkFn(7,C.textGhost);pos(fn,SZ,SZ);f.appendChild(fn);
let y=260;
const eye=mkText("PROPUESTA ECONÓMICA",20,"Regular",C.textGhost,{ls:26});pos(eye,SZ,y);f.appendChild(eye);y+=eye.height+32;
const title=mkText("Inversión\nTotal",90,"Bold",C.black,{lh:108});pos(title,SZ,y);f.appendChild(title);y+=title.height+52;
const price=mkText(D.precio,88,"Bold",C.black,{ls:-2});pos(price,SZ,y);f.appendChild(price);y+=price.height+52;
const div1=mkRect(FW-SZ*2,1,C.divider,"div");pos(div1,SZ,y);f.appendChild(div1);y+=44;
const bullets=["Diseño y fabricación a medida","Instalación completa","Herrajes y terminaciones premium"];
for(const b of bullets){
  const dot=mkRect(7,7,C.black,"•");dot.cornerRadius=3.5;pos(dot,SZ,y+13);f.appendChild(dot);
  const bt=mkText(b,32,"Regular",{r:.33,g:.33,b:.33},{lh:150,fw:FW-SZ*2-28});pos(bt,SZ+24,y);f.appendChild(bt);y+=bt.height+16;}
y+=28;
const div2=mkRect(FW-SZ*2,1,C.divider,"div");pos(div2,SZ,y);f.appendChild(div2);y+=44;
const opLabel=mkText("OPCIONALES",20,"Regular",C.textGhost,{ls:26});pos(opLabel,SZ,y);f.appendChild(opLabel);y+=opLabel.height+24;
if(D.variante){const ot=mkText("+ "+D.variante,30,"Light",{r:.72,g:.72,b:.72},{lh:170,fw:FW-SZ*2});pos(ot,SZ,y);f.appendChild(ot);y+=ot.height+8;}
if(D.adicionales){const at=mkText("+ "+D.adicionales,30,"Light",{r:.72,g:.72,b:.72},{lh:170,fw:FW-SZ*2});pos(at,SZ,y);f.appendChild(at);}}

// ════ F08 — CTA ═════════════════════════════════════════════════
{const f=mkFrame("F08 — CTA",C.black,3,1);
const fn=mkFn(8,{r:.18,g:.18,b:.18});pos(fn,SZ,SZ);f.appendChild(fn);
const cy=FH/2;
const eye=mkText("RØDËN · DISEÑO A MEDIDA",20,"Regular",{r:.22,g:.22,b:.22},{ls:22,align:'CENTER',fw:FW-SZ*2});pos(eye,SZ,cy-300);f.appendChild(eye);
const title=mkText("¿Iniciamos\nla producción?",100,"Bold",C.white,{lh:108,align:'CENTER',fw:FW-SZ*2});pos(title,SZ,eye.y+eye.height+44);f.appendChild(title);
const btnW=640,btnH=88;
const btn=figma.createFrame();btn.name="btn — Reservar cupo";btn.resize(btnW,btnH);
btn.fills=fill(C.black);btn.strokes=[{type:'SOLID',color:{r:.45,g:.45,b:.45}}];btn.strokeWeight=1.5;
const btxt=mkText("RESERVAR CUPO DE FABRICACIÓN",22,"Medium",C.white,{ls:14,align:'CENTER',fw:btnW-40});
btxt.x=20;btxt.y=(btnH-btxt.height)/2;btn.appendChild(btxt);
pos(btn,(FW-btnW)/2,title.y+title.height+80);f.appendChild(btn);
const contact=mkText("rodenmobel.com  ·  +5411 5973 3995",26,"Regular",{r:.22,g:.22,b:.22},{ls:10,align:'CENTER',fw:FW-SZ*2});pos(contact,SZ,FH-SZ-contact.height);f.appendChild(contact);}

figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
return {ok:true, frames: figma.currentPage.children.length};
```

---

## PASO 6 — Colocar imágenes en los frames

Para cada imagen disponible, hacer **un llamado separado** a `use_figma`.
Sustituir `%%BASE64%%` con el string base64 obtenido en el Paso 3.
Sustituir `%%PLACEHOLDER_LABEL%%` con el label exacto del placeholder.

Labels disponibles:
- `"render principal"` → usar para F01 Y F02 (llamar dos veces, una por cada frame)
- `"detalle material"` → F04
- `"detalle herraje"` → F05
- `"plano técnico"` → F06

```javascript
// Llamado individual para cada imagen
const base64 = "%%BASE64%%";
const label  = "%%PLACEHOLDER_LABEL%%";

const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
const imgHash = figma.createImage(bytes).hash;

function findPH(node, name) {
  if (node.name === name) return node;
  if ('children' in node) {
    for (const child of node.children) {
      const found = findPH(child, name);
      if (found) return found;
    }
  }
  return null;
}

// Busca TODOS los placeholders con ese label (puede haber en F01 y F02)
function findAllPH(root, name) {
  const results = [];
  function walk(node) {
    if (node.name === name) results.push(node);
    if ('children' in node) node.children.forEach(walk);
  }
  walk(root);
  return results;
}

const targets = findAllPH(figma.currentPage, `☐ Placeholder — ${label}`);
for (const ph of targets) {
  ph.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: imgHash }];
}

return { placed: targets.length, label };
```

> **Nota**: El render principal se aplica a todos los placeholders con label `"render principal"`,
> lo que cubre F01 y F02 automáticamente en un solo llamado.

---

## PASO 7 — Entregar resultado

Devolver al usuario:
1. **Link directo al archivo Figma**: `https://www.figma.com/design/%%FILE_KEY%%`
2. **Instrucción de exportación**: seleccionar cada frame → botón derecho → Export → PNG @1x
3. Recordar que los placeholders sin imagen se pueden completar arrastrando en Figma

---

## Notas técnicas

- **Límite de código**: `use_figma` acepta máximo 50.000 caracteres por llamado. Por eso cada imagen se inyecta en un llamado separado.
- **Calidad de imagen**: el script comprime a ≤ 33KB (base64 ≤ 44.000 chars) con la mayor calidad posible usando binary search. Para renders típicos queda en JPEG ~65-75%.
- **Imágenes faltantes**: los placeholders grises quedan tal cual si no se sube imagen. Son fácilmente reemplazables en Figma.
- **planKey Figma**: para Gus Polack es `team::1568253898423462859`. Si cambia, llamar a `whoami` para obtenerlo.
- **Fuente**: Inter (disponible por defecto en Figma). Equivalente visual a Avenir Next.
