-- Phase A: apply_touch_to_contact
-- Advances contacts.status along the touch ladder. Does NOT write companies.status
-- (company kanban stays on legacy keys until cutover).

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

  -- Touch ladder only. Terminal / explicit stages do not advance via a generic touch.
  v_next := CASE v_effective
    WHEN 'por_contactar'    THEN 'contactado'
    WHEN 'contactado'       THEN 'touch_point_2'
    -- Legacy kanban keys → enter spec ladder
    WHEN 'follow_up_1'      THEN 'touch_point_2'
    WHEN 'follow_up_2'      THEN 'touch_point_3'
    WHEN 'en_conversacion'  THEN 'touch_point_4'
    WHEN 'touch_point_2'    THEN 'touch_point_3'
    WHEN 'touch_point_3'    THEN 'touch_point_4'
    WHEN 'touch_point_4'    THEN 'touch_point_5'
    WHEN 'touch_point_5'    THEN 'touch_point_6'
    WHEN 'touch_point_6'    THEN NULL  -- cap; still log the touch
    ELSE NULL
  END;

  INSERT INTO public.touches (
    contact_id,
    company_id,
    touched_at,
    channel,
    account_used,
    sdr,
    note,
    created_by
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

  RETURN jsonb_build_object(
    'touch_id', v_touch_id,
    'contact_id', v_contact.id,
    'company_id', v_contact.company_id,
    'from_status', v_effective,
    'to_status', CASE WHEN v_advanced THEN v_next ELSE v_effective END,
    'advanced', v_advanced
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_touch_to_contact(
  uuid, text, text, text, text, timestamptz
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.apply_touch_to_contact IS
  'Inserts a touch and advances contacts.status along the SDR touch ladder. Does not update companies.status.';
