-- ETAPA 1 — as telas do cliente passam a falar por funcao, nao por tabela
--
-- POR QUE ISTO EXISTE
-- As telas /assinar/:id e /vistoria/:id sao abertas pelo CLIENTE, que nao tem
-- login. Quando o RLS entrar, elas perdem o acesso as tabelas junto com o resto
-- do mundo. Estas funcoes sao a porta estreita que sobra para elas.
--
-- E, antes disso, elas consertam um buraco que ja existe hoje: a conferencia do
-- telefone acontece NO NAVEGADOR, depois de a OS inteira ja ter sido baixada.
-- Quem abre o link e olha o trafego ve tudo sem digitar nada. Pior: cliente sem
-- telefone cadastrado abre direto, para qualquer um que receba o link
-- encaminhado. Aqui a conferencia passa a acontecer ANTES de o dado sair do
-- banco, e telefone ausente passa a NEGAR em vez de liberar.
--
-- `security definer` faz a funcao rodar com os poderes de quem a criou, entao
-- ela enxerga as tabelas mesmo com o RLS ligado. Por isso a autorizacao tem que
-- estar dentro dela — e esta.
-- `set search_path = ''` evita que alguem crie um objeto com o mesmo nome num
-- schema que venha antes no caminho de busca e sequestre a funcao.

-- ── Leitura: abre a OS para o cliente ────────────────────────────────────────
create or replace function public.os_do_cliente(p_id text, p_tel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_os      jsonb;
  v_alvo    text;
  v_cli     jsonb;
  v_vei     jsonb;
  v_tel     text;
  v_digitos text;
  v_fonte   text := 'ordens';
begin
  v_digitos := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  if length(v_digitos) < 8 then
    return jsonb_build_object('erro', 'telefone-curto');
  end if;

  select o.data into v_os from public.ordens o where o.id = p_id;

  -- Rascunho aponta para a OS de verdade: o link mandado no WhatsApp continua
  -- valendo depois que a recepcao finaliza a entrada.
  if v_os is not null and v_os ->> 'redirectPara' is not null then
    v_alvo := v_os ->> 'redirectPara';
    select o.data into v_os from public.ordens o where o.id = v_alvo;
  end if;

  -- Fichas antigas, anteriores a unificacao, ainda tem links por ai.
  if v_os is null then
    select c.data into v_os from public.checklists c where c.id = p_id;
    v_fonte := 'checklists';
  end if;

  if v_os is null then
    return jsonb_build_object('erro', 'nao-encontrada');
  end if;

  -- Telefone: o da OS, senao o do cadastro do cliente.
  v_tel := v_os ->> 'clienteTelefone';
  if coalesce(v_tel, '') = '' and v_os ->> 'clienteId' is not null then
    select c.data into v_cli from public.clientes c where c.id = v_os ->> 'clienteId';
    v_tel := coalesce(v_cli ->> 'telefone', v_cli ->> 'celular', '');
  end if;
  v_tel := regexp_replace(coalesce(v_tel, ''), '\D', '', 'g');

  -- Sem telefone cadastrado NAO libera. Antes liberava, e era o furo mais
  -- simples de explorar: bastava o link chegar em qualquer mao.
  if length(v_tel) < 8 then
    return jsonb_build_object('erro', 'sem-telefone');
  end if;

  if not (v_tel = v_digitos or v_tel like '%' || v_digitos) then
    return jsonb_build_object('erro', 'telefone-nao-confere');
  end if;

  if v_os ->> 'veiculoId' is not null then
    select v.data into v_vei from public.veiculos v where v.id = v_os ->> 'veiculoId';
  end if;

  -- Devolve so o necessario para a tela. O telefone NAO volta: ele e a chave,
  -- e chave nao viaja de volta para quem acabou de prova-la.
  return jsonb_build_object(
    'ok', true,
    'fonte', v_fonte,
    'id', coalesce(v_alvo, p_id),
    'os', (v_os - 'clienteTelefone')
          || jsonb_build_object(
               'clienteNome', coalesce(nullif(v_os ->> 'clienteNome', ''), v_cli ->> 'nome', ''),
               'veiculoModelo', coalesce(nullif(v_os ->> 'veiculoModelo', ''),
                                         btrim(concat_ws(' ', v_vei ->> 'marca', v_vei ->> 'modelo')), ''),
               'veiculoPlaca', coalesce(nullif(v_os ->> 'veiculoPlaca', ''), v_vei ->> 'placa', '')
             )
  );
end;
$$;

-- ── Escrita: grava a assinatura ──────────────────────────────────────────────
create or replace function public.assinar_os(
  p_id text, p_tel text, p_assinatura text, p_tempo bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check jsonb;
  v_id    text;
  v_fonte text;
  v_os    jsonb;
begin
  if coalesce(p_assinatura, '') = '' then
    return jsonb_build_object('erro', 'assinatura-vazia');
  end if;

  -- Reaproveita a MESMA conferencia da leitura. Duas copias da regra de
  -- autorizacao viram, com o tempo, duas regras diferentes.
  v_check := public.os_do_cliente(p_id, p_tel);
  if v_check ->> 'ok' is null then
    return v_check;
  end if;

  v_id    := v_check ->> 'id';
  v_fonte := v_check ->> 'fonte';

  if v_fonte = 'checklists' then
    select c.data into v_os from public.checklists c where c.id = v_id;
  else
    select o.data into v_os from public.ordens o where o.id = v_id;
  end if;

  -- Ja assinada nao assina de novo. Nao atrapalha retentativa: se a gravacao
  -- tivesse falhado, nao haveria assinatura aqui.
  if coalesce(v_os ->> 'assinatura', '') <> '' then
    return jsonb_build_object('erro', 'ja-assinada');
  end if;

  v_os := v_os || jsonb_build_object(
    'assinatura', p_assinatura,
    'assinaturaTempo', coalesce(p_tempo, (extract(epoch from now()) * 1000)::bigint)
  );

  if v_fonte = 'checklists' then
    update public.checklists set data = v_os where id = v_id;
  else
    update public.ordens set data = v_os where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ── Quem pode chamar ─────────────────────────────────────────────────────────
-- O cliente chega sem login: e o papel `anon` que precisa executar. Note que
-- executar a funcao NAO da acesso as tabelas — so ao que ela devolve.
revoke all on function public.os_do_cliente(text, text) from public;
revoke all on function public.assinar_os(text, text, text, bigint) from public;
grant execute on function public.os_do_cliente(text, text) to anon, authenticated;
grant execute on function public.assinar_os(text, text, text, bigint) to anon, authenticated;
