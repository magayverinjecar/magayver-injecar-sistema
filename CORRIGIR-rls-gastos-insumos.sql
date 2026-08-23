-- ============================================================
--  ARQUIVO APOSENTADO — NAO RODE
-- ============================================================
--  Escrito em 16/08/2026, quando o banco ainda era aberto e o RLS
--  precisava ficar DESLIGADO para o sistema funcionar.
--
--  Desde 22/08/2026 a protecao esta LIGADA nas 17 tabelas, de
--  proposito. Rodar este arquivo reabriria `gastos` e `insumos`
--  para qualquer pessoa da internet — e o sistema continuaria
--  funcionando igual, sem sinal nenhum.
--
--  Mantido so como historico. Para mexer na protecao, use os
--  arquivos SQL-etapa1-A-DESFAZER.sql e SQL-etapa1-C-TRANCA.sql.
-- ============================================================

-- ============================================================
-- CORREÇÃO — desligar o RLS de gastos e insumos
--
-- O diálogo do Supabase ("Run and enable RLS") ligou o RLS depois de
-- rodar a migração, desfazendo o disable que estava dentro dela.
-- Com RLS ligado e nenhuma política criada, o banco bloqueia tudo:
-- o sistema não consegue gravar nem ler essas duas tabelas.
--
-- As outras 14 tabelas do sistema já estão assim (sem RLS). Estas duas
-- precisam ficar iguais para funcionar.
--
-- COMO RODAR: Supabase → SQL Editor → New query → cole → Run.
-- Se o aviso "Potential issue detected" aparecer de novo,
-- escolha "Run without RLS" (o botão do meio).
-- ============================================================

alter table gastos  disable row level security;
alter table insumos disable row level security;

-- Confere: as duas linhas devem aparecer com rowsecurity = false
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('gastos', 'insumos');
