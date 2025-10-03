-- Table: public.audit_logs
CREATE SEQUENCE IF NOT EXISTS audit_logs_log_id_seq;

CREATE TABLE IF NOT EXISTS public.audit_logs
(
    log_id bigint NOT NULL DEFAULT nextval('audit_logs_log_id_seq'::regclass),
    action text COLLATE pg_catalog."default" NOT NULL, 
    table_name text COLLATE pg_catalog."default" NOT NULL, 
    document_id text COLLATE pg_catalog."default", 
    user_id bigint NOT NULL, 
    user_email text COLLATE pg_catalog."default", 
    logged_at timestamp with time zone NOT NULL DEFAULT now(),
    details jsonb, 
    CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id)
);
