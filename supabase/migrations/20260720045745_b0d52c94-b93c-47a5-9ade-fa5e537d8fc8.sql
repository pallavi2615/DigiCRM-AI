
ALTER TABLE public.inbound_webhooks_log
  ADD COLUMN IF NOT EXISTS attempts_log JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS inbound_webhooks_log_event_id_idx
  ON public.inbound_webhooks_log (tenant_id, event_id);
