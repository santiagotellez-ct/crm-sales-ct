-- Add default goal columns to team_members
ALTER TABLE public.team_members
  ADD COLUMN pipe_goal integer NOT NULL DEFAULT 0,
  ADD COLUMN meeting_goal integer NOT NULL DEFAULT 0;

-- Seed SDR defaults from current hardcoded values
UPDATE public.team_members SET pipe_goal = 192000, meeting_goal = 24 WHERE name = 'César'   AND role = 'sdr';
UPDATE public.team_members SET pipe_goal = 96000,  meeting_goal = 12 WHERE name = 'Jissad'  AND role = 'sdr';
UPDATE public.team_members SET pipe_goal = 96000,  meeting_goal = 12 WHERE name = 'Juan'    AND role = 'sdr';
UPDATE public.team_members SET pipe_goal = 96000,  meeting_goal = 12 WHERE name = 'Self AE' AND role = 'sdr';

-- Seed AE pipe defaults
UPDATE public.team_members SET pipe_goal = 140000 WHERE name = 'Majo'  AND role = 'ae';
UPDATE public.team_members SET pipe_goal = 140000 WHERE name = 'Santi' AND role = 'ae';
UPDATE public.team_members SET pipe_goal = 100000 WHERE name = 'Nico'  AND role = 'ae';
UPDATE public.team_members SET pipe_goal = 100000 WHERE name = 'Toqui' AND role = 'ae';

-- AE quarterly revenue targets (replaces hardcoded AE_QUARTER_TARGETS)
CREATE TABLE public.ae_targets (
  ae_name     text NOT NULL,
  quarter_key text NOT NULL,
  target      integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ae_name, quarter_key)
);

ALTER TABLE public.ae_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_targets_all" ON public.ae_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed current Q2-2026 targets
INSERT INTO public.ae_targets (ae_name, quarter_key, target) VALUES
  ('Toqui', 'Q2-2026', 140000),
  ('Nico',  'Q2-2026', 140000),
  ('Santi', 'Q2-2026', 210000),
  ('Majo',  'Q2-2026', 210000);
