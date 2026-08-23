-- ============================================================
-- ETAPA 2 (ESTOQUE) — PASSO A: O KARDEX
-- ============================================================
-- Cria o extrato de movimentação de estoque (estoque_mov), a
-- função que grava movimento + saldo NUMA TRANSAÇÃO SÓ, e o
-- trigger que impede qualquer outra escrita de mexer no saldo.
--
-- POR QUE EXISTE: hoje 14 pontos do app escrevem o saldo direto,
-- como foto por cima de foto, sem registro de quem/quando/por quê.
-- A partir daqui o saldo muda por SOMA no servidor (dois aparelhos
-- ao mesmo tempo somam os dois, ninguém apaga ninguém) e cada
-- mudança deixa uma linha de extrato que nunca é apagada.
--
-- ORDEM DE PUBLICAÇÃO (importa, e é o contrário do instinto):
--   1. publicar o app novo na Vercel;
--   2. todo aparelho da oficina FECHA e REABRE o sistema (o app antigo
--      grava saldo por foto — com o trigger abaixo ligado, essa foto é
--      descartada em silêncio e a baixa some);
--   3. só então rodar este arquivo.
-- No intervalo entre 1 e 3 o app novo segura cada movimento na fila
-- com a tarja acesa e solta tudo assim que a função existir — nada
-- se perde, só atrasa. Fazer os três passos fora do expediente.
--
-- Pode rodar mais de uma vez sem estrago (tudo idempotente).
-- Para desfazer: SQL-etapa2-B-DESFAZER-KARDEX.sql
-- ============================================================

-- ── 1. A tabela do extrato ──────────────────────────────────
-- Colunas de verdade (não jsonb): é um razão contábil — precisa
-- de soma por peça no próprio banco e de data do SERVIDOR.
create table if not exists public.estoque_mov (
  id          uuid primary key,            -- gerado no app, para o reenvio da fila não duplicar
  seq         bigint generated always as identity,  -- ordem exata dentro do mesmo instante
  peca_id     text not null,               -- id da peça na tabela estoque (sempre texto)
  qtd         numeric not null,            -- COM SINAL: entrada positiva, saída negativa
  tipo        text not null,               -- saida_os, estorno_os, saida_venda, estorno_venda,
                                           -- entrada_compra, estorno_compra, ajuste, saldo_inicial
  motivo      text not null default '',    -- obrigatório no app quando tipo = ajuste
  origem_tipo text not null default '',    -- 'os' | 'venda' | 'compra' | ''
  origem_id   text not null default '',    -- id/número da OS, venda ou compra
  custo_unit  numeric,                     -- valor unitário do movimento (entrada: custo pago; saída: custo congelado)
  autor_id    text not null default '',
  autor_nome  text not null default '',
  criado_em   timestamptz not null default now()  -- relógio do servidor, não do celular
);

-- Se a tabela já existia de uma versão anterior deste arquivo, sem `seq`:
alter table public.estoque_mov add column if not exists seq bigint generated always as identity;

-- Índices com desempate por seq: um lote de 5 peças nasce com o
-- MESMO criado_em (now() é o início da transação) — sem o seq, a
-- paginação do extrato poderia repetir ou pular linha na fronteira.
create index if not exists estoque_mov_peca_idx  on public.estoque_mov (peca_id, criado_em desc, seq desc);
create index if not exists estoque_mov_data_idx  on public.estoque_mov (criado_em desc, seq desc);

-- ── 2. A tranca (mesma política das outras 17 tabelas) ──────
-- Tabela nova nasce aberta para a internet; isto fecha AGORA,
-- no mesmo arquivo em que ela nasce.
alter table public.estoque_mov enable row level security;

drop policy if exists equipe_ativa on public.estoque_mov;
create policy equipe_ativa on public.estoque_mov
  for all to authenticated
  using (public.usuario_ativo())
  with check (public.usuario_ativo());

revoke all on table public.estoque_mov from anon;

-- ── 3. O trigger: o saldo só muda por movimento ─────────────
-- O app grava o CADASTRO da peça (nome, preço, mínimo...) como
-- foto do jsonb inteiro — e essa foto carrega um `estoque` lido
-- segundos antes. Se um movimento de outro aparelho entrou nesse
-- meio-tempo, a foto apagaria a soma. Este trigger fecha a porta:
-- em qualquer UPDATE que não venha de registrar_movimentos, o
-- `estoque` que estava no banco é mantido, venha o que vier.
--
-- Consequência deliberada: nem o editor de tabelas do painel do
-- Supabase muda saldo. Saldo só muda por movimento — é o ponto.
create or replace function public.estoque_protege_saldo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A função registrar_movimentos se identifica com esta marca,
  -- válida só dentro da transação dela.
  if coalesce(current_setting('kardex.via_movimento', true), '') = '1' then
    return new;
  end if;
  -- Linha antiga sem a chave conta como saldo zero: o cliente nunca
  -- "inaugura" um saldo por foto — todo saldo entra por movimento.
  if tg_op = 'UPDATE' then
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{estoque}',
                          coalesce(old.data -> 'estoque', '0'::jsonb));
  end if;
  return new;
end;
$$;

drop trigger if exists estoque_protege_saldo on public.estoque;
create trigger estoque_protege_saldo
  before insert or update on public.estoque
  for each row execute function public.estoque_protege_saldo();

