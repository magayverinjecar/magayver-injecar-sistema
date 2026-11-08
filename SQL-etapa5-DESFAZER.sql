-- DESFAZ a etapa 5: volta `os_do_cliente` exatamente como estava
-- (copia fiel de SQL-etapa1-telas-do-cliente.sql, de 17/08/2026).
--
-- Quando usar: se depois de rodar SQL-etapa5-pagina-do-cliente.sql a tela de
-- assinatura ou a de fotos do cliente deixar de abrir.
-- Supabase -> SQL Editor -> cole TUDO -> Run.

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

revoke all on function public.os_do_cliente(text, text) from public;
grant execute on function public.os_do_cliente(text, text) to anon, authenticated;
