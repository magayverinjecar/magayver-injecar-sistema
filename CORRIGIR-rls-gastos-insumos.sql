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
