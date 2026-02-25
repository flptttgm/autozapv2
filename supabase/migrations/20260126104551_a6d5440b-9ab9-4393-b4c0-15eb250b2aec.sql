-- RPC function to increment seller stats after a sale
CREATE OR REPLACE FUNCTION public.increment_seller_stats(
  p_seller_id UUID,
  p_commission NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sellers
  SET 
    total_sales = COALESCE(total_sales, 0) + 1,
    total_commission = COALESCE(total_commission, 0) + p_commission,
    updated_at = NOW()
  WHERE id = p_seller_id;
END;
$$;