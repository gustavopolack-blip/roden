# ARQUITECTURA DEL SISTEMA — rødën Sistema Operativo
> Verificado contra el código el 2026-10-11. Si encontrás algo que no coincide, el código manda: corregí este archivo.

**Pegá este documento completo al inicio de cada sesión en AI Studio antes de describir el problema.**

---

## QUÉ ES ESTE SISTEMA

Aplicación web de gestión operativa para un taller de muebles a medida.
Stack: React + TypeScript + Supabase (PostgreSQL + Auth + Realtime).
Deploy objetivo: **Vercel**. Sin backend propio — todo va directo a Supabase desde el cliente.

---

## RESTRICCIONES DE VERCEL — LEER ANTES DE CUALQUIER CAMBIO

**1. Solo archivos estáticos**
Vercel sirve el output de `vite build`. No hay servidor Node corriendo. Cualquier lógica que requiera un servidor (cron jobs, webhooks, procesos en background) necesita una Vercel Serverless Function (`/api/*.ts`) o hacerse en Supabase Edge Functions.

**2. Variables de entorno**
- Las variables de entorno van en el dashboard de Vercel, **no en archivos `.env` commiteados**.
- En Vite, las variables expuestas al cliente **deben tener el prefijo `VITE_`**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Variables sin ese prefijo no están disponibles en el browser — solo en Serverless Functions.
- `supabaseClient.ts` lee con `import.meta.env.VITE_*`, no con `process.env.*`.
- **La key de Gemini NO lleva `VITE_`**: vive en Vercel como `GEMINI_API_KEY` y solo la lee la función `api/gemini.ts` (`process.env`). `geminiService.ts` no tiene key: llama a `${BASE_URL}api/gemini`. Ponerle `VITE_` la publicaría dentro del bundle. (`.env.example` todavía muestra `VITE_GEMINI_API_KEY`: ninguna línea de código la usa.)

**3. Routing SPA**
Vercel no sabe que es una SPA. Sin configuración, rutas como `/projects` devuelven 404 en refresh.
La app se sirve bajo **`/os/`** (`base: '/os/'` en `vite.config.ts`). `vercel.json` tiene dos rewrites, en este orden:
1. `/os/:path*` → `/:path*` (el proxy de rodenmobel.com/os llega acá con el prefijo).
2. `/((?!api/).*)` → `/index.html` (fallback de SPA, sin pisar `/api/*`).

Además define headers de seguridad (HSTS, `X-Frame-Options: DENY`, etc.).
**Si se rompen los rewrites, el deploy funciona pero la navegación directa a cualquier ruta (o `/api/gemini`) falla.**

**4. Sin filesystem**
No se puede escribir en disco. Cualquier "guardado de archivo" debe ir a Supabase Storage o generarse en el cliente (blob download). Los archivos temporales no persisten entre requests.

**5. Cold starts en Serverless Functions**
Si se agregan funciones en `/api/`, tienen cold start. No usarlas para operaciones que requieran respuesta inmediata en UI.

**6. Tamaño del bundle**
Vercel tiene límite de 50MB por función y recomienda bundles de cliente bajo 1MB.
`CostEstimator.tsx` (~4950 líneas) es un candidato a code splitting si el bundle crece.
Verificar con `vite build --report` antes de cada deploy importante.

**7. CORS**
Supabase ya tiene CORS configurado para dominios de Vercel (`*.vercel.app`).
Si se agrega un dominio custom, hay que agregarlo en Supabase → Settings → API → CORS.

**CHECKLIST ANTES DE CADA DEPLOY:**
- [ ] Variables de entorno cargadas en Vercel Dashboard
- [ ] `vercel.json` con rewrite de SPA presente
- [ ] No hay `process.env.*` en código de cliente (solo `import.meta.env.VITE_*`)
- [ ] `vite build` corre sin errores localmente
- [ ] Credenciales de Supabase no están hardcodeadas en ningún archivo

---

## MAPA DE ARCHIVOS

