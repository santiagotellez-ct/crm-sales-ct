
CREATE TABLE public.sdr_meeting_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso_year integer NOT NULL,
  iso_week integer NOT NULL,
  sdr text NOT NULL,
  goal integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (iso_year, iso_week, sdr)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_meeting_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sdr_meeting_goals TO anon;
GRANT ALL ON public.sdr_meeting_goals TO service_role;
ALTER TABLE public.sdr_meeting_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_sdr_meeting_goals" ON public.sdr_meeting_goals FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sdr_meeting_goals_updated BEFORE UPDATE ON public.sdr_meeting_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
