-- ============================================================================
-- RØDËN OS - SETUP COMPLETO DE SUPABASE
-- ============================================================================
-- Este script crea TODAS las tablas, columnas, policies y triggers necesarios
-- Ejecutar en Supabase SQL Editor en orden
-- ============================================================================

-- PASO 1: Habilitar extensiones necesarias
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PASO 2: Limpiar tablas existentes (CUIDADO: esto borra datos)
-- ============================================================================
-- Comentar estas líneas si ya tenés datos que querés conservar
DROP TABLE IF EXISTS ai_chat_history CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS supplier_payments CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS saved_estimates CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS price_catalog CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;

-- PASO 3: Crear tablas base
-- ============================================================================

-- 1. CLIENTES
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  status VARCHAR(20) DEFAULT 'LEAD',
  type VARCHAR(20) DEFAULT 'INDIVIDUAL',
  origin VARCHAR(50),
  joined_date DATE DEFAULT CURRENT_DATE,
  tags TEXT[],
  notes TEXT,
  total_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CATÁLOGO DE PRECIOS
CREATE TABLE price_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PROYECTOS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  title VARCHAR(200) NOT NULL,
  status VARCHAR(50) DEFAULT 'PROPOSAL',
  production_step VARCHAR(50),
  step_dates JSONB,
  start_date DATE,
  production_start_date DATE,
  deadline DATE,
  progress INTEGER DEFAULT 0,
  budget DECIMAL(12, 2) DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  drive_folder_url TEXT,
  production_notes JSONB,
  archive_reason TEXT,
  dossier JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PRESUPUESTOS LEGACY
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'DRAFT',
  cost_snapshot JSONB DEFAULT NULL,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  total_price DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ITEMS DE PRESUPUESTO
CREATE TABLE budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  margin_workshop DECIMAL(5, 2) DEFAULT 35.0,
  margin_commercial DECIMAL(5, 2) DEFAULT 25.0,
  complexity_factor DECIMAL(4, 2) DEFAULT 1.0,
  estimated_days DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. MÓDULOS
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES budget_items(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  quantity INTEGER DEFAULT 1,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  depth_mm INTEGER NOT NULL,
  components_config JSONB NOT NULL,
  material_body VARCHAR(100) NOT NULL,
  material_fronts VARCHAR(100) NOT NULL,
  material_edges VARCHAR(100),
  area_body_m2 DECIMAL(10, 4),
  area_fronts_m2 DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. LISTAS DE PRECIOS (CON COLUMNA SETTINGS - FIX DEL BUG)
CREATE TABLE price_lists (
  id TEXT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  settings JSONB NOT NULL,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. ESTIMACIONES GUARDADAS (CON COLUMNA priceListId - FIX DEL BUG)
CREATE TABLE saved_estimates (
  id TEXT PRIMARY KEY,
  "projectId" UUID REFERENCES projects(id) ON DELETE SET NULL,
  "customProjectName" VARCHAR(200),
  "priceListId" TEXT REFERENCES price_lists(id) ON DELETE SET NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type VARCHAR(20) NOT NULL,
  "commercialStatus" VARCHAR(50),
  "productionStatus" VARCHAR(50),
  version INTEGER DEFAULT 1,
  "parentId" TEXT,
  "isLatest" BOOLEAN DEFAULT TRUE,
  "isArchived" BOOLEAN DEFAULT FALSE,
  "hasTechnicalDefinition" BOOLEAN DEFAULT FALSE,
  phase VARCHAR(20) DEFAULT 'QUOTING',
  "approvedVariants" JSONB,
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

-- 9. PROVEEDORES
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  phone VARCHAR(50),
  email VARCHAR(100),
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. PAGOS A PROVEEDORES
CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_name VARCHAR(200) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  concept TEXT,
  down_payment DECIMAL(12, 2) DEFAULT 0,
  down_payment_date DATE,
  balance DECIMAL(12, 2) DEFAULT 0,
  balance_date VARCHAR(50),
  total_amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. TAREAS
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  assignee VARCHAR(100),
  created_by VARCHAR(100),
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. USUARIOS (FIX: vincular con auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'operario_taller',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  joined_date DATE DEFAULT CURRENT_DATE,
  avatar_initials VARCHAR(5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. REPORTES
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. ÓRDENES DE PRODUCCIÓN
CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  start_date DATE,
  delivery_date DATE,
  status VARCHAR(50) DEFAULT 'PENDIENTE',
  items JSONB,
  assigned_operators TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. HISTORIAL DE CHAT IA
CREATE TABLE ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(100) NOT NULL,
  messages JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PASO 4: Crear índices
-- ============================================================================
CREATE INDEX idx_budgets_project ON budgets(project_id);
CREATE INDEX idx_items_budget ON budget_items(budget_id);
CREATE INDEX idx_modules_item ON modules(item_id);
CREATE INDEX idx_estimates_project ON saved_estimates("projectId");
CREATE INDEX idx_estimates_pricelist ON saved_estimates("priceListId");
CREATE INDEX idx_payments_project ON supplier_payments(project_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_orders_project ON production_orders(project_id);
CREATE INDEX idx_chat_user ON ai_chat_history(user_email);

-- PASO 5: Habilitar RLS en todas las tablas
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- PASO 6: Crear policies RLS simples (todos autenticados pueden todo)
-- ============================================================================
-- Estas policies son PERMISIVAS para desarrollo
-- En producción, refiná según ROLES_PERMISSIONS.md

-- CLIENTS
CREATE POLICY "Clients: All authenticated users"
ON clients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PRICE CATALOG
CREATE POLICY "PriceCatalog: All authenticated users"
ON price_catalog FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PROJECTS
CREATE POLICY "Projects: All authenticated users"
ON projects FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- BUDGETS
CREATE POLICY "Budgets: All authenticated users"
ON budgets FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- BUDGET_ITEMS
CREATE POLICY "BudgetItems: All authenticated users"
ON budget_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- MODULES
CREATE POLICY "Modules: All authenticated users"
ON modules FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PRICE_LISTS
CREATE POLICY "PriceLists: All authenticated users"
ON price_lists FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- SAVED_ESTIMATES
CREATE POLICY "SavedEstimates: All authenticated users"
ON saved_estimates FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- SUPPLIERS
CREATE POLICY "Suppliers: All authenticated users"
ON suppliers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- SUPPLIER_PAYMENTS
CREATE POLICY "SupplierPayments: All authenticated users"
ON supplier_payments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- TASKS
CREATE POLICY "Tasks: All authenticated users"
ON tasks FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- USERS (FIX: esta es la policy que faltaba para Staff page)
CREATE POLICY "Users: All authenticated users can read"
ON users FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users: Admins can insert"
ON users FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'administrador'
  )
);

CREATE POLICY "Users: Admins can update"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'administrador'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'administrador'
  )
);

CREATE POLICY "Users: Admins can delete"
ON users FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'administrador'
  )
);

