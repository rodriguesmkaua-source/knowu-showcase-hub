
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
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_demandas_user_created ON public.demandas(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_demandas_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
