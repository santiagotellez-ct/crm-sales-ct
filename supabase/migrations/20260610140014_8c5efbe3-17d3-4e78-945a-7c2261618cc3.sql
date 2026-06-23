
CREATE TABLE public.pipe_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_year int NOT NULL,
  iso_week int NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('ae','sdr')),
  owner_name text NOT NULL,
  goal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (iso_year, iso_week, owner_type, owner_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipe_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipe_goals TO anon;
GRANT ALL ON public.pipe_goals TO service_role;

ALTER TABLE public.pipe_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipe_goals all access" ON public.pipe_goals FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER pipe_goals_set_updated_at BEFORE UPDATE ON public.pipe_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
