# CLAUDE.md — Contexto para Claude (rødën OS)

> Este archivo viaja con el repo. Cualquier instancia de Claude que abra este proyecto
> —en cualquier computadora— debe leerlo antes de tocar código. Es el reemplavo portátil
> de la "memoria" local: no dependas de que la memoria sincronice entre máquinas.

## Cómo trabajar conmigo (preferencia del dueño)

Gustavo pide tono **crítico, honesto y directo**. No suavizar críticas. Fundamentar todo
con lógica y datos. Si falta información, decirlo y verificar contra el código real antes
de afirmar — no inventar ni rellenar huecos con suposiciones. Siempre que se proponga un
cambio, justificar por qué es mejor. Priorizar la veracidad sobre la velocidad.

## Reglas de trabajo para Claude

Adaptadas de las observaciones de Karpathy sobre errores típicos de los modelos al programar.
Valen para todo cambio no trivial; para un typo, usar criterio.

1. **Pensar antes de programar.** Explicitar los supuestos. Si el pedido admite más de una
   lectura, presentarlas y preguntar: no elegir en silencio. Si hay un camino más simple,
   decirlo. Si algo no se entiende, frenar y nombrar la duda.
2. **Simplicidad primero.** El mínimo código que resuelve lo pedido. Nada especulativo: sin
   features, abstracciones, configurabilidad ni manejo de errores para casos imposibles que
   nadie pidió.
3. **Cambios quirúrgicos.** Cada línea cambiada tiene que poder rastrearse hasta el pedido.
   No "mejorar" código, comentarios ni formato vecinos; respetar el estilo existente. El
   código muerto que no es tuyo se menciona, no se borra. Sí limpiar lo que *tu* cambio dejó
   sin uso. Esto pesa el doble en `App.tsx` y `CostEstimator.tsx`, donde un cambio "de paso"
   rompe contratos.
4. **Ejecución guiada por un criterio verificable.** Convertir el pedido en un objetivo que se
   pueda comprobar antes de empezar: "arreglar el bug" → "un test que lo reproduce y pasa";
   "cambiar una regla del estimador" → "`npm test` pasa y la foto (baseline) se regenera con
   el cambio explicado". En tareas de varios pasos, plan breve con su verificación por paso.
   No dar algo por terminado sin haberlo verificado.
5. **Usar el vocabulario del dominio.** **`GLOSSARY.md`** define los términos del negocio
   (módulo, ítem, despiece, core MDP/MDF, escenario, precios congelados…) y su nombre en el
   código. Usarlos en conversaciones, commits y código nuevo. Si un término no está o no
   coincide con el código, preguntar y después actualizar el glosario.

## Qué es el sistema

**rødën OS** es una app web de gestión operativa para un taller de muebles a medida
(rodenmobel.com, de Gustavo Polack). No es un ERP genérico: modela el flujo
**Cliente → Proyecto → Presupuesto → Producción → Archivo**. Los módulos comparten estado
global en `App.tsx`; no son independientes.

Módulos (en `pages/`): Dashboard, Clients, Projects, CostEstimator (el más complejo),
Production, Tasks, Staff, SupplierPayments, Reports, Budgets (legacy), Archive,
AIAssistant, Settings, Login.

**Dos sistemas de presupuestos coexisten y NO se mezclan:** `budgets` (legacy, simple) y
`saved_estimates` (nuevo, complejo, generado por CostEstimator).

## Stack

React 19 + TypeScript (~5.8) + Vite 6 + Supabase (PostgreSQL + Auth + Realtime) +
Google Gemini AI. Deploy en Vercel. **Sin backend propio**: el cliente habla directo con
Supabase. Hay funciones serverless en `api/` (gemini.ts) y un `server.ts` experimental.

Variables de entorno (prefijo `VITE_` obligatorio, acceder con `import.meta.env.VITE_*`,
NUNCA `process.env.*` en código de cliente):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. La key de Gemini es `GEMINI_API_KEY` **sin**
`VITE_` (solo la lee `api/gemini.ts` en Vercel); con `VITE_` quedaría pública en el bundle.
Nunca poner un secreto detrás de `VITE_`.

