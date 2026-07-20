DROP TRIGGER IF EXISTS demandas_audit ON public.demandas;

DELETE FROM public.audit_log a
USING public.audit_log b
WHERE a.id > b.id
  AND a.demanda_id IS NOT DISTINCT FROM b.demanda_id
  AND a.action = b.action
  AND a.user_id IS NOT DISTINCT FROM b.user_id
  AND abs(extract(epoch FROM (a.created_at - b.created_at))) < 2;