
CREATE TABLE public.demandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  hora TEXT NOT NULL,
  operadora TEXT NOT NULL,
  solicitante TEXT NOT NULL,
  tipo TEXT NOT NULL,
  beneficiario TEXT NOT NULL,
  medica_responsavel TEXT,
  data_eq TEXT,
  status TEXT NOT NULL DEFAULT 'Aberto',
  observacao TEXT DEFAULT '',
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas TO authenticated;
GRANT ALL ON public.demandas TO service_role;
ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own demandas" ON public.demandas
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_demandas_user_created ON public.demandas(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER update_demandas_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "Only admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_demanda_idx ON public.audit_log(demanda_id);
CREATE INDEX audit_log_created_idx ON public.audit_log(created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "No client inserts on audit_log" ON public.audit_log
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "No client updates on audit_log" ON public.audit_log
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on audit_log" ON public.audit_log
  FOR DELETE TO authenticated, anon USING (false);

CREATE OR REPLACE FUNCTION public.log_demanda_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT; v_uid UUID; v_action TEXT; v_changed TEXT[]; k TEXT;
BEGIN
  v_uid := auth.uid();
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (demanda_id, user_id, user_email, action, after_data)
    VALUES (NEW.id, v_uid, v_email, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (demanda_id, user_id, user_email, action, before_data)
    VALUES (OLD.id, v_uid, v_email, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_changed := ARRAY[]::TEXT[];
    FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
      IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k AND k NOT IN ('updated_at') THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN RETURN NEW; END IF;
    v_action := CASE WHEN 'status' = ANY(v_changed) THEN 'STATUS_CHANGE' ELSE 'UPDATE' END;
    INSERT INTO public.audit_log (demanda_id, user_id, user_email, action, before_data, after_data, changed_fields)
    VALUES (NEW.id, v_uid, v_email, v_action, to_jsonb(OLD), to_jsonb(NEW), v_changed);
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_demanda_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER demandas_audit
AFTER INSERT OR UPDATE OR DELETE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.log_demanda_changes();

CREATE OR REPLACE FUNCTION public.grant_admin_for_known_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'rodriguesmkaua@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_known_email() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_known_email();

CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_known_email();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'rodriguesmkaua@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