-- REPORTS
CREATE POLICY "Reports: All authenticated users"
ON reports FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- PRODUCTION_ORDERS
CREATE POLICY "ProductionOrders: All authenticated users"
ON production_orders FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- AI_CHAT_HISTORY
CREATE POLICY "AIChatHistory: Users see their own"
ON ai_chat_history FOR ALL
TO authenticated
USING (user_email = auth.jwt()->>'email')
WITH CHECK (user_email = auth.jwt()->>'email');

-- PASO 7: Función y trigger para auto-crear usuario en public.users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'operario_taller'),
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- PASO 8: Insertar usuario administrador inicial
-- ============================================================================
-- IMPORTANTE: Cambiá este email por el tuyo de Supabase Auth
-- Este script asume que ya creaste el usuario en Authentication
-- Si no existe, crealo primero en Supabase Dashboard → Authentication

-- Buscar el UUID del usuario auth con el email que usás
-- Y ejecutá este INSERT manualmente reemplazando el UUID:

-- INSERT INTO public.users (id, name, email, role, status)
-- VALUES (
--   'REEMPLAZAR-CON-UUID-DE-AUTH-USERS',
--   'Gustavo Polack',
--   'gustavopolack@gmail.com',
--   'administrador',
--   'ACTIVE'
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'administrador';

-- Para obtener el UUID correcto, ejecutá:
-- SELECT id, email FROM auth.users WHERE email = 'gustavopolack@gmail.com';

-- PASO 9: Datos de ejemplo (opcional)
-- ============================================================================

-- Insertar categorías de catálogo de precios base
INSERT INTO price_catalog (category, name, unit, current_price) VALUES
  ('BOARD', 'MDF 18mm', 'm2', 15000),
  ('BOARD', 'Aglomerado blanco 18mm', 'm2', 12000),
  ('EDGE', 'Canto PVC blanco 22mm', 'ml', 250),
  ('HARDWARE', 'Bisagra cazoleta 35mm', 'un', 800),
  ('LABOR', 'Día operario', 'day', 25000)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIN DEL SETUP
-- ============================================================================

-- VERIFICACIÓN FINAL
-- Ejecutá estas queries para verificar que todo se creó correctamente:

-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT * FROM users;
-- SELECT * FROM price_lists LIMIT 5;
-- SELECT * FROM saved_estimates LIMIT 5;