## Flujo de trabajo entre computadoras (LEER SIEMPRE)

El código se sincroniza por GitHub (`github.com/gustavopolack-blip/roden`, rama `main`).
**`main` es producción:** cada push a `main` despliega solo en rodenmobel.com/os.
La disciplina de git no es opcional cuando se trabaja desde más de una máquina:

- **Al empezar** en cualquier máquina: `git pull` (en `main`).
- **Al terminar**: `git status` para ver qué se va a subir (no subir archivos sueltos ni
  `.env`), después commit y push. Nunca dejar una máquina sin pushear: genera divergencia
  y conflictos.

**Cuándo usar rama + PR (pull request) y cuándo push directo:**

| Cambio | Cómo |
|---|---|
| Código de la app, sobre todo `CostEstimator.tsx`, `App.tsx`, `utils/estimatorEngine.ts`, auth o SQL | **Rama + PR.** `git checkout -b nombre-corto`, commits, `git push -u origin nombre-corto`, abrir el PR en GitHub, revisar el diff y el deploy de prueba de Vercel, y recién ahí mergear. |
| Documentación, typos, textos | Push directo a `main` aceptable. |
| Cualquier cambio hecho por Claude en una sesión en la nube | Siempre rama + PR (no puede pushear a `main`). Gustavo decide el merge. |

Por qué: un PR genera un deploy de prueba (link en el PR) con los cambios **sin tocar la
app que usa el taller**, muestra todo el diff junto y se revierte entero si algo sale mal.
Un error en el motor de costos que llega directo a `main` llega directo a presupuestos.

Después de mergear un PR: `git checkout main && git pull` en cada máquina. No seguir
trabajando sobre una rama ya mergeada: para el próximo cambio, rama nueva desde `main`.

`.env` NO está en el repo (está en `.gitignore`, correcto). Para correr local:
`cp .env.example .env` (ya trae URL + anon key de Supabase). La key de Gemini vive del
lado servidor en Vercel.

## Contratos irrompibles (romperlos = regresiones serias)

El doc maestro es **`ARQUITECTURA.md`** — leer la sección correspondiente antes de tocar
cualquiera de estos archivos. Resumen de lo crítico:

**App.tsx** (único lugar con estado global):
- `fetchData()` recarga las tablas completas; todo handler CRUD termina llamándolo.
- Auth = 3 piezas coordinadas: `checkInitialSession`, `onAuthStateChange`,
  `isFetchingProfileRef` (mutex). Modificar una obliga a revisar las tres.
- Safety timeout global y timeout de `fetchData` = 60 s (cold start de Supabase). NO bajar.
- `currentUserRef` es espejo de `currentUser`; actualizar juntos.
- Login se muestra con `!session`, NO con `!isAuthLoading`.

**CostEstimator.tsx** (el módulo más grande):
- `calculateModuleParts()` impacta corte, optimizador, reporte técnico y materiales.
- Presupuestos aprobados son inmutables: al pasar a `commercialStatus` `APPROVED` /
  `IN_PRODUCTION` / `FINISHED` (`FREEZE_STATUSES`) se congela una foto de precios en
  `quoteData.frozenPrices` y ya no se recalculan. Re-cotizar = versión nueva. (Antes este
  archivo decía `phase=APPROVED`: ese campo no existe en `CostEstimator.tsx`.)
- `priceHistory` se persiste en Supabase (tabla `price_lists`).

**Motor único de costos:** `computeItemFinancials(item, snapshot, override|null)` unifica las
3 rutas de cálculo que antes divergían. `override=null` = config REAL (cores mixtos
MDP+MDF, incluye extras y fijos). Decisión del dueño: **el presupuesto debe reflejar el
costo real del módulo mixto, nunca por debajo.** El redondeo a placa entera por material
es **intencional** (así siempre costea de más, no de menos) — NO "arreglarlo".
`costEngine.ts` y `calculateFinancialsForScenario` son **código muerto**.

