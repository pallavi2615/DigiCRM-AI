ALTER TABLE public.sheet_sync_configs
  ADD COLUMN IF NOT EXISTS group_slug TEXT,
  ADD COLUMN IF NOT EXISTS pack_slug TEXT;