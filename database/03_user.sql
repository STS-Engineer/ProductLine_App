CREATE TABLE IF NOT EXISTS public.users
(
    id SERIAL PRIMARY KEY,
    email text COLLATE pg_catalog."default" NOT NULL UNIQUE,
    display_name text COLLATE pg_catalog."default",
    password_hash text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);