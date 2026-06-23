ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
UPDATE public.deals SET name = company_name WHERE name = '';