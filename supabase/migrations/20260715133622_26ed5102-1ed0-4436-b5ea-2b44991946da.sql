
-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela user_roles
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

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Função has_role (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Tabela de auditoria
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demanda_id UUID,
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE'
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

CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Trigger que registra alterações em demandas
CREATE OR REPLACE FUNCTION public.log_demanda_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_uid UUID;
  v_action TEXT;
  v_changed TEXT[];
  k TEXT;
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
      IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k
         AND k NOT IN ('updated_at') THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    v_action := CASE WHEN 'status' = ANY(v_changed) THEN 'STATUS_CHANGE' ELSE 'UPDATE' END;
    INSERT INTO public.audit_log (demanda_id, user_id, user_email, action, before_data, after_data, changed_fields)
    VALUES (NEW.id, v_uid, v_email, v_action, to_jsonb(OLD), to_jsonb(NEW), v_changed);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER demandas_audit
AFTER INSERT OR UPDATE OR DELETE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.log_demanda_changes();

-- 6. Grant admin ao rodriguesmkaua@gmail.com (agora e no futuro)
CREATE OR REPLACE FUNCTION public.grant_admin_for_known_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = 'rodriguesmkaua@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_known_email();

CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_known_email();

-- Retroativo: se o usuário já existe, dá admin agora
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'rodriguesmkaua@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
