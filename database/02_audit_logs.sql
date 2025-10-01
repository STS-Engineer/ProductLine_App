-- ----------------------------------------
-- Table: public.audit_logs
-- Tracks who performed what action, where, and when.
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs
(
    log_id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,           -- 'CREATE', 'UPDATE', or 'DELETE'
    table_name TEXT NOT NULL,       -- 'product_lines' or 'products'
    document_id TEXT,               -- The ID (text or bigint) of the record affected
    user_id TEXT NOT NULL,          -- The Firebase UID of the user
    user_name TEXT,                 -- The display name of the user
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    details JSONB                   -- Stores structured payload (e.g., old vs new data)
);

TABLESPACE pg_default;
ALTER TABLE IF EXISTS public.audit_logs OWNER to "administrationSTS";
