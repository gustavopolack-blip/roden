-- 0. CLIENTES
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

-- 1. CATÁLOGO DE PRECIOS (Global)
-- Mantiene los precios actuales de mercado.
CREATE TABLE price_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(50) NOT NULL, -- 'BOARD', 'EDGE', 'HARDWARE', 'FINISH', 'LABOR', 'OTHER'
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL, -- 'm2', 'ml', 'un', 'day'
  current_price DECIMAL(10, 2) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROYECTOS
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

-- 3. PRESUPUESTOS (Instancia)
-- Representa una versión de cotización para un proyecto.
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'LOCKED', 'APPROVED'
  
  -- SNAPSHOT: Aquí se guarda la "foto" de los costos al momento de congelar/enviar.
  cost_snapshot JSONB DEFAULT NULL, 
  
  total_cost DECIMAL(12, 2) DEFAULT 0,
  total_price DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ITEMS DEL PRESUPUESTO
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

-- 5. MÓDULOS
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

-- 6. HISTORIAL DE ESTIMACIONES
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

-- 7. PROVEEDORES
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  phone VARCHAR(50),
  email VARCHAR(100),
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PAGOS A PROVEEDORES
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

-- 9. TAREAS
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

-- 10. USUARIOS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  joined_date DATE DEFAULT CURRENT_DATE,
  avatar_initials VARCHAR(5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. REPORTES
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. ÓRDENES DE PRODUCCIÓN
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

-- 13. HISTORIAL DE CHAT IA
CREATE TABLE ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(100) NOT NULL,
  messages JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices adicionales
CREATE INDEX idx_budgets_project ON budgets(project_id);
CREATE INDEX idx_items_budget ON budget_items(budget_id);
CREATE INDEX idx_modules_item ON modules(item_id);
CREATE INDEX idx_estimates_project ON saved_estimates("projectId");
CREATE INDEX idx_payments_project ON supplier_payments(project_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_orders_project ON production_orders(project_id);
CREATE INDEX idx_chat_user ON ai_chat_history(user_email);
