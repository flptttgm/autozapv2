-- Adicionar política SELECT para anon (necessário para UPSERT resolver conflitos)
CREATE POLICY "Allow anon select on landing_leads"
ON public.landing_leads 
FOR SELECT 
TO anon
USING (true);

-- Garantir GRANT SELECT
GRANT SELECT ON public.landing_leads TO anon;