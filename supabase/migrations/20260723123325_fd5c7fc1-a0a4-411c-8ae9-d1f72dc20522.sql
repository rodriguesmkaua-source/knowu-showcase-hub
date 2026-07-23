CREATE OR REPLACE FUNCTION public.prevent_duplicate_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_log
    WHERE demanda_id IS NOT DISTINCT FROM NEW.demanda_id
      AND action = NEW.action
      AND created_at > now() - interval '2 seconds'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_audit ON public.audit_log;
CREATE TRIGGER trg_prevent_duplicate_audit
BEFORE INSERT ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_audit();