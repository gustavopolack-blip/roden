-- migration_fix_prices.sql

-- 1. Fix price_lists table
ALTER TABLE public.price_lists 
ADD COLUMN IF NOT EXISTS settings JSONB;

-- Update RLS for price_lists
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PriceLists: All authenticated" ON public.price_lists;
CREATE POLICY "PriceLists: All authenticated" 
ON public.price_lists 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 2. Fix saved_estimates table
ALTER TABLE public.saved_estimates 
ADD COLUMN IF NOT EXISTS "priceListId" TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_estimates_price_list 
ON public.saved_estimates("priceListId");

-- 3. Fix users table RLS (Problem 1)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users: All authenticated" ON public.users;
CREATE POLICY "Users: All authenticated" 
ON public.users 
FOR ALL 
USING (auth.role() = 'authenticated');

-- 4. Fix trigger (Problem 1)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, status, joined_date, avatar_initials)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'operario_taller'),
    'ACTIVE',
    CURRENT_DATE,
    COALESCE(
        substring((new.raw_user_meta_data->>'name') from 1 for 2), 
        substring(new.email from 1 for 2)
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
