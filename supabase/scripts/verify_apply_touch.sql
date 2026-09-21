-- Manual smoke tests for apply_touch_to_contact (run in SQL Editor on a scratch contact).
-- Replace :contact_id or use the DO block below which creates a throwaway contact.

DO $$
DECLARE
  v_company_id uuid;
  v_contact_id uuid;
  v_r jsonb;
BEGIN
  SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'need at least one company';
  END IF;

  INSERT INTO public.contacts (company_id, name, role, linkedin, status)
  VALUES (
    v_company_id,
    '__touch_test__',
    'test',
    'https://linkedin.com/in/__touch_test__' || gen_random_uuid()::text,
    NULL
  )
  RETURNING id INTO v_contact_id;

  -- NULL status + 1 touch → contactado
  v_r := public.apply_touch_to_contact(v_contact_id, 'linkedin', 'nico', 'Test', 'smoke 1');
  IF (v_r->>'to_status') IS DISTINCT FROM 'contactado' OR (v_r->>'advanced')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'test1 failed: %', v_r;
  END IF;

  -- contactado + touch → follow_up_1 (current Sales ladder)
  v_r := public.apply_touch_to_contact(v_contact_id, 'linkedin', 'nico', 'Test', 'smoke 2');
  IF (v_r->>'to_status') IS DISTINCT FROM 'follow_up_1' THEN
    RAISE EXCEPTION 'test2 failed: %', v_r;
  END IF;

  -- '' status treated as por_contactar
  UPDATE public.contacts SET status = '' WHERE id = v_contact_id;
  v_r := public.apply_touch_to_contact(v_contact_id, 'email', NULL, 'Test', 'smoke empty');
  IF (v_r->>'from_status') IS DISTINCT FROM 'por_contactar'
     OR (v_r->>'to_status') IS DISTINCT FROM 'contactado' THEN
    RAISE EXCEPTION 'test empty failed: %', v_r;
  END IF;

  -- Terminal: no advance, touch still inserted
  UPDATE public.contacts SET status = 'agendado' WHERE id = v_contact_id;
  v_r := public.apply_touch_to_contact(v_contact_id, 'call', NULL, 'Test', 'smoke terminal');
  IF (v_r->>'advanced')::boolean IS NOT FALSE
     OR (v_r->>'to_status') IS DISTINCT FROM 'agendado' THEN
    RAISE EXCEPTION 'test terminal failed: %', v_r;
  END IF;

  -- Cleanup
  DELETE FROM public.touches WHERE contact_id = v_contact_id;
  DELETE FROM public.contacts WHERE id = v_contact_id;
END $$;

-- Visible OK in Supabase SQL Editor (DO blocks don't return rows / NOTICE is easy to miss)
SELECT 'apply_touch_to_contact smoke OK' AS result;
