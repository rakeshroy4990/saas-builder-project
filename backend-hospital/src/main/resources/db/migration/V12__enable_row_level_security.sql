-- Lock down public schema for Supabase PostgREST (anon / authenticated API keys).
-- Hospital backend uses JDBC as the database owner (postgres); superuser bypasses RLS.
-- With RLS enabled and no permissive policies, anon/authenticated cannot read or write rows.
--
-- Never alter flyway_schema_history here: Flyway holds locks on it during migrate (statement timeout).

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname <> 'flyway_schema_history'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.table_name);
        EXECUTE format(
            'REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC',
            tbl.table_name
        );
    END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
