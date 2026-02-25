-- Atualizar função de bloqueio de emails suspeitos com mais proteções
CREATE OR REPLACE FUNCTION public.block_suspicious_emails()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  email_domain text;
  domain_without_tld text;
  blocked_domains text[] := ARRAY[
    -- Domínios temporários/descartáveis
    'example.com', 'test.com', 'tempmail.com', 'mailinator.com',
    'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'fakeinbox.com', 'temp-mail.org', 'disposablemail.com',
    'yopmail.com', 'trashmail.com', 'sharklasers.com',
    'guerrillamail.info', 'grr.la', 'guerrillamail.biz',
    'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
    'dispostable.com', 'mailnesia.com', 'maildrop.cc',
    'mintemail.com', 'emailondeck.com', 'tempr.email',
    'mohmal.com', 'tempinbox.com', 'fakemailgenerator.com',
    'emailfake.com', 'throwawaymail.com', 'getnada.com',
    'getairmail.com', 'mailcatch.com',
    -- Domínios genéricos/fake
    'exemplo.com', 'teste.com', 'fake.com', 'temp.com',
    'aaaa.com', 'bbbb.com', 'xxxx.com', 'zzzz.com',
    'asdf.com', 'qwerty.com', 'abc.com', 'xyz.com',
    'aaa.com', 'bbb.com', 'ccc.com', '1234.com', 'abcd.com'
  ];
  blocked_tlds text[] := ARRAY['tk', 'ml', 'ga', 'cf', 'gq'];
BEGIN
  -- Extract domain from email
  email_domain := lower(split_part(NEW.email, '@', 2));
  domain_without_tld := split_part(email_domain, '.', 1);
  
  -- Block if domain is in blocked list
  IF email_domain = ANY(blocked_domains) THEN
    RAISE EXCEPTION 'Email domain not allowed: %', email_domain;
  END IF;
  
  -- Block suspicious TLDs
  IF (SELECT split_part(email_domain, '.', array_length(string_to_array(email_domain, '.'), 1))) = ANY(blocked_tlds) THEN
    RAISE EXCEPTION 'Email TLD not allowed';
  END IF;
  
  -- Block very short domains (ex: aa.com, x.co)
  IF LENGTH(domain_without_tld) < 3 THEN
    RAISE EXCEPTION 'Email domain too short';
  END IF;
  
  -- Block domains with only repeated characters (ex: aaaa.com, xxxx.net)
  IF domain_without_tld ~ '^([a-z])\1{2,}$' THEN
    RAISE EXCEPTION 'Invalid email domain pattern';
  END IF;
  
  -- Block purely numeric domains (ex: 12345.com)
  IF domain_without_tld ~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Numeric email domains not allowed';
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
$function$;