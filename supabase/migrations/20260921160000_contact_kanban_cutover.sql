-- Phase B cutover: activate spec SDR stages, deactivate legacy FU columns,
-- dual-write companies.status from best contact progress.

-- ─── Stage catalog flip ─────────────────────────────────────────────────────
UPDATE public.pipeline_stages
SET is_active = true
WHERE pipeline = 'sdr'
  AND key IN (
    'touch_point_2', 'touch_point_3', 'touch_point_4', 'touch_point_5', 'touch_point_6',
    'caliente', 'reunion_agendada', 'en_nutricion'
  );

UPDATE public.pipeline_stages
SET is_active = false
WHERE pipeline = 'sdr'
  AND key IN (
    'follow_up_1', 'follow_up_2', 'en_conversacion', 'agendado', 'no_answer',
    'unqualified_post_meeting'
  );

-- Keep por_contactar, contactado, reagendar, unqualified, no_interesado active.

-- ─── Rank helper for "best" contact stage (§3.4 company summary) ─────────────
CREATE OR REPLACE FUNCTION public.contact_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(NULLIF(TRIM(p_status), ''), 'por_contactar')
    WHEN 'unqualified' THEN 0
    WHEN 'unqualified_post_meeting' THEN 0
    WHEN 'no_interesado' THEN 1
    WHEN 'en_nutricion' THEN 2
    WHEN 'no_answer' THEN 2
    WHEN 'por_contactar' THEN 10
    WHEN 'contactado' THEN 20
    WHEN 'follow_up_1' THEN 30
    WHEN 'touch_point_2' THEN 30
    WHEN 'follow_up_2' THEN 40
    WHEN 'touch_point_3' THEN 40
    WHEN 'en_conversacion' THEN 50
    WHEN 'touch_point_4' THEN 50
    WHEN 'touch_point_5' THEN 60
    WHEN 'touch_point_6' THEN 70
    WHEN 'reagendar' THEN 75
    WHEN 'caliente' THEN 80
    WHEN 'agendado' THEN 90
    WHEN 'reunion_agendada' THEN 90
    ELSE 5
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_contact_status(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(NULLIF(TRIM(p_status), ''), 'por_contactar')
    WHEN 'follow_up_1' THEN 'touch_point_2'
    WHEN 'follow_up_2' THEN 'touch_point_3'
    WHEN 'en_conversacion' THEN 'touch_point_4'
    WHEN 'agendado' THEN 'reunion_agendada'
    WHEN 'no_answer' THEN 'en_nutricion'
    WHEN 'unqualified_post_meeting' THEN 'unqualified'
    ELSE COALESCE(NULLIF(TRIM(p_status), ''), 'por_contactar')
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_company_status_from_contacts(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_best text;
BEGIN
  SELECT c.status INTO v_best
  FROM public.contacts c
  WHERE c.company_id = p_company_id
    AND c.archived_at IS NULL
  ORDER BY public.contact_status_rank(c.status) DESC, c.status_entered_at DESC NULLS LAST
  LIMIT 1;

  IF v_best IS NULL THEN
    RETURN NULL;
  END IF;

  v_best := public.normalize_contact_status(v_best);

  UPDATE public.companies
  SET
    status = v_best,
    status_entered_at = COALESCE(status_entered_at, now())
  WHERE id = p_company_id
    AND status IS DISTINCT FROM v_best;

  RETURN v_best;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_company_status_from_contacts(uuid)
  TO anon, authenticated, service_role;

-- ─── apply_touch: dual-write company summary after contact advance ──────────
CREATE OR REPLACE FUNCTION public.apply_touch_to_contact(
  p_contact_id uuid,
  p_channel text DEFAULT NULL,
  p_account_used text DEFAULT NULL,
  p_sdr text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_touched_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts%ROWTYPE;
  v_effective text;
  v_next text;
  v_touch_id uuid;
  v_advanced boolean := false;
  v_company_status text;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'contact_id is required';
  END IF;

  SELECT * INTO v_contact
  FROM public.contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact not found: %', p_contact_id;
  END IF;

  v_effective := COALESCE(NULLIF(TRIM(v_contact.status), ''), 'por_contactar');

  v_next := CASE v_effective
    WHEN 'por_contactar'    THEN 'contactado'
    WHEN 'contactado'       THEN 'touch_point_2'
    WHEN 'follow_up_1'      THEN 'touch_point_2'
    WHEN 'follow_up_2'      THEN 'touch_point_3'
    WHEN 'en_conversacion'  THEN 'touch_point_4'
    WHEN 'touch_point_2'    THEN 'touch_point_3'
    WHEN 'touch_point_3'    THEN 'touch_point_4'
    WHEN 'touch_point_4'    THEN 'touch_point_5'
    WHEN 'touch_point_5'    THEN 'touch_point_6'
    WHEN 'touch_point_6'    THEN NULL
    ELSE NULL
  END;

  INSERT INTO public.touches (
    contact_id, company_id, touched_at, channel, account_used, sdr, note, created_by
  ) VALUES (
    v_contact.id,
    v_contact.company_id,
    COALESCE(p_touched_at, now()),
    NULLIF(TRIM(p_channel), ''),
    NULLIF(TRIM(p_account_used), ''),
    COALESCE(NULLIF(TRIM(p_sdr), ''), v_contact.sdr),
    NULLIF(TRIM(p_note), ''),
    auth.uid()
  )
  RETURNING id INTO v_touch_id;

  IF v_next IS NOT NULL AND v_next IS DISTINCT FROM v_effective THEN
    UPDATE public.contacts
    SET
      status = v_next,
      status_entered_at = now(),
      sdr = COALESCE(NULLIF(TRIM(p_sdr), ''), sdr)
    WHERE id = v_contact.id;
    v_advanced := true;
  ELSIF NULLIF(TRIM(p_sdr), '') IS NOT NULL AND v_contact.sdr IS DISTINCT FROM NULLIF(TRIM(p_sdr), '') THEN
    UPDATE public.contacts
    SET sdr = NULLIF(TRIM(p_sdr), '')
    WHERE id = v_contact.id;
  END IF;

  v_company_status := public.refresh_company_status_from_contacts(v_contact.company_id);

  RETURN jsonb_build_object(
    'touch_id', v_touch_id,
    'contact_id', v_contact.id,
    'company_id', v_contact.company_id,
    'from_status', v_effective,
    'to_status', CASE WHEN v_advanced THEN v_next ELSE v_effective END,
    'advanced', v_advanced,
    'company_status', v_company_status
  );
END;
$$;

COMMENT ON FUNCTION public.apply_touch_to_contact IS
  'Inserts a touch, advances contacts.status on the touch ladder, refreshes companies.status from best contact.';

-- Explicit contact stage change (Caliente / Agendar / discard / drag specials)
CREATE OR REPLACE FUNCTION public.set_contact_status(
  p_contact_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts%ROWTYPE;
  v_from text;
  v_to text;
  v_company_status text;
BEGIN
  IF p_contact_id IS NULL OR NULLIF(TRIM(p_status), '') IS NULL THEN
    RAISE EXCEPTION 'contact_id and status are required';
  END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contact not found: %', p_contact_id;
  END IF;

  v_from := COALESCE(NULLIF(TRIM(v_contact.status), ''), 'por_contactar');
  v_to := public.normalize_contact_status(p_status);

  UPDATE public.contacts
  SET
    status = v_to,
    status_entered_at = CASE WHEN v_to IS DISTINCT FROM v_from THEN now() ELSE status_entered_at END,
    notes = CASE
      WHEN p_reason IS NOT NULL AND NULLIF(TRIM(p_reason), '') IS NOT NULL
        THEN COALESCE(notes || E'\n', '') || TRIM(p_reason)
      ELSE notes
    END
  WHERE id = v_contact.id;

  v_company_status := public.refresh_company_status_from_contacts(v_contact.company_id);

  RETURN jsonb_build_object(
    'contact_id', v_contact.id,
    'company_id', v_contact.company_id,
    'from_status', v_from,
    'to_status', v_to,
    'company_status', v_company_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_contact_status(uuid, text, text)
  TO anon, authenticated, service_role;

-- One-shot: normalize existing contact statuses into spec keys (display + RPC)
UPDATE public.contacts
SET status = public.normalize_contact_status(status)
WHERE status IS DISTINCT FROM public.normalize_contact_status(status);

-- Refresh company summaries from contacts (batched via SQL)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.contacts LOOP
    PERFORM public.refresh_company_status_from_contacts(r.company_id);
  END LOOP;
END $$;
