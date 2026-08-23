-- ============================================================
--  DESFAZER — devolve o banco ao estado aberto, em segundos
-- ============================================================
--  Guarde este arquivo aberto numa aba ANTES de ligar a tranca.
--  Se qualquer coisa der errado, cole tudo isto no SQL Editor e rode.
--  Nao migra nada, nao apaga nada: so devolve o acesso.
-- ============================================================

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
    execute format('alter table public.%I disable row level security', t);
    execute format('grant all on table public.%I to anon, authenticated', t);
    execute format('drop policy if exists equipe_ativa on public.%I', t);
  end loop;
end $$;

-- Confere: rls_ligado deve ficar FALSE em todas as 17 (18 com estoque_mov).
select relname as tabela, relrowsecurity as rls_ligado
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