-- ── 4. A função: movimento + saldo numa transação só ────────
-- Recebe uma LISTA de movimentos (jsonb) e, para cada um:
--   1. insere no extrato — se o id já existe (reenvio da fila, ou
--      dois aparelhos fazendo a MESMA ação), NÃO insere de novo e
--      NÃO soma de novo no saldo;
--   2. soma a quantidade no saldo da peça, POR DIFERENÇA, no
--      servidor — nunca foto por cima.
-- Se qualquer passo falhar, os dois desfazem juntos.
--
-- `criar_se_faltar`: usado só no cadastro de peça nova (saldo
-- inicial e compra que cadastra peça) — se o movimento chegar
-- antes de a linha da peça existir, cria a linha só com o saldo;
-- o app completa o resto do cadastro logo em seguida.
--
-- SECURITY INVOKER de propósito: roda como o usuário logado e a
-- política equipe_ativa continua valendo — a função não fura o RLS.
create or replace function public.registrar_movimentos(movs jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  m           jsonb;
  v_id        uuid;
  v_peca      text;
  v_qtd       numeric;
  v_criar     boolean;
  v_saldo     numeric;
  v_inserido  boolean;
  resultados  jsonb := '[]'::jsonb;
  falhas      integer := 0;
begin
  if movs is null or jsonb_typeof(movs) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'esperava uma lista de movimentos');
  end if;

  -- Libera o trigger estoque_protege_saldo SÓ nesta transação.
  perform set_config('kardex.via_movimento', '1', true);

  -- Peças em ordem fixa: dois lotes simultâneos com as mesmas peças
  -- travam as linhas na mesma sequência e não se engasgam (deadlock).
  for m in
    select value from jsonb_array_elements(movs) with ordinality as t(value, ord)
    order by value ->> 'peca_id', ord
  loop
    v_id    := nullif(m ->> 'id', '')::uuid;
    v_peca  := m ->> 'peca_id';
    v_qtd   := nullif(m ->> 'qtd', '')::numeric;
    v_criar := coalesce((m ->> 'criar_se_faltar')::boolean, false);

    if v_id is null or v_peca is null or v_peca = '' or v_qtd is null or v_qtd = 0 then
      falhas := falhas + 1;
      resultados := resultados || jsonb_build_object(
        'id', m ->> 'id', 'ok', false, 'erro', 'movimento incompleto');
      continue;
    end if;

    insert into public.estoque_mov
      (id, peca_id, qtd, tipo, motivo, origem_tipo, origem_id, custo_unit, autor_id, autor_nome)
    values (
      v_id, v_peca, v_qtd,
      coalesce(nullif(m ->> 'tipo', ''), 'ajuste'),
      coalesce(m ->> 'motivo', ''),
      coalesce(m ->> 'origem_tipo', ''),
      coalesce(m ->> 'origem_id', ''),
      nullif(m ->> 'custo_unit', '')::numeric,
      coalesce(m ->> 'autor_id', ''),
      coalesce(m ->> 'autor_nome', '')
    )
    on conflict (id) do nothing;
    v_inserido := found;

    if not v_inserido then
      -- Já aplicado antes (reenvio da fila ou a mesma ação vinda de
      -- dois aparelhos). Devolve o saldo atual sem somar de novo.
      select coalesce(nullif(e.data ->> 'estoque', '')::numeric, 0)
        into v_saldo
        from public.estoque e
       where e.id = v_peca;
      resultados := resultados || jsonb_build_object(
        'id', v_id::text, 'peca_id', v_peca, 'ok', true, 'repetido', true, 'saldo', v_saldo);
      continue;
    end if;

    if v_criar then
      -- A linha-stub leva nome vazio de propósito: se o cadastro
      -- completo demorar, as telas mostram uma peça sem nome em vez
      -- de quebrar num `.toLowerCase()` de nome inexistente.
      insert into public.estoque as e (id, data)
      values (v_peca, jsonb_build_object('estoque', v_qtd, 'nome', '', 'codigo', ''))
      on conflict (id) do update
        set data = jsonb_set(e.data, '{estoque}',
              to_jsonb(coalesce(nullif(e.data ->> 'estoque', '')::numeric, 0) + v_qtd))
      returning nullif(e.data ->> 'estoque', '')::numeric into v_saldo;
    else
      update public.estoque
         set data = jsonb_set(data, '{estoque}',
               to_jsonb(coalesce(nullif(data ->> 'estoque', '')::numeric, 0) + v_qtd))
       where id = v_peca
      returning nullif(data ->> 'estoque', '')::numeric into v_saldo;
    end if;

    if v_saldo is null and not v_criar then
      -- A peça não existe mais no cadastro: o movimento fica
      -- registrado no extrato (história vale), o saldo não muda.
      resultados := resultados || jsonb_build_object(
        'id', v_id::text, 'peca_id', v_peca, 'ok', true, 'pecaAusente', true);
    else
      resultados := resultados || jsonb_build_object(
        'id', v_id::text, 'peca_id', v_peca, 'ok', true, 'saldo', v_saldo);
    end if;
  end loop;

  return jsonb_build_object('ok', falhas = 0, 'falhas', falhas, 'resultados', resultados);
end;
$$;

-- Só a equipe logada chama; anon e public ficam de fora.
revoke all on function public.registrar_movimentos(jsonb) from public;
revoke all on function public.registrar_movimentos(jsonb) from anon;
grant execute on function public.registrar_movimentos(jsonb) to authenticated;

revoke all on function public.estoque_protege_saldo() from public;
revoke all on function public.estoque_protege_saldo() from anon;

-- ── 5. Conferência ──────────────────────────────────────────
-- Deve devolver 1 linha com rls_ligado = true...
select c.relname as tabela, c.relrowsecurity as rls_ligado
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname = 'estoque_mov';

-- ...e 1 linha com o trigger ligado na tabela estoque.
select tgname as trigger, tgenabled as ligado
  from pg_trigger
 where tgrelid = 'public.estoque'::regclass and tgname = 'estoque_protege_saldo';
