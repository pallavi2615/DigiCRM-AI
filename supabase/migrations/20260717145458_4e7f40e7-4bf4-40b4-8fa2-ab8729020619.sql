
ALTER TABLE public.inbound_webhooks_log
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dead_letter BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS inbound_webhooks_log_tenant_event_uniq
  ON public.inbound_webhooks_log (tenant_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inbound_webhooks_log_retry_idx
  ON public.inbound_webhooks_log (next_retry_at)
  WHERE dead_letter = false AND ok = false;
