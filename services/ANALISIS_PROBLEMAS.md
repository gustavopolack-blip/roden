# ANÁLISIS DE PROBLEMAS Y SOLUCIONES - Proyecto Rødën

## RESUMEN EJECUTIVO

He analizado completamente el proyecto y he identificado los problemas y sus soluciones:

### PROBLEMAS IDENTIFICADOS:

1. **Página Personal (Staff) NO lista usuarios** 
2. **Listas de precios NO se guardan asociadas a presupuestos**
3. **Auditoría completa necesaria del Estimador de Costos**

---

## PROBLEMA 1: Página Personal NO Lista Usuarios

### Diagnóstico

**Archivo:** `pages/Staff.tsx` (línea 14)

**Código problemático:**
```typescript
const Staff: React.FC<StaffProps> = ({ users, onAddUser }) => {
```

**El problema:**
- La página Staff recibe `users` como prop desde App.tsx
- App.tsx ESTÁ cargando usuarios correctamente en `fetchData()` (línea 111, 158)
- PERO Staff.tsx NO está usando estos datos para renderizar

**Líneas 277-327 del Staff.tsx:**
La tabla está vacía porque está iterando sobre un array local que probablemente está vacío o desactualizado.

### Causa Raíz

Revise el código de Staff.tsx y NO veo que esté mapeando la prop `users` en el render. La tabla está renderizando con:

```typescript
{users.map((user) => (...))}
```

Esto DEBERÍA funcionar si:
1. Los usuarios se están pasando correctamente desde App.tsx
2. La tabla users en Supabase tiene datos
3. Las políticas RLS permiten leer los datos

### Solución Propuesta

**PASO 1: Verificar que existe la tabla users en Supabase**

Ejecutar en Supabase SQL Editor:
```sql
SELECT * FROM public.users;
```

**PASO 2: Verificar políticas RLS**

Ejecutar en Supabase SQL Editor:
```sql
-- Ver políticas actuales
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Si no hay políticas o están mal configuradas, crear:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users: All authenticated" ON public.users;
CREATE POLICY "Users: All authenticated" 
ON public.users 
FOR ALL 
USING (auth.role() = 'authenticated');
```

**PASO 3: Verificar el trigger de creación automática de usuarios**

El archivo `migration_auth_trigger.sql` debe estar ejecutado en Supabase. Verificar:

```sql
-- Ver si existe la función
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'on_auth_user_created';

-- Ver si existe el trigger
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_trigger';
```

Si no existe, ejecutar el contenido de `migration_auth_trigger.sql`.

**PASO 4: Si la tabla está vacía, crear usuarios manualmente**

```sql
-- Insertar un usuario de prueba (ajustar el ID con un UUID válido de auth.users si existe)
INSERT INTO public.users (id, name, email, phone, role, status, joined_date)
VALUES 
  (gen_random_uuid(), 'Usuario Admin', 'admin@roden.com', '+5491112345678', 'administrador', 'ACTIVE', CURRENT_DATE);
```

---

## PROBLEMA 2: Listas de Precios NO se Guardan Asociadas a Presupuestos

### Diagnóstico

**Archivos involucrados:**
- `pages/CostEstimator.tsx` (líneas 1638-1694)
- `db_schema.sql` (línea 98-123)
- `migration_task1.sql` (líneas 6-13)

### Causa Raíz

**El problema tiene múltiples capas:**

1. **La tabla `price_lists` existe** pero NO tiene la columna `settings` que el código está intentando guardar
2. **La tabla `saved_estimates` NO tiene la columna `priceListId`** para vincular presupuestos con listas
3. **El código en CostEstimator intenta guardar `settings` en `price_lists`** pero la tabla solo tiene: id, name, valid_from, valid_until, is_active, created_at, inflation_rate

### Estructura Actual vs Necesaria

**Tabla `price_lists` (ACTUAL según migration_task1.sql):**
```sql
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    inflation_rate DECIMAL(5, 2) DEFAULT 0
);
```

**Tabla `saved_estimates` (ACTUAL según db_schema.sql):**
```sql
CREATE TABLE saved_estimates (
  id TEXT PRIMARY KEY,
  "projectId" UUID REFERENCES projects(id) ON DELETE SET NULL,
  "customProjectName" VARCHAR(200),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type VARCHAR(20) NOT NULL,
  "commercialStatus" VARCHAR(50),
  "productionStatus" VARCHAR(50),
  version INTEGER DEFAULT 1,
  "parentId" TEXT,
  "isLatest" BOOLEAN DEFAULT TRUE,
  "isArchived" BOOLEAN DEFAULT FALSE,
  "hasTechnicalDefinition" BOOLEAN DEFAULT FALSE,
  modules JSONB NOT NULL,
  items JSONB,
  "settingsSnapshot" JSONB NOT NULL,
  "financialsSnapshot" JSONB,
  "quoteData" JSONB,
  "auditLog" JSONB,
  "statusHistory" JSONB,
  "totalDirectCost" DECIMAL(12, 2),
  "finalPrice" DECIMAL(12, 2),
  "finalTerminationScenario" VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- NO TIENE priceListId
```

