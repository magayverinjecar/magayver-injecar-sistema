-- ============================================================
--  A TRANCA — nas 17 tabelas
-- ============================================================
--  So rode DEPOIS do ensaio (arquivo B) ter dado certo e o desfazer
--  (arquivo A) ter sido testado. Fora do expediente, caixa fechado.
--
--  A regra e uma so: quem esta logado E tem cadastro de funcionario
--  ATIVO trabalha. Visitante nao faz nada.
--
--  Nao ha regra por cargo: o bloqueio do reparador continua sendo
--  filtro de tela, por decisao do dono. Para o banco, os nove sao iguais.
-- ============================================================

-- A funcao (mesma do ensaio; repetida para o arquivo rodar sozinho)
create or replace function public.usuario_ativo()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.funcionarios f
    where lower(coalesce(f.data ->> 'email', '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce((f.data ->> 'ativo')::boolean, true)
  );
$$;

revoke all on function public.usuario_ativo() from public;
grant execute on function public.usuario_ativo() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','veiculos','ordens','estoque','financeiro','agenda',
    'funcionarios','servicos','checklists','orcamentos','compras',
    'fornecedores','caixa_historico','gastos','insumos',
    'caixa_turno','configuracoes',
    -- etapa 2 (kardex, 22/08/2026): o extrato de estoque entra na mesma tranca
    'estoque_mov'
  ] loop
    -- Tabela que ainda nao existe (ex.: estoque_mov antes da etapa 2) e pulada
    -- em vez de derrubar o script inteiro.
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists equipe_ativa on public.%I', t);
    execute format(
      'create policy equipe_ativa on public.%I for all to authenticated '
      'using (public.usuario_ativo()) with check (public.usuario_ativo())', t);
    -- Sem permissao para o visitante, bloqueio vira ERRO e nao lista vazia.
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

-- CONFERENCIA: as 17 tabelas (18 com estoque_mov, se a etapa 2 ja rodou)
-- devem aparecer com rls_ligado = true.
-- Se alguma ficar de fora, ela continua aberta para o mundo.
select relname as tabela, relrowsecurity as rls_ligado
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;
