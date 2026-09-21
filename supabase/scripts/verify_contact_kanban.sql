-- Verify contact-kanban cutover keeps current Sales stages.

SELECT key, is_active
FROM public.pipeline_stages
WHERE pipeline = 'sdr'
  AND key IN (
    'por_contactar', 'contactado', 'follow_up_1', 'follow_up_2', 'en_conversacion',
    'agendado', 'reagendar', 'unqualified', 'no_interesado', 'no_answer',
    'touch_point_2', 'caliente', 'reunion_agendada'
  )
ORDER BY key;

-- Expect 0 after remap
SELECT COUNT(*) AS contacts_on_spec_keys
FROM public.contacts
WHERE status IN (
  'touch_point_2', 'touch_point_3', 'touch_point_4', 'touch_point_5', 'touch_point_6',
  'caliente', 'reunion_agendada', 'en_nutricion'
);

SELECT COUNT(*) AS companies_on_spec_keys
FROM public.companies
WHERE status IN (
  'touch_point_2', 'touch_point_3', 'touch_point_4', 'touch_point_5', 'touch_point_6',
  'caliente', 'reunion_agendada', 'en_nutricion'
);
