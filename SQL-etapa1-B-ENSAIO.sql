-- ============================================================
--  ENSAIO — liga a tranca em UMA tabela sem importancia
-- ============================================================
--  Serve para provar, com a oficina parada, que a tranca funciona
--  e que o desfazer funciona — antes de fazer nas 17.
--  `fornecedores` foi escolhida porque quase nada no dia a dia depende dela.
-- ============================================================

-- Quem esta logado E tem cadastro de funcionario ATIVO.
--
-- `security definer` e obrigatorio aqui: sem isso, a politica da tabela
-- `funcionarios` consultaria a propria tabela `funcionarios` e entraria em
-- recursao infinita.
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

-- A tranca, so em fornecedores
alter table public.fornecedores enable row level security;

drop policy if exists equipe_ativa on public.fornecedores;
create policy equipe_ativa on public.fornecedores
  for all to authenticated
  using (public.usuario_ativo())
  with check (public.usuario_ativo());

-- Tira o acesso do VISITANTE.
--
-- Isto e o que faz o bloqueio virar ERRO em vez de lista vazia. Com a permissao
-- ainda concedida, uma leitura barrada volta `[]` sem erro — e este sistema
-- confunde "nao ha" com "nao me deixaram ver".
revoke all on table public.fornecedores from anon;

-- Confere
select relname as tabela, relrowsecurity as rls_ligado
from pg_class where relname = 'fornecedores';
