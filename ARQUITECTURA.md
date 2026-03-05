# ARQUITECTURA DEL SISTEMA — rødën Sistema Operativo
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
- En Vite, las variables expuestas al cliente **deben tener el prefijo `VITE_`**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_KEY`.
- Variables sin ese prefijo no están disponibles en el browser — solo en Serverless Functions.
- `supabaseClient.ts` y `geminiService.ts` deben leer con `import.meta.env.VITE_*`, no con `process.env.*`.

**3. Routing SPA**
Vercel no sabe que es una SPA. Sin configuración, rutas como `/projects` devuelven 404 en refresh.
Requiere `vercel.json` en la raíz con:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
**Si este archivo no existe, el deploy funciona pero la navegación directa a cualquier ruta falla.**

**4. Sin filesystem**
No se puede escribir en disco. Cualquier "guardado de archivo" debe ir a Supabase Storage o generarse en el cliente (blob download). Los archivos temporales no persisten entre requests.

**5. Cold starts en Serverless Functions**
Si se agregan funciones en `/api/`, tienen cold start. No usarlas para operaciones que requieran respuesta inmediata en UI.

**6. Tamaño del bundle**
Vercel tiene límite de 50MB por función y recomienda bundles de cliente bajo 1MB.
`CostEstimator.tsx` con 4200 líneas es un candidato a code splitting si el bundle crece.
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
App.tsx                          ← Raíz. Estado global + auth + routing + todos los handlers CRUD
types.ts                         ← Tipos TypeScript de todo el sistema (fuente de verdad)
db_schema.sql                    ← Schema de Supabase

pages/
  Dashboard.tsx                  ← Panel de control
  Clients.tsx                    ← Gestión de clientes
  Projects.tsx                   ← Gestión de proyectos
  CostEstimator.tsx              ← Estimador de costos (4200 líneas — el más complejo)
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

components/
  Sidebar.tsx                    ← Navegación lateral
  RodenAIButton.tsx              ← Botón puente de IA contextual (nuevo)
  MetricCard.tsx                 ← Tarjeta de métricas para Dashboard

services/
  supabaseClient.ts              ← Instancia única de Supabase
  geminiService.ts               ← Servicio de IA (Gemini API)

utils/
  costEngine.ts                  ← Motor de cálculo de costos (4 capas)
  cutOptimizer.ts                ← Optimizador de corte de placas
```

---

## CONTRATOS IRROMPIBLES
**Estas reglas no se tocan bajo ninguna circunstancia sin auditar el impacto completo.**

### App.tsx
- **Es el único lugar con estado global.** Nunca mover estado a componentes hijos sin consenso explícito.
- **`fetchData()` recarga las 10 tablas completas.** Todo handler CRUD termina con `fetchData()`. No romper este patrón — puede parecer ineficiente pero es el contrato de consistencia del sistema.
- **El flujo de auth tiene 3 piezas coordinadas que no se tocan por separado:**
  - `checkInitialSession` — maneja la sesión al arrancar
  - `onAuthStateChange` — escucha cambios posteriores
  - `isFetchingProfileRef` — mutex para evitar fetch paralelos de perfil
  - **Si se modifica una, hay que revisar las tres.**
- **El safety timeout está en 30 segundos.** No bajarlo — Supabase puede tardar en responder en cold start.
- **`currentUserRef`** es un ref espejo de `currentUser` para uso dentro de callbacks de auth donde el estado React no está disponible. Siempre actualizarlos juntos.
- **El login se muestra con `!session`**, no con `!isAuthLoading`. Cambiar esa condición rompe el flujo de carga.

### CostEstimator.tsx
- **Es el archivo más grande (4200 líneas).** Cualquier cambio requiere leer el contexto circundante — nunca editar una función aislada.
- **`calculateModuleParts()`** es la función base de todo el motor de piezas. Si se modifica, impacta: listado de corte, optimizador, reporte técnico, y cálculo de materiales. **No tocar sin revisar las 4 dependencias.**
- **`calculateFinancialsForScenario()`** llama a `costEngine.ts`. No duplicar lógica de costos en CostEstimator — todo cálculo de costo va al engine.
- **Los 6 escenarios** (whiteAglo, whiteMDF, colorAglo, colorMDF, lacquer, veneer) se calculan al crear un Item, no al guardar. Están pre-calculados en `item.scenarioPrices`.
- **`priceHistory`** ahora se persiste en Supabase (tabla `price_lists`). No volver a `useState` local.
- **Los presupuestos tienen `phase`** (QUOTING/APPROVED/ARCHIVED). Los en phase=APPROVED son inmutables — no agregar lógica que los modifique.

