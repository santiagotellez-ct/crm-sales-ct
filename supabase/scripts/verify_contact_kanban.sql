-- Smoke checks after 20260921160000_contact_kanban_cutover.sql

SELECT key, is_active
FROM public.pipeline_stages
WHERE pipeline = 'sdr'
ORDER BY sort_order;

SELECT COUNT(*) AS contacts_with_legacy_keys
FROM public.contacts
WHERE status IN ('follow_up_1', 'follow_up_2', 'en_conversacion', 'agendado', 'no_answer', 'unqualified_post_meeting');

SELECT 'set_contact_status + apply_touch still callable' AS note
WHERE EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('apply_touch_to_contact', 'set_contact_status', 'refresh_company_status_from_contacts')
);
