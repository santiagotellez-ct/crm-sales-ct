
-- deal_stages
CREATE TABLE public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "order" integer NOT NULL,
  probability integer NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_deal_stages ON public.deal_stages FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER deal_stages_updated_at BEFORE UPDATE ON public.deal_stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.deal_stages (name, "order", probability, is_won, is_lost) VALUES
  ('Discovery realizada', 1, 20, false, false),
  ('Propuesta en construcción', 2, 35, false, false),
  ('Propuesta presentada', 3, 50, false, false),
  ('Propuesta en revisión', 4, 65, false, false),
  ('Commited', 5, 85, false, false),
  ('Cierre ganado', 6, 100, true, false),
  ('Cierre perdido', 7, 0, false, true);

-- deals
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  company_name text NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.deal_stages(id),
  account_executive text NOT NULL,
  sdr text,
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  expected_close_date date,
  billing_date date,
  collection_date date,
  notes text NOT NULL DEFAULT '',
  meeting_id uuid,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_deals ON public.deals FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_deals_stage ON public.deals(stage_id);
CREATE INDEX idx_deals_company ON public.deals(company_id);

-- deal_contacts
CREATE TABLE public.deal_contacts (
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, contact_id)
);
ALTER TABLE public.deal_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_deal_contacts ON public.deal_contacts FOR ALL USING (true) WITH CHECK (true);

-- deal_tasks
CREATE TABLE public.deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  assignee text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_all_deal_tasks ON public.deal_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_deal_tasks_deal ON public.deal_tasks(deal_id);

-- Augment meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS contact_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gcal_event_id text,
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS slack_prompt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome text;
