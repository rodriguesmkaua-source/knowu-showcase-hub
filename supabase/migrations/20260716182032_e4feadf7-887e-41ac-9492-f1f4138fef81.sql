
CREATE POLICY "Admins can update all demandas"
ON public.demandas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all demandas"
ON public.demandas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_log_demanda_changes ON public.demandas;
CREATE TRIGGER trg_log_demanda_changes
AFTER INSERT OR UPDATE OR DELETE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.log_demanda_changes();
