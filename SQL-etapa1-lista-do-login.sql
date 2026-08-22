-- ETAPA 1 — a janelinha da tela de login
--
-- POR QUE ISTO EXISTE
-- A tela de login mostra os cards com os nomes. Para mostrar, precisa ler a
-- tabela `funcionarios` — e ler `funcionarios` vai exigir estar logado quando a
-- tranca do banco entrar. Precisa entrar para ver a lista, e precisa da lista
-- para entrar.
--
-- Esta funcao e a unica coisa que responde sem login, e ela devolve SO o que a
-- tela precisa: numero, nome, perfil e o e-mail da conta. NAO devolve PIN, nao
-- devolve telefone, nao devolve permissoes, nao devolve nada mais.
--
-- Isso importa: hoje a tela de login baixa a tabela INTEIRA, com o PIN de todo
-- mundo em texto puro, para qualquer um que abra o endereco do site. Esta
-- funcao e mais restrita do que a situacao de hoje, nao menos.
--
-- Desativado nao aparece: quem for desligado some da tela de login na hora.

create or replace function public.funcionarios_para_login()
returns table (id text, nome text, perfil text, email text)
language sql
security definer
set search_path = ''
stable
as $$
  select
    f.id,
    f.data ->> 'nome'   as nome,
    f.data ->> 'perfil' as perfil,
    f.data ->> 'email'  as email
  from public.funcionarios f
  where coalesce((f.data ->> 'ativo')::boolean, true)   -- cadastro antigo conta como ativo
    and coalesce(f.data ->> 'email', '') <> ''          -- sem e-mail nao ha como entrar
  order by f.data ->> 'nome';
$$;

revoke all on function public.funcionarios_para_login() from public;
grant execute on function public.funcionarios_para_login() to anon, authenticated;
