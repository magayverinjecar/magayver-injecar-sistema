-- ============================================================
-- MAGAYVER INJECAR — Gastos e Insumos saem do navegador
--
-- Até agora essas duas telas gravavam no localStorage do aparelho:
-- cada celular tinha a própria lista, limpar o navegador apagava tudo
-- e nada disso tinha backup. Justamente o custo fixo da oficina.
--
-- COMO RODAR: Supabase → SQL Editor → New query → cole tudo → Run.
-- Rodar duas vezes não causa problema (tudo é "if not exists").
-- ============================================================

create table if not exists gastos  (id text primary key, data jsonb not null default '{}');
create table if not exists insumos (id text primary key, data jsonb not null default '{}');

alter table gastos  disable row level security;
alter table insumos disable row level security;

-- Realtime: sem isto, um gasto lançado na recepção não aparece no celular.
-- O bloco ignora o erro de "já está na publicação" para poder rodar de novo.
do $$
begin
  begin
    alter publication supabase_realtime add table gastos;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table insumos;
  exception when duplicate_object then null;
  end;
end $$;

-- Confere se deu certo: deve listar as duas tabelas.
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('gastos', 'insumos');
