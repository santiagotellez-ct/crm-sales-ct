
-- 1. Prospection sequences table
CREATE TABLE public.prospection_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sdr text,
  linkedin_account text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospection_sequences_company ON public.prospection_sequences(company_id);
CREATE INDEX idx_prospection_sequences_active ON public.prospection_sequences(company_id) WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospection_sequences TO anon, authenticated;
GRANT ALL ON public.prospection_sequences TO service_role;

ALTER TABLE public.prospection_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_prospection_sequences"
  ON public.prospection_sequences
  FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.prospection_sequences;

-- 2. sequence_id columns on activities and meetings
ALTER TABLE public.activities ADD COLUMN sequence_id uuid REFERENCES public.prospection_sequences(id) ON DELETE SET NULL;
ALTER TABLE public.meetings   ADD COLUMN sequence_id uuid REFERENCES public.prospection_sequences(id) ON DELETE SET NULL;

-- 3. Backfill: one initial sequence per company
INSERT INTO public.prospection_sequences (company_id, sdr, started_at)
SELECT id, sdr, created_at FROM public.companies;

-- Attribute existing activities/meetings to that initial sequence
UPDATE public.activities a
SET sequence_id = ps.id
FROM public.prospection_sequences ps
WHERE ps.company_id = a.company_id AND ps.ended_at IS NULL;

UPDATE public.meetings m
SET sequence_id = ps.id
FROM public.prospection_sequences ps
WHERE ps.company_id = m.company_id AND ps.ended_at IS NULL;