```
App.tsx                          ← Raíz. Estado global + auth + routing (react-router) + handlers CRUD
types.ts                         ← Tipos TypeScript de todo el sistema (fuente de verdad)
constants.ts                     ← PAGE_PERMISSIONS (qué roles ven cada página) y otras constantes
translations.ts                  ← Labels en español de estados (proyecto, cliente, etc.)
db_schema.sql                    ← Schema de Supabase
GLOSSARY.md                      ← Lenguaje del dominio y su nombre en el código
api/gemini.ts                    ← Función serverless: único lugar con la key de Gemini

pages/
  Dashboard.tsx                  ← Panel de control
  Clients.tsx                    ← Gestión de clientes
  Projects.tsx                   ← Gestión de proyectos
  CostEstimator.tsx              ← Estimador de costos (~4950 líneas — el más complejo; la UI)
  Production.tsx                 ← Vista de taller para operarios
  Tasks.tsx                      ← Gestión de tareas
  SupplierPayments.tsx           ← Proveedores y pagos
  Budgets.tsx                    ← Presupuestos legacy
  Reports.tsx                    ← Informes
  Staff.tsx                      ← Usuarios y roles
  Settings.tsx                   ← Configuración
  Archive.tsx                    ← Archivo de obras finalizadas
  AIAssistant.tsx                ← Chat libre con IA (chat persistido en Supabase)
  Login.tsx                      ← Pantalla de login
  Marketing.tsx                  ← Marketing

components/
  Sidebar.tsx                    ← Navegación lateral
  RodenAIButton.tsx              ← Botón puente de IA contextual
  MetricCard.tsx                 ← Tarjeta de métricas para Dashboard
  BottomNav.tsx, NotificationBell.tsx, NotasGestion.tsx, ErrorBoundary.tsx
  estimator3d/                   ← Constructor 3D (Builder3D, Viewer3D; carga lazy)

services/
  supabaseClient.ts              ← Instancia única de Supabase
  geminiService.ts               ← Servicio de IA (llama a api/gemini, sin key en el cliente)

utils/
  estimatorEngine.ts             ← MOTOR DEL ESTIMADOR: despiece, cantidades, precios,
                                   computeItemFinancials (motor único de costos), escenarios
  specialModules.ts              ← Plantillas de módulos especiales (Botinero, Biblioteca, …)
  furniture3d/                   ← Geometría 3D + export FBX/OBJ (ver CONSTRUCTOR_3D.md)
  cutOptimizer.ts                ← Optimizador de corte de placas
  useNotifications.ts            ← Notificaciones (único canal Realtime activo)
  costEngine.ts                  ← CÓDIGO MUERTO: nadie lo importa. No usar ni "arreglar".

tests/
  estimatorEngine.test.ts        ← Compara el motor contra tests/fixtures/engine.baseline.json
```

---

## CONTRATOS IRROMPIBLES
**Estas reglas no se tocan bajo ninguna circunstancia sin auditar el impacto completo.**

### App.tsx
- **Es el único lugar con estado global.** Nunca mover estado a componentes hijos sin consenso explícito.
- **`fetchData()` recarga las 12 tablas completas** (clients, projects, budgets, suppliers, supplier_payments, tasks, users, reports, production_orders, saved_estimates, estimates, price_lists). Todo handler CRUD termina con `fetchData()`. No romper este patrón — puede parecer ineficiente pero es el contrato de consistencia del sistema.
- **El flujo de auth tiene 3 piezas coordinadas que no se tocan por separado:**
  - `checkInitialSession` — maneja la sesión al arrancar
  - `onAuthStateChange` — escucha cambios posteriores
  - `isFetchingProfileRef` — mutex para evitar fetch paralelos de perfil
  - **Si se modifica una, hay que revisar las tres.**
- **Timeouts de carga:** `globalSafetyTimeout` (desbloquea la UI) y el timeout de `fetchData` están en **60 segundos**; el fetch de perfil en 20 s. No bajarlos — Supabase puede tardar en responder en cold start.
- **`currentUserRef`** es un ref espejo de `currentUser` para uso dentro de callbacks de auth donde el estado React no está disponible. Siempre actualizarlos juntos.
- **El login se muestra con `!session`**, no con `!isAuthLoading`. Cambiar esa condición rompe el flujo de carga.

