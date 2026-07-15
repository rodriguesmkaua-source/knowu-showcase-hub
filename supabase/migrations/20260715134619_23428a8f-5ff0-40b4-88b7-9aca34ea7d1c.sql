
-- 1) Lock down has_role EXECUTE (SECURITY DEFINER function)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
-- authenticated needs EXECUTE so RLS policies calling has_role() work for signed-in users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2) audit_log: block all client writes explicitly.
-- The trigger log_demanda_changes runs as SECURITY DEFINER and bypasses these policies.
CREATE POLICY "No client inserts on audit_log"
  ON public.audit_log FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "No client updates on audit_log"
  ON public.audit_log FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "No client deletes on audit_log"
  ON public.audit_log FOR DELETE TO authenticated, anon
  USING (false);

-- 3) user_roles: only admins can modify roles; no self-promotion possible.
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
