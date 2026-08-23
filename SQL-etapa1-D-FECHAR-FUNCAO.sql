-- ============================================================
--  ETAPA 1 — D: fechar a funcao usuario_ativo() para visitante
-- ============================================================
--  Ultima ponta solta da tranca de 22/08/2026.
--
--  A funcao usuario_ativo() e o cerebro da politica `equipe_ativa`:
--  ela responde "essa pessoa e da equipe e esta ativa?". Hoje um
--  visitante consegue CHAMAR essa funcao. Ela responde `false` para
--  ele e nao devolve dado nenhum — entao nao vaza nada. E arrumacao,
--  nao emergencia: uma funcao que so a equipe usa nao precisa estar
--  ao alcance de quem nao entrou.
--
--  Rode no SQL Editor do Supabase. Nao muda nada no sistema.
-- ============================================================

revoke execute on function public.usuario_ativo() from anon;

-- Confere: deve devolver ZERO linhas.
select grantee, privilege_type
from   information_schema.role_routine_grants
where  routine_name = 'usuario_ativo'
  and  grantee = 'anon';
