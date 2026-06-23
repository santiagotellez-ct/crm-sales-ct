
-- Meetings scheduled
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  account_executive TEXT NOT NULL,
  sdr TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  iso_year INTEGER NOT NULL,
  iso_week INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_week ON public.meetings(iso_year, iso_week);
CREATE INDEX idx_meetings_ae ON public.meetings(account_executive);
CREATE INDEX idx_meetings_company ON public.meetings(company_id);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

-- Weekly goals per AE
CREATE TABLE public.meeting_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_year INTEGER NOT NULL,
  iso_week INTEGER NOT NULL,
  account_executive TEXT NOT NULL,
  goal INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(iso_year, iso_week, account_executive)
);

ALTER TABLE public.meeting_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_meeting_goals" ON public.meeting_goals FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_meeting_goals_updated
  BEFORE UPDATE ON public.meeting_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
