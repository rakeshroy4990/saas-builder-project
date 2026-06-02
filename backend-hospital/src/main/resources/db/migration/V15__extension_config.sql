-- L1/L2 extensibility config (static + dynamic JSON), single row per deploy (Supabase / PostgreSQL).
CREATE TABLE extension_config (
    id                  TEXT PRIMARY KEY,
    static_config_json  TEXT,
    dynamic_config_json TEXT,
    updated_at          TIMESTAMPTZ,
    deleted             BOOLEAN NOT NULL DEFAULT false
);
