
CREATE TABLE public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.deal_stages(id),
  entered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_stage_history_deal ON public.deal_stage_history(deal_id, entered_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_stage_history TO authenticated;
GRANT SELECT, INSERT ON public.deal_stage_history TO anon;
GRANT ALL ON public.deal_stage_history TO service_role;

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deal stage history" ON public.deal_stage_history FOR SELECT USING (true);
CREATE POLICY "Public insert deal stage history" ON public.deal_stage_history FOR INSERT WITH CHECK (true);

-- Backfill: every existing deal gets an initial history row at its created_at
INSERT INTO public.deal_stage_history (deal_id, stage_id, entered_at, created_at)
SELECT id, stage_id, created_at, created_at FROM public.deals;

-- Trigger: log on insert (initial stage) and on stage change
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (deal_id, stage_id, entered_at)
    VALUES (NEW.id, NEW.stage_id, COALESCE(NEW.created_at, now()));
  ELSIF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.deal_stage_history (deal_id, stage_id, entered_at)
    VALUES (NEW.id, NEW.stage_id, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_deal_stage_change
AFTER INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();
