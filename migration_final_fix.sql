-- migration_final_fix.sql

-- 1. Ensure all tables have RLS enabled
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END $$;

-- 2. Create a generic policy for all tables (MVP: Authenticated users can do everything)
-- This is a fallback to ensure no 42501 errors.
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'ai_chat_history' -- Skip this one as it has a specific policy
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Allow all for authenticated" ON public.%I FOR ALL USING (auth.role() = ''authenticated'');', t);
    END LOOP;
END $$;

-- 3. Specific policy for ai_chat_history
DROP POLICY IF EXISTS "Chat: Own history only" ON public.ai_chat_history;
CREATE POLICY "Chat: Own history only" ON public.ai_chat_history FOR ALL 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- 4. Ensure public.users has the right columns and trigger
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_initials TEXT;

-- 5. Fix price_lists and saved_estimates columns
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS settings JSONB;
ALTER TABLE public.saved_estimates ADD COLUMN IF NOT EXISTS "priceListId" TEXT;

-- 6. Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
