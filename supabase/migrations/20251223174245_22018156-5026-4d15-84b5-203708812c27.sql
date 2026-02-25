-- Create function to notify referrer when referral is completed
CREATE OR REPLACE FUNCTION notify_referral_completed()
RETURNS TRIGGER AS $$
DECLARE
  referrer_owner_id uuid;
  referral_amount numeric;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get the owner of the referrer workspace
    SELECT owner_id INTO referrer_owner_id
    FROM workspaces
    WHERE id = NEW.referrer_workspace_id;
    
    -- Get the credit amount
    referral_amount := COALESCE(NEW.credit_amount, 100);
    
    -- Insert notification for the referrer
    IF referrer_owner_id IS NOT NULL THEN
      INSERT INTO user_notifications (user_id, title, body, url, type)
      VALUES (
        referrer_owner_id,
        'Indicação concluída! 🎉',
        'Parabéns! Sua indicação foi confirmada e você ganhou R$' || referral_amount::text || ' de crédito.',
        '/settings',
        'referral'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on referrals table
DROP TRIGGER IF EXISTS trigger_notify_referral_completed ON referrals;
CREATE TRIGGER trigger_notify_referral_completed
  AFTER UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION notify_referral_completed();