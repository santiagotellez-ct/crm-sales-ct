-- Block 1: expand-only foundations for Sales CRM refactor.
-- ADD only. Does not remap companies.status, deal_stages, or drop anything.

-- ─── Catalog: pipeline_stages ───────────────────────────────────────────────
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL CHECK (pipeline IN ('sdr', 'ae')),
  key text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'main' CHECK (kind IN ('main', 'special', 'exit')),
  sort_order integer NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline, key)
);

CREATE INDEX idx_pipeline_stages_pipeline_active
  ON public.pipeline_stages (pipeline, is_active, sort_order);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_pipeline_stages" ON public.pipeline_stages
  FOR ALL USING (true) WITH CHECK (true);

-- SDR: current kanban keys (active). Spec keys (inactive) until cutover.
INSERT INTO public.pipeline_stages (pipeline, key, label, kind, sort_order, is_active) VALUES
  ('sdr', 'por_contactar',              'Por contactar',              'main',    1,  true),
  ('sdr', 'contactado',                 'Contactado',                 'main',    2,  true),
  ('sdr', 'follow_up_1',                'Follow Up 1',                'main',    3,  true),
  ('sdr', 'follow_up_2',                'Follow Up 2',                'main',    4,  true),
  ('sdr', 'en_conversacion',            'En conversación',            'main',    5,  true),
  ('sdr', 'agendado',                   'Agendado',                   'main',    6,  true),
  ('sdr', 'reagendar',                  'Reagendar',                  'special', 7,  true),
  ('sdr', 'no_answer',                  'No Answer',                  'exit',    8,  true),
  ('sdr', 'no_interesado',              'No interesado',              'exit',    9,  true),
  ('sdr', 'unqualified',                'Unqualified',                'exit',   10,  true),
  ('sdr', 'unqualified_post_meeting',   'Unqualified Post-Reunión',   'exit',   11,  true),
  -- Spec-only (inactive until Día 3 cutover)
  ('sdr', 'touch_point_2',              'Touch point 2',              'main',   20, false),
  ('sdr', 'touch_point_3',              'Touch point 3',              'main',   21, false),
  ('sdr', 'touch_point_4',              'Touch point 4',              'main',   22, false),
  ('sdr', 'touch_point_5',              'Touch point 5',              'main',   23, false),
  ('sdr', 'touch_point_6',              'Touch point 6',              'main',   24, false),
  ('sdr', 'caliente',                   'Caliente',                   'main',   25, false),
  ('sdr', 'reunion_agendada',           'Reunión agendada',           'main',   26, false),
  ('sdr', 'en_nutricion',               'En nutrición',               'exit',   27, false);

-- AE: mirror current deal_stages (active). Negociación inactive — do NOT insert into deal_stages.
INSERT INTO public.pipeline_stages (pipeline, key, label, kind, sort_order, probability, is_won, is_lost, is_active) VALUES
  ('ae', 'discovery',              'Discovery realizada',        'main', 1, 20,  false, false, true),
  ('ae', 'propuesta_construccion', 'Propuesta en construcción',  'main', 2, 35,  false, false, true),
  ('ae', 'presentada',             'Propuesta presentada',       'main', 3, 50,  false, false, true),
  ('ae', 'revisada',               'Propuesta en revisión',      'main', 4, 65,  false, false, true),
  ('ae', 'negociacion',            'Propuesta en negociación',   'main', 5, 75,  false, false, false),
  ('ae', 'commited',               'Commited',                   'main', 6, 85,  false, false, true),
  ('ae', 'ganado',                 'Cierre ganado',              'exit', 7, 100, true,  false, true),
  ('ae', 'perdido',                'Cierre perdido',             'exit', 8, 0,   false, true,  true);

-- ─── Catalog: catalog_options ───────────────────────────────────────────────
CREATE TABLE public.catalog_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key text NOT NULL,
  label text NOT NULL,
  code text NOT NULL,
  requires_note boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_key, code)
);

CREATE INDEX idx_catalog_options_key
  ON public.catalog_options (catalog_key, is_active, sort_order);

