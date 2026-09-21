-- Post-migration checks for Block 1 (run in SQL editor after applying migration).
-- Cutover kanban gate: nulls must be 0.

SELECT 'contacts.status IS NULL' AS check, COUNT(*) AS n
FROM public.contacts WHERE status IS NULL OR TRIM(status) = '';

SELECT 'companies.status_entered_at IS NULL' AS check, COUNT(*) AS n
FROM public.companies WHERE status_entered_at IS NULL;

SELECT pipeline, is_active, COUNT(*) AS n
FROM public.pipeline_stages
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT catalog_key, COUNT(*) AS n
FROM public.catalog_options
GROUP BY 1
ORDER BY 1;

-- Smoke: update should insert audit_log and succeed (fail-open)
-- UPDATE public.companies SET notes = notes WHERE id = (SELECT id FROM public.companies LIMIT 1);
-- SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 5;
