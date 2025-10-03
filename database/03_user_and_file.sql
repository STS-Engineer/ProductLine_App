-- Table: public.users
CREATE SEQUENCE IF NOT EXISTS users_id_seq;

CREATE TABLE IF NOT EXISTS public.users
(
    id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    email text COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default" NOT NULL, 
    display_name text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);
-- Table: public.files
CREATE TABLE public.files
(
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    content_base64 TEXT NOT NULL, 
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: public.attachment_links (Junction Table)
CREATE TABLE public.attachment_links
(
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL REFERENCES public.files (id) ON DELETE CASCADE,
    
    -- Links to parent tables
    product_id BIGINT REFERENCES public.products (id) ON DELETE CASCADE,
    product_line_id BIGINT REFERENCES public.product_lines (id) ON DELETE CASCADE, 

    attachment_type VARCHAR(50) NOT NULL,
    
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint to ensure a file is linked to EITHER a product OR a product line, but not both
    CONSTRAINT chk_one_parent_id CHECK (
        (product_id IS NOT NULL AND product_line_id IS NULL) OR
        (product_id IS NULL AND product_line_id IS NOT NULL)
    )
);

-- Add indices for performance
CREATE INDEX idx_files_uploaded_at ON public.files (uploaded_at);
CREATE INDEX idx_attachment_links_product_id ON public.attachment_links (product_id);
CREATE INDEX idx_attachment_links_product_line_id ON public.attachment_links (product_line_id);