### CostEstimator.tsx
- **Es el archivo más grande (~4950 líneas).** Cualquier cambio requiere leer el contexto circundante — nunca editar una función aislada.
- **La lógica de cálculo vive en `utils/estimatorEngine.ts`**, no en este archivo (se extrajo textualmente; `npm test` la compara contra una foto). CostEstimator es la UI.
- **`calculateModuleParts()`** (en el engine) es la función base de todo el motor de piezas. Si se modifica, impacta: listado de corte, optimizador, reporte técnico, cálculo de materiales y Constructor 3D. **No tocar sin revisar esas dependencias y regenerar la foto explicando el cambio.**
- **Motor único de costos: `computeItemFinancials(item, snapshot, override)`.** `override=null` = config REAL del módulo (cores mixtos MDP+MDF, con extras y fijos). Planilla, comparativa y presupuesto lo usan igual. No duplicar lógica de costos en CostEstimator. `calculateFinancialsForScenario()` sigue en el archivo pero está **deprecada, sin llamadas**.
- **Los 14 escenarios** (4 melamina blanca/color × MDP/MDF, 8 estructura melamina + frentes laqueados/enchapados, todo laqueado, todo enchapado) más la config real se calculan con `getRecalculatedItemPrices()` al crear el ítem (o al editarlo en el 3D) y se guardan en `item.scenarioPrices`.
- **Redondeo a placa entera por material (+20 % desperdicio) es intencional**: siempre costea de más, nunca de menos. No "arreglarlo".
- **`priceHistory`** se persiste en Supabase (tabla `price_lists`). No volver a `useState` local.
- **Presupuestos aprobados son inmutables.** No existe un campo `phase`: cuando `commercialStatus` es `APPROVED`, `IN_PRODUCTION` o `FINISHED` (`FREEZE_STATUSES`), el presupuesto guarda una foto de precios en `quoteData.frozenPrices` y ya no se recalcula (ni por cambios del motor ni de la lista). Re-cotizar = versión nueva (`handleGenerateNewVersion`, nace sin foto). No agregar lógica que modifique uno congelado.

### types.ts
- **Es la fuente de verdad de tipos.** Existe también un `/src/types.ts` con definiciones distintas — **siempre importar desde `../types` (raíz), nunca desde `../src/types`.**
- **`BusinessData`** es la interfaz que recibe la IA. Si se agregan entidades al sistema, agregarlas acá también.

### estimatorEngine.ts
- **Regla de negocio irrompible:** LACQUER y VENEER requieren frentes MDF. El despiece lo garantiza por material (frentes laqueados → `18mm_MDFCrudo`, enchapados → `18mm_Kiri`) y la UI de CostEstimator fija `frontsCore: 'MDF'` al elegir esas terminaciones.
- **Los nombres de pieza son contrato:** `isVisibleFrontPiece()` decide el tapacanto visible por el prefijo `Frente`/`Puerta`. Renombrar una pieza cambia costos.
- **`costEngine.ts` (el viejo motor "de 4 capas") es código muerto.** No importarlo ni replicar sus reglas.

### supabaseClient.ts
- **Instancia única.** Nunca crear una segunda instancia de Supabase en otro archivo.
- **Las credenciales van en `.env`**, no hardcodeadas. En desarrollo pueden estar en el archivo pero no commitear.

### geminiService.ts
- **`askRodenAI()`** — función legacy para el chat libre de AIAssistant.tsx. No modificar su firma.
- **`runContextualAnalysis()`** — función nueva para RodenAIButton. Recibe `{ mode, data }`.
- **Cada función arma su propio `systemInstruction`** (texto duplicado, no hay una constante compartida). Si se cambia el tono o las reglas de rødën AI, **actualizar los dos**.
- Ninguna tiene la API key: ambas llaman a `api/gemini.ts` vía `callGemini()`.

### RodenAIButton.tsx
- **Es de solo lectura.** No agregar lógica que modifique datos del sistema desde este componente.
- **Recibe `mode` y `data` como props.** El llamador es responsable de filtrar los datos relevantes antes de pasarlos.

---

## FLUJO DE DATOS

```
Supabase DB
    ↓ (fetchData — carga inicial y post-CRUD)
App.tsx (estado global)
    ↓ (props)
Páginas / Componentes
    ↓ (callbacks: onAdd, onUpdate, onDelete, onSave)
App.tsx handlers (handleAdd*, handleUpdate*, handleDelete*)
    ↓ (supabase.from(...).insert/update/delete)
Supabase DB
    ↓ (el handler llama a fetchData)
fetchData() → actualiza estado global
```

**Realtime**: hoy **no hay** un canal general de sincronización. El canal `db-changes` (con debounce de 800 ms) que describía este documento ya no existe en `App.tsx`. El único canal Realtime activo es `notifications-feed` (`utils/useNotifications.ts`, tabla `notifications`). Consecuencia: los cambios de otro usuario no aparecen solos; se ven en el próximo `fetchData()` (CRUD propio o recarga). Si se reintroduce un canal general, documentarlo acá.

---

## ROLES DE USUARIO

| Rol | Acceso |
|-----|--------|
| `administrador` | Todo el sistema incluyendo Finanzas, Staff, IA |
| `gerente_taller` | Proyectos, Taller, Tareas, Clientes |
| `operario_taller` | Solo vista de Taller y sus Tareas asignadas |

