-- Schema
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  domain text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT 'MID',
  country text NOT NULL DEFAULT '',
  linkedin_url text NOT NULL DEFAULT '',
  icp_fit text NOT NULL DEFAULT 'MAYBE',
  reasoning text NOT NULL DEFAULT '',
  angle text NOT NULL DEFAULT 'Brand',
  status text NOT NULL DEFAULT 'por_contactar',
  unqualified_reason text,
  sdr text,
  notes text NOT NULL DEFAULT '',
  amigos boolean NOT NULL DEFAULT false,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  email text,
  linkedin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_company ON public.contacts(company_id);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  sdr text,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_company ON public.tasks(company_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_at);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  company_id uuid NOT NULL,
  company_name text NOT NULL,
  sdr text,
  from_status text,
  to_status text,
  contact_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_created ON public.activities(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all_companies" ON public.companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all_activities" ON public.activities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.companies REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;