-- Switch has_role to SECURITY INVOKER so it no longer bypasses RLS.
-- Policies call has_role(auth.uid(), ...) and user_roles has a policy letting
-- authenticated users select their own rows, so INVOKER still works correctly.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;