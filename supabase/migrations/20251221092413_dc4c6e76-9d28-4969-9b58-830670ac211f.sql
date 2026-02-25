-- Create function to block suspicious emails
CREATE OR REPLACE FUNCTION public.block_suspicious_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain text;
  blocked_domains text[] := ARRAY[
    'example.com', 'test.com', 'tempmail.com', 'mailinator.com',
    'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'fakeinbox.com', 'temp-mail.org', 'disposablemail.com',
    'yopmail.com', 'trashmail.com', 'sharklasers.com',
    'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
    'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
    'dispostable.com', 'mailnesia.com', 'maildrop.cc',
    'mintemail.com', 'emailondeck.com', 'tempr.email',
    'mohmal.com', 'tempinbox.com', 'fakemailgenerator.com',
    'emailfake.com', 'throwawaymail.com', 'getnada.com'
  ];
BEGIN
  -- Extract domain from email
  email_domain := lower(split_part(NEW.email, '@', 2));
  
  -- Block if domain is in blocked list
  IF email_domain = ANY(blocked_domains) THEN
    RAISE EXCEPTION 'Email domain not allowed: %', email_domain;
  END IF;
  
  -- Block test pattern emails: test[random][timestamp]@domain
  IF NEW.email ~* '^test[a-z0-9]{6,}[0-9]{10,}@' THEN
    RAISE EXCEPTION 'Suspicious email pattern detected';
  END IF;
  
  -- Block emails starting with test followed by 8+ random chars
  IF NEW.email ~* '^test[a-z0-9]{8,}@' THEN
    RAISE EXCEPTION 'Suspicious email pattern detected';
  END IF;
  
  RETURN NEW;
END;
$$;