ALTER TABLE public.catalog_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_catalog_options" ON public.catalog_options
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.catalog_options (catalog_key, code, label, requires_note, sort_order) VALUES
  -- Unqualified (spec §3.9)
  ('unqualified_reason', 'wrong_industry',     'No es la industria correcta',                    false, 1),
  ('unqualified_reason', 'wrong_size',         'Empresa muy pequeña / muy grande para el ticket', false, 2),
  ('unqualified_reason', 'already_customer',   'Ya es cliente por otro canal',                    false, 3),
  ('unqualified_reason', 'duplicate',          'Duplicado en el CRM',                             false, 4),
  ('unqualified_reason', 'other',              'Otro',                                            true,  5),
  -- No interesado
  ('not_interested_reason', 'no_budget',       'Sin presupuesto en este momento',                false, 1),
  ('not_interested_reason', 'similar_event',   'Ya tiene un evento similar contratado',          false, 2),
  ('not_interested_reason', 'exhausted_tps',   'Agotó los 6 touch points sin respuesta',         false, 3),
  ('not_interested_reason', 'explicit_no',     'Dijo NO explícito',                               false, 4),
  ('not_interested_reason', 'other',           'Otro',                                            true,  5),
  -- Lost
  ('lost_reason', 'no_budget',    'Sin presupuesto',           false, 1),
  ('lost_reason', 'timing',       'Timing — no es el momento', false, 2),
  ('lost_reason', 'competition',  'Se fue con la competencia', false, 3),
  ('lost_reason', 'no_response',  'Dejó de responder',         false, 4),
  ('lost_reason', 'other',        'Otro',                      true,  5),
  -- Products
  ('product', 'ctw',         'CTW',           false, 1),
  ('product', 'ctf',         'CTF',           false, 2),
  ('product', 'ai_summit',   'AI Summit',     false, 3),
  ('product', 'govtech',     'GovTech',       false, 4),
  ('product', 'always_on',   'Always-On',     false, 5),
  ('product', 'media',       'Media Company', false, 6),
  -- Channels
  ('channel', 'linkedin',  'LinkedIn',  false, 1),
  ('channel', 'whatsapp',  'WhatsApp',  false, 2),
  ('channel', 'email',     'Correo',    false, 3),
  ('channel', 'call',      'Llamada',   false, 4),
  -- LinkedIn seats
  ('linkedin_seat', 'nico',  'Nico',  false, 1),
  ('linkedin_seat', 'majo',  'Majo',  false, 2),
  ('linkedin_seat', 'liz',   'Liz',   false, 3),
  ('linkedin_seat', 'lau',   'Lau',   false, 4),
  ('linkedin_seat', 'toqui', 'Toqui', false, 5),
  -- ICP / size / source / contact role (catalogized for future admin)
  ('icp_fit', 'ABM',   'ABM',   false, 1),
  ('icp_fit', 'HIGH',  'High',  false, 2),
  ('icp_fit', 'MID',   'Mid',   false, 3),
  ('icp_fit', 'MAYBE', 'Maybe', false, 4),
  ('company_size', 'SMB',        'SMB',         false, 1),
  ('company_size', 'MID',        'Mid-Market',  false, 2),
  ('company_size', 'ENTERPRISE', 'Enterprise',  false, 3),
  ('source', 'inbound',  'Inbound',  false, 1),
  ('source', 'outbound', 'Outbound', false, 2),
  ('contact_role', 'champion', 'Champion',            false, 1),
  ('contact_role', 'decisor',  'Tomador de decisión', false, 2);

-- ─── Catalog: checklist_items ───────────────────────────────────────────────
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'boolean' CHECK (field_type IN ('boolean', 'text', 'select')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, key)
);

CREATE INDEX idx_checklist_items_stage
  ON public.checklist_items (stage_id, is_active, sort_order);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_checklist_items" ON public.checklist_items
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.checklist_items (stage_id, key, label, field_type, options, sort_order)
SELECT s.id, v.key, v.label, v.field_type, v.options::jsonb, v.sort_order
FROM public.pipeline_stages s
JOIN (VALUES
  ('discovery', 'categoria',              'Categoría',                          'select',  '["Fintech","Banca","SaaS","Servicios & Consultoría IT","Otras"]', 1),
  ('discovery', 'icp_empresa',            'ICP de la empresa',                  'boolean', '[]', 2),
  ('discovery', 'dolor_identificado',     'Dolor identificado',                 'boolean', '[]', 3),
  ('discovery', 'decisor_identificado',   'Decisor identificado',               'boolean', '[]', 4),
  ('discovery', 'budget_range',           'Budget range identificado',          'boolean', '[]', 5),
  ('presentada', 'propuesta_enviada',     'Propuesta enviada/presentada',       'boolean', '[]', 1),
  ('presentada', 'decisor_involucrado',   'Decisor involucrado',                'boolean', '[]', 2),
  ('revisada', 'feedback_recibido',       'Feedback recibido',                  'boolean', '[]', 1),
  ('revisada', 'objeciones_identificadas','Objeciones identificadas',           'boolean', '[]', 2),
  ('negociacion', 'objeciones_solucionadas','Objeciones solucionadas',          'boolean', '[]', 1),
  ('commited', 'confirmacion_entrada',    'Confirmación de entrada',            'boolean', '[]', 1),
  ('commited', 'documentacion_admin',     'Documentación administrativa enviada','boolean','[]', 2),
  ('ganado', 'contrato_firmado',          'Contrato firmado',                   'boolean', '[]', 1),
  ('ganado', 'kickoff_agendado',          'Kickoff agendado',                   'boolean', '[]', 2)
) AS v(stage_key, key, label, field_type, options, sort_order)
  ON s.pipeline = 'ae' AND s.key = v.stage_key;

