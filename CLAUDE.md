# CLAUDE.md — Contexto para Claude (rødën OS)

> Este archivo viaja con el repo. Cualquier instancia de Claude que abra este proyecto
> —en cualquier computadora— debe leerlo antes de tocar código. Es el reemplavo portátil
> de la "memoria" local: no dependas de que la memoria sincronice entre máquinas.

## Cómo trabajar conmigo (preferencia del dueño)

Gustavo pide tono **crítico, honesto y directo**. No suavizar críticas. Fundamentar todo
con lógica y datos. Si falta información, decirlo y verificar contra el código real antes
de afirmar — no inventar ni rellenar huecos con suposiciones. Siempre que se proponga un
cambio, justificar por qué es mejor. Priorizar la veracidad sobre la velocidad.

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
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`.

## Flujo de trabajo entre computadoras (LEER SIEMPRE)

El código se sincroniza por GitHub (`github.com/gustavopolack-blip/roden`, rama `main`).
La disciplina de git no es opcional cuando se trabaja desde más de una máquina:

- **Al empezar** en cualquier máquina: `git pull`
- **Al terminar**: `git add . && git commit -m "..." && git push origin main`
- Nunca dejar una máquina sin pushear: genera divergencia y conflictos.

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
- Safety timeout = 30 s (cold start de Supabase). NO bajar.
- `currentUserRef` es espejo de `currentUser`; actualizar juntos.
- Login se muestra con `!session`, NO con `!isAuthLoading`.

**CostEstimator.tsx** (el módulo más grande):
- `calculateModuleParts()` impacta corte, optimizador, reporte técnico y materiales.
- Presupuestos en `phase=APPROVED` son inmutables.
- `priceHistory` se persiste en Supabase (tabla `price_lists`).

**Motor único de costos:** `computeItemFinancials(item, snapshot, override|null)` unifica las
3 rutas de cálculo que antes divergían. `override=null` = config REAL (cores mixtos
MDP+MDF, incluye extras y fijos). Decisión del dueño: **el presupuesto debe reflejar el
costo real del módulo mixto, nunca por debajo.** El redondeo a placa entera por material
es **intencional** (así siempre costea de más, no de menos) — NO "arreglarlo".
`costEngine.ts` y `calculateFinancialsForScenario` son **código muerto**.

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
`fetchData()` recarga TODO (acoplado a Realtime sync). Dos archivos de tipos
(`types.ts` raíz = usar; `src/types.ts` = ignorar). `alert()`/`confirm()` en varias
páginas (no agregar más). Múltiples SQL de migración sueltos en la raíz, sin sistema
formal de migraciones — riesgo de divergencia entre entornos.

## Docs de referencia en el repo

`ARQUITECTURA.md` (maestro, leer antes de cambios grandes), `ROLES_PERMISSIONS.md`,
`DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_CHECKLIST.md`, `INSTRUCCIONES_SUPABASE.md`,
`INSTRUCCIONES_SEGURIDAD.md`, `db_schema.sql`, `supabase_setup_complete.sql`,
`services/ANALISIS_PROBLEMAS.md`.
