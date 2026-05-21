-- Run once in Supabase SQL Editor while backend-hospital is NOT starting (no Flyway migrate).
-- Secures flyway_schema_history for the Security Advisor without blocking app startup.

ALTER TABLE public.flyway_schema_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.flyway_schema_history FROM anon, authenticated, PUBLIC;
