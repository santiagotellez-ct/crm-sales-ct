
CREATE OR REPLACE FUNCTION public.set_close_date_on_commit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_commit_or_won boolean;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT (s.is_won OR s.name = 'Commited')
      INTO v_is_commit_or_won
      FROM public.deal_stages s
     WHERE s.id = NEW.stage_id;

    IF v_is_commit_or_won THEN
      NEW.expected_close_date := (now() AT TIME ZONE 'America/Bogota')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_set_close_date_on_commit ON public.deals;
CREATE TRIGGER deals_set_close_date_on_commit
BEFORE INSERT OR UPDATE OF stage_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_close_date_on_commit();