**Dónde vive el motor:** `utils/estimatorEngine.ts` (despiece, cantidades, precios,
`computeItemFinancials`, escenarios). Se extrajo textualmente de `CostEstimator.tsx`;
`tests/estimatorEngine.test.ts` lo compara contra una foto (`tests/fixtures/engine.baseline.json`).
Si cambiás una regla de cálculo a propósito, regenerá la foto y explicá el cambio.

**Pruebas:** `npm test` (vitest). Correrlas antes de pushear cambios del estimador.

**Constructor 3D** (`CONSTRUCTOR_3D.md`): `utils/furniture3d/` (geometría + export FBX/OBJ) y
`components/estimator3d/` (three.js, carga lazy). Ubica las piezas que ya calcula
`calculateModuleParts`; no calcula medidas ni costos propios. Los campos `layout3d` y
`doorHingeSide` del módulo son solo de dibujo.

**types.ts** (raíz): fuente de verdad. Importar SIEMPRE desde `../types`, nunca desde
`../src/types`.

**supabaseClient.ts**: instancia única. Nunca crear una segunda.

**Convenciones DB:** código y DB en inglés, UI en español. `public.users` se sincroniza
por trigger `on_auth_user_created` — NO insertar manualmente. Roles en DB: `ADMIN`,
`WORKSHOP_MANAGER`, `USER`; en `types.ts` están en español (`administrador`,
`gerente_taller`, etc.) — hay inconsistencia conocida, verificar mapeo antes de tocar auth.

## Roles

- **administrador**: acceso total; único con Staff, Finanzas, IA.
- **gerente_taller**: Proyectos (lectura), Taller (edición de avances), Tareas, Informes
  (lectura), Clientes.
- **operario_taller**: solo Taller (lectura) y Tareas asignadas. Sin finanzas ni clientes.
- `vendedor` y `cliente` existen en types.ts pero verificar si están implementados.

## Deploy

- La app vive en **https://www.rodenmobel.com/os**.
- Proyecto Vercel `roden` (este repo) → deploy automático al pushear a `main`.
- Buildea con `base: '/os/'` en vite.config; `roden/vercel.json` tiene rewrite
  `/os/:path*` → `/:path*`. El proyecto `roden-web` (otra carpeta) sirve rodenmobel.com y
  hace proxy de `/os` hacia este.

## Deuda técnica conocida (no refactorizar por gusto)

App.tsx y CostEstimator.tsx son archivos enormes; candidatos a split pero sensibles.
`fetchData()` recarga TODO (no hay canal Realtime general: solo el de notificaciones). Dos archivos de tipos
(`types.ts` raíz = usar; `src/types.ts` = ignorar). `alert()`/`confirm()` en varias
páginas (no agregar más). Múltiples SQL de migración sueltos en la raíz, sin sistema
formal de migraciones — riesgo de divergencia entre entornos.

## Docs de referencia en el repo

`ARQUITECTURA.md` (maestro, leer antes de cambios grandes), `GLOSSARY.md` (lenguaje del
dominio), `ROLES_PERMISSIONS.md`,
`DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_CHECKLIST.md`, `INSTRUCCIONES_SUPABASE.md`,
`INSTRUCCIONES_SEGURIDAD.md`, `db_schema.sql`, `supabase_setup_complete.sql`,
`services/ANALISIS_PROBLEMAS.md`.

**Skills del proyecto** (`.claude/skills/`, vendorizadas y fijadas a un commit; origen y
adaptaciones en `.claude/skills/README.md`): `/grill-with-docs` (alinear un cambio antes de
programarlo y actualizar `GLOSSARY.md`), `domain-modeling`, `tdd`, `diagnosing-bugs`,
`diagram-design`. No instalar plugins o skills de terceros sin revisarlos primero: hooks y
MCP ejecutan código con tus permisos.
