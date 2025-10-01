-- ----------------------------------------
-- Table: public.product_lines
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.product_lines
(
    id text COLLATE pg_catalog."default" NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    type_of_products text COLLATE pg_catalog."default",
    manufacturing_locations text COLLATE pg_catalog."default",
    design_center text COLLATE pg_catalog."default",
    product_line_manager text COLLATE pg_catalog."default",
    history text COLLATE pg_catalog."default",
    type_of_customers text COLLATE pg_catalog."default",
    metiers text COLLATE pg_catalog."default",
    strength text COLLATE pg_catalog."default",
    weakness text COLLATE pg_catalog."default",
    perspectives text COLLATE pg_catalog."default",
    compliance_resource_id text COLLATE pg_catalog."default",
    attachments_raw text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT product_lines_pkey PRIMARY KEY (id),
    CONSTRAINT product_lines_name_uk UNIQUE (name)
);

ALTER TABLE IF EXISTS public.product_lines
    OWNER to "administrationSTS";

-- ----------------------------------------
-- Table: public.products
-- ----------------------------------------
-- Ensure the sequence exists or is correctly referenced
CREATE SEQUENCE IF NOT EXISTS products_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.products
(
    id bigint NOT NULL DEFAULT nextval('products_id_seq'::regclass),
    product_name text COLLATE pg_catalog."default",
    product_line text COLLATE pg_catalog."default",
    description text COLLATE pg_catalog."default",
    product_definition text COLLATE pg_catalog."default",
    operating_environment text COLLATE pg_catalog."default",
    technical_parameters text COLLATE pg_catalog."default",
    machines_and_tooling text COLLATE pg_catalog."default",
    manufacturing_strategy text COLLATE pg_catalog."default",
    purchasing_strategy text COLLATE pg_catalog."default",
    prototypes_ppap_and_sop text COLLATE pg_catalog."default",
    engineering_and_testing text COLLATE pg_catalog."default",
    capacity text COLLATE pg_catalog."default",
    our_advantages text COLLATE pg_catalog."default",
    gmdc_pct numeric(5,2),
    product_pictures bytea,
    product_line_id text COLLATE pg_catalog."default",
    customers_in_production text COLLATE pg_catalog."default",
    customer_in_development text COLLATE pg_catalog."default",
    level_of_interest_and_why text COLLATE pg_catalog."default",
    estimated_price_per_product text COLLATE pg_catalog."default",
    prod_if_customer_in_china boolean,
    costing_data text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.products
    OWNER to "administrationSTS";
