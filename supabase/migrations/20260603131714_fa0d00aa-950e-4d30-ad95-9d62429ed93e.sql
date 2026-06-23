
-- Add secondary AE + commit checkboxes to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS secondary_ae text,
  ADD COLUMN IF NOT EXISTS commit_speaking_main boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_speaking_second boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_workshop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_stand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_experience_id uuid;

-- Events catalog
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slots_main_stage integer NOT NULL DEFAULT 2,
  slots_second_stage integer NOT NULL DEFAULT 2,
  slots_workshop integer NOT NULL DEFAULT 2,
  slots_stand integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated, anon;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_all_events ON public.events FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event experiences (Fintech cocktail, VIP Lunch, VC Padel, etc.)
CREATE TABLE IF NOT EXISTS public.event_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_slots integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_experiences TO authenticated, anon;
GRANT ALL ON public.event_experiences TO service_role;

ALTER TABLE public.event_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_all_event_experiences ON public.event_experiences FOR ALL USING (true) WITH CHECK (true);

-- Seed default events
INSERT INTO public.events (name) VALUES ('CTW2026'), ('AISummit2026'), ('Aceleracion')
ON CONFLICT (name) DO NOTHING;
