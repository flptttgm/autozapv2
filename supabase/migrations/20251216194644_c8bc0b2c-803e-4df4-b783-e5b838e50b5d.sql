-- Create dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage to relevant roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move uuid-ossp extension if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
  END IF;
END $$;

-- Move pgcrypto extension if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
  END IF;
END $$;

-- Move pg_trgm extension if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION IF EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
  END IF;
END $$;

-- Update search_path to include extensions schema
ALTER DATABASE postgres SET search_path TO public, extensions;