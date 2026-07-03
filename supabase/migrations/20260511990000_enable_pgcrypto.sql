CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.gen_random_bytes(len integer)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$ SELECT extensions.gen_random_bytes(len); $$;
