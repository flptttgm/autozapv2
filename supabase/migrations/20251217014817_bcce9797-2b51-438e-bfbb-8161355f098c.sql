-- 1. Remover política existente (RESTRICTIVE)
DROP POLICY IF EXISTS "Allow public insert on landing_leads" ON public.landing_leads;

-- 2. Criar política PERMISSIVE para INSERT (TO anon é crucial!)
CREATE POLICY "Allow anon insert on landing_leads"
ON public.landing_leads 
FOR INSERT 
TO anon
WITH CHECK (true);

-- 3. Criar política PERMISSIVE para UPDATE (necessário para upsert)
CREATE POLICY "Allow anon update on landing_leads"
ON public.landing_leads 
FOR UPDATE 
TO anon
USING (true)
WITH CHECK (true);

-- 4. Garantir GRANTs para INSERT e UPDATE
GRANT INSERT, UPDATE ON public.landing_leads TO anon;
GRANT USAGE ON SCHEMA public TO anon;