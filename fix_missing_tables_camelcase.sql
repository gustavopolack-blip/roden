-- fix_missing_tables_camelcase.sql

DROP TABLE IF EXISTS public.estimates CASCADE;
DROP TABLE IF EXISTS public.price_lists CASCADE;

-- 1. Create price_lists table
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    "validFrom" DATE DEFAULT CURRENT_DATE,
    "validUntil" DATE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "inflationRate" DECIMAL(5, 2) DEFAULT 0,
    settings JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create estimates table
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "projectId" UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    "priceListId" UUID REFERENCES public.price_lists(id) ON DELETE SET NULL,
    title VARCHAR(200),
    description TEXT,
    "downPayment" DECIMAL(12, 2) DEFAULT 0,
    "downPaymentDate" DATE,
    balance DECIMAL(12, 2) DEFAULT 0,
    "balanceDate" DATE,
    "totalAmount" DECIMAL(12, 2) DEFAULT 0,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT',
    type VARCHAR(50) DEFAULT 'STANDARD',
    items JSONB DEFAULT '[]'::jsonb, 
    "costSummary" JSONB DEFAULT '{}'::jsonb,
    "legacyId" TEXT,
    "migrationSource" VARCHAR(20),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