-- ─── Domain columns (nullable / defaults; no remap of companies.status) ─────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_entered_at timestamptz;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS sdr text,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS origin text CHECK (origin IS NULL OR origin IN ('sdr', 'ae_self'));

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS circleback_url text,
  ADD COLUMN IF NOT EXISTS contact_role text;

-- Future inserts only; existing rows stay NULL until backfill below.
ALTER TABLE public.contacts
  ALTER COLUMN status SET DEFAULT 'por_contactar';

CREATE INDEX IF NOT EXISTS idx_companies_status_archived_sdr
  ON public.companies (status, archived_at, sdr);
CREATE INDEX IF NOT EXISTS idx_contacts_company_status_archived
  ON public.contacts (company_id, status, archived_at);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id
  ON public.deals (stage_id);

-- ─── touches (table only; apply_touch RPC is Block 2) ───────────────────────
CREATE TABLE public.touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  touched_at timestamptz NOT NULL DEFAULT now(),
  channel text,
  account_used text,
  sdr text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_touches_contact_touched
  ON public.touches (contact_id, touched_at DESC);
CREATE INDEX idx_touches_company
  ON public.touches (company_id);

ALTER TABLE public.touches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_touches" ON public.touches
  FOR ALL USING (true) WITH CHECK (true);

-- ─── audit_log + fail-open trigger ──────────────────────────────────────────
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_record
  ON public.audit_log (table_name, record_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_audit_log" ON public.audit_log
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.audit_row_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text;
  old_v text;
  new_v text;
  actor uuid;
  actor_mail text;
  rec_id uuid;
BEGIN
  -- Outer fail-open: never abort the calling DML
  BEGIN
    BEGIN
      actor := auth.uid();
      IF actor IS NOT NULL THEN
        SELECT u.email INTO actor_mail FROM auth.users u WHERE u.id = actor;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      actor := NULL;
      actor_mail := NULL;
    END;

    IF TG_OP = 'UPDATE' THEN
      rec_id := (to_jsonb(NEW) ->> 'id')::uuid;
      FOR col IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
        IF col IN ('updated_at', 'created_at') THEN
          CONTINUE;
        END IF;
        old_v := to_jsonb(OLD) ->> col;
        new_v := to_jsonb(NEW) ->> col;
        IF old_v IS DISTINCT FROM new_v THEN
          INSERT INTO public.audit_log (actor_id, actor_email, table_name, record_id, field, old_value, new_value)
          VALUES (actor, actor_mail, TG_TABLE_NAME, rec_id, col, old_v, new_v);
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_companies_changes
  AFTER UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

CREATE TRIGGER audit_contacts_changes
  AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

CREATE TRIGGER audit_deals_changes
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

CREATE TRIGGER audit_meetings_changes
  AFTER UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();

-- ─── Backfill (batched). Gate for kanban cutover: COUNT status IS NULL = 0. ──
-- Not a gate for apply_touch (COALESCE handles NULL).

UPDATE public.companies c
SET status_entered_at = COALESCE(
  (
    SELECT MAX(a.created_at)
    FROM public.activities a
    WHERE a.company_id = c.id
      AND a.type = 'status_change'
      AND a.to_status = c.status
  ),
  c.created_at
)
WHERE c.status_entered_at IS NULL;

-- Copy company stage/sdr onto contacts (bridge until per-contact touches).
UPDATE public.contacts ct
SET
  status = COALESCE(c.status, 'por_contactar'),
  status_entered_at = COALESCE(c.status_entered_at, c.created_at, now()),
  sdr = COALESCE(ct.sdr, c.sdr)
FROM public.companies c
WHERE ct.company_id = c.id
  AND ct.status IS NULL;

-- Any contact without a company match (should not happen) still gets a start value.
UPDATE public.contacts
SET
  status = 'por_contactar',
  status_entered_at = COALESCE(status_entered_at, created_at, now())
WHERE status IS NULL;
