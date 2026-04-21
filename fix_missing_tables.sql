-- fix_missing_tables.sql

-- 1. Create price_lists table
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    inflation_rate DECIMAL(5, 2) DEFAULT 0,
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create estimates table
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    price_list_id UUID REFERENCES public.price_lists(id) ON DELETE SET NULL,
    title VARCHAR(200),
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT',
    type VARCHAR(50) DEFAULT 'STANDARD',
    items JSONB DEFAULT '[]'::jsonb, 
    cost_summary JSONB DEFAULT '{}'::jsonb,
    legacy_id TEXT,
    migration_source VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.price_lists;
CREATE POLICY "Allow all for authenticated" ON public.price_lists FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.estimates;
CREATE POLICY "Allow all for authenticated" ON public.estimates FOR ALL USING (auth.role() = 'authenticated');

-- 5. Grant permissions
GRANT ALL ON public.price_lists TO authenticated;
GRANT ALL ON public.estimates TO authenticated;
GRANT ALL ON public.price_lists TO service_role;
GRANT ALL ON public.estimates TO service_role;
