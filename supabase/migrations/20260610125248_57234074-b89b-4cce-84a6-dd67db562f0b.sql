ALTER TABLE public.contacts
  ALTER COLUMN contacted_from TYPE text[]
  USING CASE WHEN contacted_from IS NULL OR contacted_from = '' THEN NULL ELSE ARRAY[contacted_from] END;