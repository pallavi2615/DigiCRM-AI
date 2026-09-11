
-- Realtime: full row payloads + add to publication
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','it_tickets','it_projects','re_deals','loan_applications','ps_orders','tasks','notifications']
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Per-user dashboard layouts
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  hidden_widgets TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_layout_select" ON public.dashboard_layouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_layout_insert" ON public.dashboard_layouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_layout_update" ON public.dashboard_layouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_layout_delete" ON public.dashboard_layouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER dashboard_layouts_updated_at BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
