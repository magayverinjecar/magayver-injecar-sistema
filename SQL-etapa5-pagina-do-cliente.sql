-- ETAPA 5 — a pagina do cliente devolve SO o que o cliente pode ver
--
-- POR QUE ISTO EXISTE
-- `os_do_cliente` e a porta publica das telas /assinar/:id e /vistoria/:id
-- (o cliente nao tem login; a trava e o telefone). Ate aqui ela devolvia a OS
-- INTEIRA, menos o telefone: o preco de CUSTO de cada peca, as anotacoes
-- internas, as observacoes do balcao, o historico com os nomes da equipe e os
-- pagamentos com a taxa da maquininha. A tela nao mostrava nada disso, mas
-- tudo chegava ao celular de quem digitasse o telefone certo — e qualquer um
-- que saiba abrir as ferramentas do navegador le.
--
-- Com o QR da etiqueta de troca de oleo colado no vidro, essa porta passa a
-- ficar a vista. Entao ela devolve agora uma LISTA FECHADA de campos:
--   - o que as duas telas ja usavam: nome, carro, placa, data, fotos, vistoria
--     e se ja foi assinada (so sim/nao — a imagem da assinatura nao precisa sair);
--   - para a "nota" que o QR abre: status, datas, km, os itens (so descricao,
--     quantidade, valor e desconto — nunca o custo), o desconto do fechamento e
--     a proxima troca de oleo.
-- Os itens so saem DEPOIS da aprovacao: antes disso eles sao o rascunho do
-- orcamento, e o link das fotos vai para o cliente ja na entrada do carro.
--
-- A conferencia do telefone NAO MUDOU: e a mesma, linha por linha.
-- `assinar_os` chama esta funcao, mas so usa `ok`, `id` e `fonte` — nao e
-- afetada.
--
-- COMO RODAR
-- Supabase -> SQL Editor -> cole TUDO -> Run. So troca o corpo da funcao.
-- Pode rodar antes ou depois de publicar o sistema: as telas antigas usam so
-- campos que continuam saindo, e a tela nova funciona com os dois.
--
-- PARA DESFAZER: rode SQL-etapa5-DESFAZER.sql (volta a funcao de antes).

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
  v_itens   jsonb := '[]'::jsonb;
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

  -- Sem telefone cadastrado NAO libera.
  if length(v_tel) < 8 then
    return jsonb_build_object('erro', 'sem-telefone');
  end if;

  if not (v_tel = v_digitos or v_tel like '%' || v_digitos) then
    return jsonb_build_object('erro', 'telefone-nao-confere');
  end if;

  if v_os ->> 'veiculoId' is not null then
    select v.data into v_vei from public.veiculos v where v.id = v_os ->> 'veiculoId';
  end if;

  -- Itens: so depois da aprovacao, e so os campos que o cliente pode ver.
  if v_os ->> 'status' in ('Aprovado', 'Aprovada', 'Aguardando Peça', 'Em Execução',
                           'Em Andamento', 'Em Conferência', 'Concluída', 'Entregue')
     and jsonb_typeof(v_os -> 'itens') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'tipo',          i -> 'tipo',
             'descricao',     i -> 'descricao',
             'quantidade',    i -> 'quantidade',
             'valorUnitario', i -> 'valorUnitario',
             'desconto',      i -> 'desconto'
           )), '[]'::jsonb)
      into v_itens
      from jsonb_array_elements(v_os -> 'itens') as i
     where jsonb_typeof(i) = 'object';
  end if;

  -- Lista fechada. O telefone NAO volta: ele e a chave.
  return jsonb_build_object(
    'ok', true,
    'fonte', v_fonte,
    'id', coalesce(v_alvo, p_id),
    'os', jsonb_strip_nulls(jsonb_build_object(
      'clienteNome',    coalesce(nullif(v_os ->> 'clienteNome', ''), v_cli ->> 'nome', ''),
      'veiculoModelo',  coalesce(nullif(v_os ->> 'veiculoModelo', ''),
                                 btrim(concat_ws(' ', v_vei ->> 'marca', v_vei ->> 'modelo')), ''),
      'veiculoPlaca',   coalesce(nullif(v_os ->> 'veiculoPlaca', ''), v_vei ->> 'placa', ''),
      'assinatura',     coalesce(v_os ->> 'assinatura', '') <> '',
      'criadoEm',       v_os -> 'criadoEm',
      'fotos',          v_os -> 'fotos',
      'inspecaoVisual', v_os -> 'inspecaoVisual',
      'status',         v_os -> 'status',
      'dataEntrada',    v_os -> 'dataEntrada',
      'dataConclusao',  v_os -> 'dataConclusao',
      'dataEntrega',    v_os -> 'dataEntrega',
      'kmEntrada',      v_os -> 'kmEntrada',
      'descontoGeral',  case when jsonb_array_length(v_itens) > 0 then v_os -> 'descontoGeral' end,
      'etiquetaOleo',   v_os -> 'etiquetaOleo',
      'itens',          v_itens
    ))
  );
end;
$$;

-- As permissoes nao mudam com `create or replace`, mas ficam aqui por garantia.
revoke all on function public.os_do_cliente(text, text) from public;
grant execute on function public.os_do_cliente(text, text) to anon, authenticated;
