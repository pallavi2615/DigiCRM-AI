
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS webhook_max_attempts INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS webhook_backoff_base_minutes INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS webhook_backoff_factor NUMERIC(4,2) NOT NULL DEFAULT 3.0;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_webhook_max_attempts_ck CHECK (webhook_max_attempts BETWEEN 1 AND 20),
  ADD CONSTRAINT tenants_webhook_backoff_base_ck CHECK (webhook_backoff_base_minutes BETWEEN 1 AND 1440),
  ADD CONSTRAINT tenants_webhook_backoff_factor_ck CHECK (webhook_backoff_factor BETWEEN 1.0 AND 10.0);