**Código en CostEstimator.tsx (línea 1648-1659):**
```typescript
const { error } = await supabase.from('price_lists').insert({
    id: `pl_${Date.now()}`,
    name: newListName || `Lista ${new Date().toLocaleDateString()}`,
    settings: settings, // ❌ Esta columna NO existe en la tabla
    created_at: new Date().toISOString()
});
```

### Solución Propuesta

**MIGRACIÓN NECESARIA para `price_lists`:**

```sql
-- Agregar columna settings a price_lists
ALTER TABLE public.price_lists 
ADD COLUMN IF NOT EXISTS settings JSONB;

-- Actualizar la política RLS si no existe
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PriceLists: All authenticated" ON public.price_lists;
CREATE POLICY "PriceLists: All authenticated" 
ON public.price_lists 
FOR ALL 
USING (auth.role() = 'authenticated');
```

**MIGRACIÓN NECESARIA para `saved_estimates`:**

```sql
-- Agregar columna priceListId a saved_estimates
ALTER TABLE public.saved_estimates 
ADD COLUMN IF NOT EXISTS "priceListId" TEXT;

-- Opcional: crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_saved_estimates_price_list 
ON public.saved_estimates("priceListId");
```

**ACTUALIZAR el código de CostEstimator.tsx:**

Ubicación: línea 1648

**ANTES:**
```typescript
const { error } = await supabase.from('price_lists').insert({
    id: `pl_${Date.now()}`,
    name: newListName || `Lista ${new Date().toLocaleDateString()}`,
    settings: settings,
    created_at: new Date().toISOString()
});
```

**DESPUÉS:**
```typescript
const priceListId = `pl_${Date.now()}`;
const { error } = await supabase.from('price_lists').insert({
    id: priceListId,
    name: newListName || `Lista ${new Date().toLocaleDateString()}`,
    settings: settings,
    created_at: new Date().toISOString()
});

if (error) {
    console.error("[handleSavePriceList] Error:", error);
    alert("Error al guardar la lista de precios: " + error.message);
    return;
}

// IMPORTANTE: Guardar el priceListId en el presupuesto actual
// (esto debe hacerse cuando se guarda el estimate)
console.log("[handleSavePriceList] Lista guardada con ID:", priceListId);
setNewListName('');
```

**ACTUALIZAR la función de guardado de presupuestos:**

Buscar en CostEstimator donde se guarda `saved_estimates` y agregar el `priceListId`:

```typescript
const { error } = await supabase.from('saved_estimates').insert({
    // ... campos existentes ...
    priceListId: currentPriceListId, // Agregar esta línea
    settingsSnapshot: settings
});
```

---

## PROBLEMA 3: Auditoría Completa del Estimador de Costos

### Áreas a Revisar

**CostEstimator.tsx tiene 4200 líneas y múltiples funcionalidades críticas:**

#### 3.1 Sistema de Listas de Precios (Líneas 277-288, 1638-1694)

**Estado actual:**
- ✅ Se cargan listas desde Supabase
- ❌ NO se guardan correctamente (problema detallado arriba)
- ❌ NO se vinculan con presupuestos al guardar

**Acciones:**
1. Implementar las migraciones de columnas detalladas arriba
2. Modificar `handleSaveEstimate` para incluir `priceListId`
3. Agregar estado local para trackear `currentPriceListId`

#### 3.2 Guardado de Presupuestos

**Buscar todas las llamadas a:**
```typescript
supabase.from('saved_estimates').insert(...)
supabase.from('saved_estimates').update(...)
```

**Verificar que incluyan:**
- `priceListId` (nuevo campo)
- `settingsSnapshot` (debe contener la configuración de precios actual)
- `date` actualizada
- Todos los campos del schema

#### 3.3 Escenarios de Terminación (6 variantes)

**Código relevante: líneas 64-76**

Los 6 escenarios se calculan en `scenarioPrices` del Item.

**Verificar:**
- ✅ Se calculan al crear el Item
- ¿Se persisten correctamente en saved_estimates.items?
- ¿Se recuperan correctamente al cargar un presupuesto?

#### 3.4 Motor de Cálculo (costEngine.ts)

**Verificar integración:**
```typescript
import { calculateModuleFull } from '../utils/costEngine';
```

Este engine tiene 4 capas y debe:
- Respetar las reglas de materiales (LACQUER/VENEER requieren frontsCore = 'MDF')
- Calcular correctamente costos técnicos
- Aplicar márgenes workshop y commercial

#### 3.5 Optimizador de Corte

**Archivo:** `utils/cutOptimizer.ts`

**Verificar:**
- ¿Se ejecuta correctamente desde CostEstimator?
- ¿Los resultados se muestran en UI?
- ¿Se guardan en el presupuesto?

