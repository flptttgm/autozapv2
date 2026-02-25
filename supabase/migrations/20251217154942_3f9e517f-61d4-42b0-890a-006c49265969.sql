-- Insert 3 new hero variants (E, F, G) with aspirational headlines
INSERT INTO public.ab_test_variants (test_name, variant_key, variant_name, weight, is_active)
VALUES 
  ('hero_v1', 'E', 'Máquina de Vendas', 14, true),
  ('hero_v1', 'F', 'Atenda/Venda/Agende', 14, true),
  ('hero_v1', 'G', 'Enquanto Dorme', 16, true);

-- Update existing variants to balance weights (14% each)
UPDATE public.ab_test_variants 
SET weight = 14 
WHERE test_name = 'hero_v1' AND variant_key IN ('A', 'B', 'C', 'D');