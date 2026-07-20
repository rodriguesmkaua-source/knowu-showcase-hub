## Causa

A tabela `public.demandas` tem **dois triggers idênticos** apontando para a mesma função `log_demanda_changes()`:

- `demandas_audit`
- `trg_log_demanda_changes`

Como o Postgres dispara ambos em toda `INSERT / UPDATE / DELETE`, cada alteração gera **2 linhas no `audit_log`** — daí a duplicação que você vê na aba Auditoria.

Isso vem de duas migrações antigas que criaram o mesmo trigger com nomes diferentes.

## O que fazer

1. Remover um dos dois triggers no banco (manter só `trg_log_demanda_changes`):
   ```sql
   DROP TRIGGER IF EXISTS demandas_audit ON public.demandas;
   ```
2. (Opcional) Limpar os registros duplicados já existentes no `audit_log`, mantendo o primeiro de cada par:
   ```sql
   DELETE FROM public.audit_log a
   USING public.audit_log b
   WHERE a.id > b.id
     AND a.demanda_id IS NOT DISTINCT FROM b.demanda_id
     AND a.action = b.action
     AND a.user_id IS NOT DISTINCT FROM b.user_id
     AND abs(extract(epoch FROM (a.created_at - b.created_at))) < 2;
   ```

## Onde rodar

Isso é uma alteração no seu banco de produção (Supabase privado, o do Vercel). Duas opções:

- **Opção A** — Eu aplico via migração do Lovable Cloud, mas isso só afeta o banco de preview. **Não vai resolver no site publicado.**
- **Opção B (recomendada)** — Você abre o SQL Editor do seu Supabase privado e roda os comandos acima. Efeito imediato no site publicado, sem redeploy.

Confirma qual caminho seguir? Se for B, aplico o passo 1 (obrigatório) e o passo 2 (limpeza) só se você quiser apagar os duplicados históricos.
