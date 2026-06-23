ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS paquete_vendido text,
  ADD COLUMN IF NOT EXISTS adicionales_paquete text,
  ADD COLUMN IF NOT EXISTS sponsor_pain text,
  ADD COLUMN IF NOT EXISTS sponsor_icp text;