**El routing usa `react-router-dom`** (`<Routes>` en `renderProtectedRoutes()` de App.tsx). El permiso por rol sale de **`PAGE_PERMISSIONS` en `constants.ts`**, que usan tanto App.tsx (bloquea la ruta) como `Sidebar.tsx` (oculta el link). Si se agrega una página nueva: agregar su `<Route>` y su entrada en `PAGE_PERMISSIONS`.

---

## BASE DE DATOS — TABLAS Y RELACIONES

```
clients                    ← base
  ↑
projects (client_id)       ← obra vinculada a cliente
  ↑
tasks (project_id)         ← tareas de la obra
supplier_payments (project_id) ← costos de la obra
production_orders (project_id) ← órdenes de producción
reports (project_id)       ← informes

saved_estimates            ← presupuestos del estimador
  ↑
price_lists                ← listas de precios (priceListId en saved_estimates)

budgets (project_id)       ← sistema legacy de presupuestos (separado del estimador)
users                      ← usuarios del sistema
ai_chat_history            ← historial del chat IA por usuario
```

**Reglas de `public.users`:**
- **User Sync:** No insertar manualmente en `public.users`. Existe un Trigger en Supabase (`on_auth_user_created`) que automatiza esto.
- **Role Values:** Los strings exactos son `ADMIN`, `WORKSHOP_MANAGER`, `USER`.
- **Language Policy:** Código y DB en inglés, UI en español.

**Dos sistemas de presupuestos coexisten:**
- `budgets` — legacy, simple, vinculado a proyectos
- `saved_estimates` — nuevo, complejo, generado por CostEstimator con módulos y variantes

**No mezclar la lógica de uno con el otro.**

---

## CONVENCIONES DE CÓDIGO

- **Nombres en inglés** para variables/funciones, **español** para labels de UI y comentarios.
- **Handlers en App.tsx** siguen el patrón: `handle[Acción][Entidad]` → `handleAddClient`, `handleUpdateProject`.
- **Props de callbacks** siguen: `on[Acción][Entidad]` → `onAddClient`, `onUpdateProject`.
- **IDs generados en cliente** para saved_estimates: `` `est${Date.now()}` ``. Para price_lists: `` `pl_${Date.now()}` ``.
- **Supabase devuelve camelCase** mapeado desde snake_case en la mayoría de las tablas, pero `saved_estimates` usa camelCase con comillas en el schema (`"projectId"`, `"isLatest"`, etc.).
- **`alert()` y `confirm()`** se usan todavía en varios módulos. Es deuda técnica conocida — no agregar más, pero no es prioridad reemplazarlos ahora.

---

## DEUDA TÉCNICA CONOCIDA — NO TOCAR SIN CONSENSO

1. **App.tsx tiene ~1650 líneas** — mezcla auth, CRUD, estado y routing. Refactor pendiente.
2. **`fetchData()` recarga todo** — debería actualizarse solo la entidad modificada. No cambiar sin probar el impacto en todas las páginas.
3. **Dos archivos de tipos** — `types.ts` (raíz, usar este) y `src/types.ts` (ignorar).
4. **`alert()` y `confirm()`** en múltiples páginas — pendiente migrar a sistema de modales.
5. **CostEstimator.tsx con ~4950 líneas** — candidato a dividir en submódulos, no todavía. El motor ya se extrajo a `utils/estimatorEngine.ts`.
6. **Código muerto conocido:** `utils/costEngine.ts` y `calculateFinancialsForScenario()`. (Antes este punto decía que `handleGenerateNewVersion()` era legado frente a un `handleNewVersion()`: ese segundo no existe; `handleGenerateNewVersion()` es el que usa la UI.)
7. **Sin sincronización Realtime general** (ver Flujo de datos).
8. **SQL de migración sueltos en la raíz**, sin sistema formal de migraciones — riesgo de divergencia entre entornos.

---

## MÓDULOS RECIENTEMENTE MODIFICADOS

Esta lista se desactualizaba (nombraba un `migration_trazabilidad.sql` que no está en el repo). Para ver qué cambió hace poco, la fuente de verdad es git: `git log --oneline -20` o `git log -- <archivo>`.

---

## CÓMO USAR ESTE DOCUMENTO EN AI STUDIO

**Inicio de sesión estándar:**
```
[Pegá este documento completo]

Archivo/s a modificar hoy: [nombre del archivo]
Archivos que NO deben tocarse: [lista]
Problema a resolver: [descripción]
```

**Si el cambio toca más de un archivo**, declararlo explícitamente antes de pedir la solución.
**Si el cambio involucra auth o CostEstimator**, pedir que el modelo explique el impacto en los contratos antes de escribir código.