### types.ts
- **Es la fuente de verdad de tipos.** Existe también un `/src/types.ts` con definiciones distintas — **siempre importar desde `../types` (raíz), nunca desde `../src/types`.**
- **`BusinessData`** es la interfaz que recibe la IA. Si se agregan entidades al sistema, agregarlas acá también.

### costEngine.ts
- **4 capas en orden fijo:** Layer1 (geometría) → Layer2 (validación de materiales) → Layer3 (costos técnicos) → Layer4 (precio comercial con márgenes).
- **Regla de negocio irrompible:** LACQUER y VENEER requieren `frontsCore = 'MDF'`. El engine auto-corrige pero CostEstimator también valida en UI.
- **No agregar lógica de negocio en CostEstimator que duplique lo que hace el engine.**

### supabaseClient.ts
- **Instancia única.** Nunca crear una segunda instancia de Supabase en otro archivo.
- **Las credenciales van en `.env`**, no hardcodeadas. En desarrollo pueden estar en el archivo pero no commitear.

### geminiService.ts
- **`askRodenAI()`** — función legacy para el chat libre de AIAssistant.tsx. No modificar su firma.
- **`runContextualAnalysis()`** — función nueva para RodenAIButton. Recibe `{ mode, data }`.
- **Ambas funciones usan el mismo `RODEN_SYSTEM_INSTRUCTION`.** Si se actualiza el prompt, impacta los dos flujos.

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
    ↓ (Realtime channel — debounce 800ms)
fetchData() → actualiza estado global
```

**Realtime**: el canal `db-changes` escucha todos los cambios en `public` y dispara `fetchData` con debounce de 800ms. Esto sincroniza entre múltiples usuarios. **No eliminar este canal.**

---

## ROLES DE USUARIO

| Rol | Acceso |
|-----|--------|
| `administrador` | Todo el sistema incluyendo Finanzas, Staff, IA |
| `gerente_taller` | Proyectos, Taller, Tareas, Clientes |
| `operario_taller` | Solo vista de Taller y sus Tareas asignadas |

**El routing por rol está en `renderContent()` dentro de App.tsx.** Si se agrega una página nueva, agregar el case correspondiente con la validación de rol.

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

1. **App.tsx tiene 936 líneas** — mezcla auth, CRUD, estado y routing. Refactor pendiente.
2. **`fetchData()` recarga todo** — debería actualizarse solo la entidad modificada. No cambiar sin probar impacto en Realtime.
3. **Dos archivos de tipos** — `types.ts` (raíz, usar este) y `src/types.ts` (ignorar).
4. **`alert()` y `confirm()`** en múltiples páginas — pendiente migrar a sistema de modales.
5. **CostEstimator.tsx con 4200 líneas** — candidato a dividir en submódulos, no todavía.
6. **`handleGenerateNewVersion()`** en CostEstimator es código legado que convive con el nuevo `handleNewVersion()`. El nuevo es el correcto.

---

## MÓDULOS RECIENTEMENTE MODIFICADOS
*Al trabajar en estos archivos, tener especial cuidado — los cambios son frescos y pueden tener interacciones no testeadas.*

- **`App.tsx`** — fix de bucle de auth (initialSessionHandled), botón hamburguesa móvil, case 'ai' en router
- **`CostEstimator.tsx`** — sistema de listas de precios persistente, flujo de aprobación con phase/approvedVariants, modal de aprobación, estética unificada
- **`geminiService.ts`** — agregado `runContextualAnalysis()` con 8 modes, system instruction actualizado
- **`RodenAIButton.tsx`** — componente nuevo, no tiene dependencias excepto geminiService
- **`migration_trazabilidad.sql`** — requiere ejecutarse en Supabase antes de usar las features de listas de precios y aprobación

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
