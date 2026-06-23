ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS additional_sdrs text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contacted_from text;