CREATE OR REPLACE FUNCTION public.sync_company_status_from_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_open boolean;
BEGIN
  SELECT (NOT s.is_won) AND (NOT s.is_lost)
    INTO v_is_open
    FROM public.deal_stages s
   WHERE s.id = NEW.stage_id;

  IF v_is_open AND NEW.company_id IS NOT NULL THEN
    UPDATE public.companies
       SET status = 'agendado'
     WHERE id = NEW.company_id
       AND status <> 'agendado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_sync_company_status ON public.deals;
CREATE TRIGGER deals_sync_company_status
AFTER INSERT OR UPDATE OF stage_id, company_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_status_from_deal();

-- Backfill: every company with an open deal becomes "agendado"
UPDATE public.companies c
   SET status = 'agendado'
  FROM public.deals d
  JOIN public.deal_stages s ON s.id = d.stage_id
 WHERE d.company_id = c.id
   AND NOT s.is_won
   AND NOT s.is_lost
   AND c.status <> 'agendado';