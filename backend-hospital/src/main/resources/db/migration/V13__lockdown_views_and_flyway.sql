-- Complements V12: secure rag_ingest_* views (V12 only enabled RLS on tables).
-- Do NOT alter flyway_schema_history here — Flyway locks it during migrate (statement timeout).
-- Run scripts/supabase-lockdown-flyway-history.sql manually in Supabase SQL Editor when the app is stopped.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'rag_ingest_jobs'
          AND c.relkind = 'v'
    ) THEN
        REVOKE ALL ON TABLE public.rag_ingest_jobs FROM anon, authenticated, PUBLIC;
        ALTER VIEW public.rag_ingest_jobs SET (security_invoker = true);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'rag_ingest_batches'
          AND c.relkind = 'v'
    ) THEN
        REVOKE ALL ON TABLE public.rag_ingest_batches FROM anon, authenticated, PUBLIC;
        ALTER VIEW public.rag_ingest_batches SET (security_invoker = true);
    END IF;
END $$;
