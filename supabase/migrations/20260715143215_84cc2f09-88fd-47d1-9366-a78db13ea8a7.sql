-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from public roles.
-- These functions are invoked exclusively by database triggers and must not be
-- callable directly by anon or authenticated clients through the Data API/RPC.

REVOKE EXECUTE ON FUNCTION public.grant_admin_for_known_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_demanda_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is intentionally executable by authenticated because RLS policies
-- reference it; keep it callable but revoke from anon and PUBLIC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;